// Refresca los datos SERP de Google AI Overview para todos los prompts activos
// de workspaces con gemini habilitado.
//
// Estrategia mínimo coste:
//   - Se ejecuta automáticamente cada lunes a las 03:00 UTC.
//   - También se dispara manualmente enviando el evento "aio/serp.refresh".
//   - Solo llama a SerpAPI si no hay un snapshot de los últimos 7 días
//     para ese prompt (1 llamada/prompt/semana como máximo).

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { fetchAiOverviewSerp } from "@/lib/aio/serpApiClient";

const CACHE_TTL_DAYS = 7;
const BATCH_DELAY_MS = 500; // pausa entre llamadas para no saturar SerpAPI

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const refreshAioSerpData = inngest.createFunction(
  {
    id: "refresh-aio-serp-data",
    name: "Refresh AI Overview SERP Data (weekly)",
    triggers: [
      // Cron semanal (lunes 03:00 UTC)
      { cron: "0 3 * * 1" },
      // Disparo manual desde la UI o CLI
      { event: "aio/serp.refresh" },
    ],
    // Máximo 1 ejecución simultánea para no duplicar llamadas a SerpAPI
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) => {
    const supabase = getServiceClient();

    // 1. Obtener el ID del proveedor gemini
    const geminiProvider = await step.run("fetch-gemini-provider", async () => {
      const { data } = await supabase
        .from("llm_providers")
        .select("id")
        .eq("key", "gemini")
        .eq("enabled", true)
        .single();
      return data;
    });

    if (!geminiProvider) {
      return { skipped: true, reason: "gemini provider not found or disabled" };
    }

    // 2. Workspaces que tienen gemini habilitado
    const workspaces = await step.run("fetch-workspaces", async () => {
      const { data } = await supabase
        .from("workspace_llm_config")
        .select("workspace_id")
        .eq("llm_provider_id", geminiProvider.id)
        .eq("enabled", true);
      return (data ?? []).map((r) => r.workspace_id as string);
    });

    if (workspaces.length === 0) {
      return { fetched: 0, skipped: 0, reason: "no workspaces with gemini enabled" };
    }

    // 3. Prompts activos de esos workspaces con su texto y país
    const prompts = await step.run("fetch-active-prompts", async () => {
      const { data } = await supabase
        .from("prompts")
        .select("id, workspace_id, text, country")
        .in("workspace_id", workspaces)
        .eq("status", "active");
      return (data ?? []) as Array<{
        id: string;
        workspace_id: string;
        text: string;
        country: string | null;
      }>;
    });

    if (prompts.length === 0) {
      return { fetched: 0, skipped: 0, reason: "no active prompts" };
    }

    // 4. IDs de prompts que ya tienen snapshot reciente (< 7 días)
    const since = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const recentIdsList = await step.run("fetch-recent-cache", async () => {
      const { data } = await supabase
        .from("prompt_serp_cache")
        .select("prompt_id")
        .in(
          "prompt_id",
          prompts.map((p) => p.id)
        )
        .gte("fetched_at", since);
      return (data ?? []).map((r) => r.prompt_id as string);
    });
    const recentIds = new Set(recentIdsList);

    // 5. Solo procesar los que no tienen caché reciente
    const toFetch = prompts.filter((p) => !recentIds.has(p.id));

    if (toFetch.length === 0) {
      return { fetched: 0, skipped: prompts.length, reason: "all prompts have fresh cache" };
    }

    let fetched = 0;
    let errors = 0;

    // 6. Llamar a SerpAPI en lotes (step por cada prompt para tolerancia a fallos)
    for (const prompt of toFetch) {
      await step.run(`serp-fetch-${prompt.id}`, async () => {
        try {
          const result = await fetchAiOverviewSerp(prompt.text, prompt.country);
          await supabase.from("prompt_serp_cache").insert({
            workspace_id: prompt.workspace_id,
            prompt_id: prompt.id,
            ai_overview_present: result.present,
            ai_overview_serp_position: result.serpPosition,
            ai_overview_sections: result.sections,
            ai_mode_present: result.aiMode.present,
            ai_mode_serp_position: result.aiMode.serpPosition,
          });
          fetched++;
        } catch (err) {
          errors++;
          console.error(`SerpAPI error prompt=${prompt.id}:`, err instanceof Error ? err.message : err);
          // No relanzar — el step falla en silencio para no bloquear el resto
        }
        // Pausa mínima entre llamadas
        await sleep(BATCH_DELAY_MS);
      });
    }

    return {
      fetched,
      skipped: recentIds.size,
      errors,
      total: prompts.length,
    };
  }
);
