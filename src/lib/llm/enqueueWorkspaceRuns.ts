import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { executePromptRun, executePromptRunFast, type SharedRunContext } from "./executePromptRun";

const CONCURRENCY = 12;

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Legacy: encola y ejecuta los runs del workspace creando los prompt_runs
 * desde dentro (un solo paso). Se sigue exportando por compatibilidad, pero el
 * flow nuevo de `createWorkspaceAction` crea los runs directamente y llama a
 * `executeRunsInBackground` para evitar latencia extra.
 */
export async function enqueueWorkspaceRuns(
  workspaceId: string,
  llmKey: string = "chatgpt"
): Promise<void> {
  const supabase = getServiceClient();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (!prompts || prompts.length === 0) return;

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", llmKey)
    .single();

  if (!provider) {
    console.error(`[enqueueWorkspaceRuns] provider not found: ${llmKey}`);
    return;
  }

  const { data: runs, error } = await supabase
    .from("prompt_runs")
    .insert(
      prompts.map((p) => ({
        workspace_id: workspaceId,
        prompt_id: p.id,
        llm_provider_id: provider.id,
        status: "queued",
      }))
    )
    .select("id");

  if (error || !runs) {
    console.error("[enqueueWorkspaceRuns] insert error:", error?.message);
    return;
  }

  const runIds = runs.map((r) => r.id as string);
  executeRunsInBackground(workspaceId, runIds);
}

/**
 * Carga el contexto del workspace (workspace, brands, provider) UNA sola vez,
 * y lanza CONCURRENCY workers que ejecutan los runs en paralelo usando ese
 * contexto compartido. Fire & forget (no espera).
 */
export function executeRunsInBackground(workspaceId: string, runIds: string[]): void {
  if (runIds.length === 0) return;

  void (async () => {
    const supabase = getServiceClient();

    const [
      { data: workspace },
      { data: ownBrands },
      { data: competitorBrands },
      { data: provider },
    ] = await Promise.all([
      supabase.from("workspaces").select("id, slug").eq("id", workspaceId).single(),
      supabase
        .from("brands")
        .select("id, name, aliases")
        .eq("workspace_id", workspaceId)
        .eq("type", "own"),
      supabase
        .from("brands")
        .select("id, name, aliases")
        .eq("workspace_id", workspaceId)
        .eq("type", "competitor"),
      supabase.from("llm_providers").select("id, key").eq("key", "chatgpt").single(),
    ]);

    if (!workspace || !ownBrands?.[0] || !provider) {
      console.error("[executeRunsInBackground] contexto incompleto", {
        workspace: !!workspace,
        ownBrand: !!ownBrands?.[0],
        provider: !!provider,
      });
      // Fallback: ejecutar runs uno a uno con el path lento (que recarga el contexto)
      for (const id of runIds) {
        try {
          await executePromptRun(id);
        } catch (err) {
          console.error(`[executeRunsInBackground] fallback run ${id} failed:`, err);
        }
      }
      return;
    }

    const ctx: SharedRunContext = {
      workspace: { id: workspace.id as string, slug: workspace.slug as string },
      ownBrand: {
        id: ownBrands[0].id as string,
        name: ownBrands[0].name as string,
        aliases: (ownBrands[0].aliases as string[]) ?? [],
      },
      competitors: (competitorBrands ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        aliases: (c.aliases as string[]) ?? [],
      })),
      llmProvider: { id: provider.id as string, key: provider.key as "chatgpt" },
    };

    const queue = [...runIds];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (id) {
          try {
            await executePromptRunFast(id, ctx);
          } catch (err) {
            console.error(`[executeRunsInBackground] run ${id} failed:`, err);
          }
        }
      }
    });
    await Promise.all(workers);
  })();
}
