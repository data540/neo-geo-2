import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import type { LlmProviderKey } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function shuffle(arr: string[]): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export const runPromptScheduled = inngest.createFunction(
  {
    id: "prompt-run-scheduled",
    name: "Run Prompts Scheduled",
    // 06:00 UTC = 08:00 Madrid en verano (CEST). En invierno (CET) cae a 07:00 Madrid.
    // 1 disparo/día. Encola hasta `prompts_per_day` runs por (workspace, proveedor),
    // descontando los ya ejecutados hoy. Cada run hace 2 llamadas LLM (respuesta +
    // análisis combinado sentiment/posición). El cap global de dailyCap.ts protege
    // contra picos. Coste esperado: céntimos/día con la config actual.
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    const supabase = getServiceClient();

    const configs = await step.run("fetch-llm-configs", async () => {
      const { data } = await supabase
        .from("workspace_llm_config")
        .select("workspace_id, prompts_per_day, llm_providers!inner(id, key, enabled)")
        .eq("enabled", true)
        .eq("llm_providers.enabled", true)
        .gt("prompts_per_day", 0);
      return data ?? [];
    });

    if (!configs.length) {
      return { sent: 0 };
    }

    const allPrompts = await step.run("fetch-active-prompts", async () => {
      const { data } = await supabase
        .from("prompts")
        .select("id, workspace_id")
        .eq("status", "active");
      return data ?? [];
    });

    // Runs ya completados hoy por workspace+LLM (evita reejecutar si el CRON se dispara dos veces)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const runsToday = await step.run("fetch-runs-today", async () => {
      const { data } = await supabase
        .from("prompt_runs")
        .select("workspace_id, llm_provider_id")
        .gte("created_at", todayStart.toISOString());
      const counts = new Map<string, number>();
      for (const r of data ?? []) {
        const key = `${r.workspace_id}:${r.llm_provider_id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Object.fromEntries(counts);
    });

    const promptsByWorkspace = new Map<string, string[]>();
    for (const p of allPrompts) {
      const wid = p.workspace_id as string;
      if (!promptsByWorkspace.has(wid)) {
        promptsByWorkspace.set(wid, []);
      }
      promptsByWorkspace.get(wid)!.push(p.id as string);
    }

    const events: Array<{
      name: "prompt/run.manual";
      data: { promptId: string; workspaceId: string; llmKey: LlmProviderKey };
    }> = [];

    for (const config of configs) {
      const workspaceId = config.workspace_id as string;
      const llmKey = (config.llm_providers as unknown as { key: string } | null)?.key as
        | LlmProviderKey
        | undefined;

      if (!llmKey) continue;

      const available = promptsByWorkspace.get(workspaceId) ?? [];
      if (available.length === 0) continue;

      // Guard: no superar prompts_per_day descontando los ya ejecutados hoy
      const providerData = config.llm_providers as unknown as { key: string; id?: string } | null;
      const providerId = providerData?.id ?? "";
      const alreadyToday =
        (runsToday as Record<string, number>)[`${workspaceId}:${providerId}`] ?? 0;
      const remaining = Math.max(0, config.prompts_per_day - alreadyToday);
      if (remaining === 0) continue;

      const count = Math.min(remaining, available.length);
      const selected = shuffle(available).slice(0, count);

      for (const promptId of selected) {
        events.push({
          name: "prompt/run.manual",
          data: { promptId, workspaceId, llmKey },
        });
      }
    }

    if (!events.length) {
      return { sent: 0 };
    }

    await step.run("send-events", () => inngest.send(events));

    return { sent: events.length };
  }
);
