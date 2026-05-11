import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { detectBrands } from "@/lib/detection/detectBrands";
import { runPrompt } from "@/lib/llm/runner";
import { calculateConsistency, calculateSOV } from "@/lib/metrics/calculate";
import type { Brand, LlmProviderKey } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const runPromptManual = inngest.createFunction(
  {
    id: "prompt-run-manual",
    name: "Run Prompt Manual",
    triggers: [{ event: "prompt/run.manual" }],
    concurrency: { limit: 5 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { promptId, workspaceId, llmKey } = event.data as {
      promptId: string;
      workspaceId: string;
      llmKey: LlmProviderKey;
    };

    const supabase = getServiceClient();

    // 1. Obtener datos de contexto
    const context = await step.run("fetch-context", async () => {
      const [p, w, b, c, l] = await Promise.all([
        supabase.from("prompts").select("*").eq("id", promptId).single(),
        supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
        supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "own"),
        supabase
          .from("brands")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("type", "competitor"),
        supabase.from("llm_providers").select("*").eq("key", llmKey).single(),
      ]);
      return {
        prompt: p.data,
        workspace: w.data,
        ownBrands: b.data ?? [],
        competitorBrands: c.data ?? [],
        llmProvider: l.data,
      };
    });

    if (!context.prompt || !context.workspace || !context.llmProvider) {
      throw new Error("Datos de contexto no encontrados");
    }

    const ownBrand = context.ownBrands[0] as Brand | undefined;
    if (!ownBrand) throw new Error("No hay brand propia en el workspace");

    // 2. Crear prompt_run
    const runId = await step.run("create-run", async () => {
      const { data, error } = await supabase
        .from("prompt_runs")
        .insert({
          workspace_id: workspaceId,
          prompt_id: promptId,
          llm_provider_id: context.llmProvider!.id,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("No se pudo crear el prompt_run");
      return data.id as string;
    });

    // 3. Llamar al LLM
    const llmResult = await step.run("call-llm", () =>
      runPrompt({
        provider: llmKey,
        prompt: context.prompt!.text as string,
        workspace: { id: context.workspace!.id as string, slug: context.workspace!.slug as string },
        brand: { name: ownBrand.name, aliases: ownBrand.aliases },
        competitors: (context.competitorBrands as Brand[]).map((c) => ({
          name: c.name,
          aliases: c.aliases,
        })),
      })
    );

    // 4. Guardar raw_response y marcar como completed
    await step.run("save-response", async () => {
      await supabase
        .from("prompt_runs")
        .update({
          raw_response: llmResult.rawResponse,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    });

    // 5. Detectar marcas
    const detection = await step.run("detect-brands", () =>
      Promise.resolve(
        detectBrands({
          rawResponse: llmResult.rawResponse,
          ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: ownBrand.aliases },
          competitors: (context.competitorBrands as Brand[]).map((c) => ({
            id: c.id,
            name: c.name,
            aliases: c.aliases,
          })),
        })
      )
    );

    // 6. Insertar mentions
    await step.run("insert-mentions", async () => {
      const mentions: Record<string, unknown>[] = [];

      if (detection.ownBrandMentioned) {
        mentions.push({
          workspace_id: workspaceId,
          prompt_run_id: runId,
          brand_id: ownBrand.id,
          brand_name_detected: detection.detectedBrandName,
          brand_type: "own",
          position: detection.ownBrandPosition,
          sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
          confidence: detection.confidence,
        });
      }

      for (const comp of detection.competitors) {
        mentions.push({
          workspace_id: workspaceId,
          prompt_run_id: runId,
          brand_id: comp.brandId,
          brand_name_detected: comp.name,
          brand_type: "competitor",
          position: comp.position,
          sentiment: comp.sentiment,
          confidence: comp.confidence,
        });
      }

      if (mentions.length > 0) {
        await supabase.from("mentions").insert(mentions);
      }
    });

    // 7. Calcular y upsert daily_prompt_metrics
    await step.run("upsert-metrics", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const competitorCount = detection.competitors.length;
      const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, competitorCount);

      const { data: recentRuns } = await supabase
        .from("prompt_runs")
        .select("id")
        .eq("prompt_id", promptId)
        .eq("llm_provider_id", context.llmProvider!.id as string)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5);

      const recentRunIds = (recentRuns ?? []).map((r) => r.id as string);
      let mentionCount = 0;
      if (recentRunIds.length > 0) {
        const { count } = await supabase
          .from("mentions")
          .select("*", { count: "exact", head: true })
          .in("prompt_run_id", recentRunIds)
          .eq("brand_type", "own");
        mentionCount = count ?? 0;
      }

      const consistencyScore = calculateConsistency(mentionCount, recentRunIds.length || 1);

      await supabase.from("daily_prompt_metrics").upsert(
        {
          workspace_id: workspaceId,
          prompt_id: promptId,
          llm_provider_id: context.llmProvider!.id as string,
          date: today,
          brand_mentioned: detection.ownBrandMentioned,
          brand_position: detection.ownBrandPosition,
          competitor_count: competitorCount,
          sov,
          sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
          consistency_score: consistencyScore,
        },
        { onConflict: "prompt_id,llm_provider_id,date" }
      );
    });

    // 8. Revalidar rutas
    await step.run("revalidate", async () => {
      revalidatePath(`/${context.workspace!.slug}/prompts`);
      revalidatePath(`/${context.workspace!.slug}/dashboard`);
    });

    return { success: true, runId };
  }
);
