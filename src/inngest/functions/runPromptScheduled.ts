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
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    const supabase = getServiceClient();

    const configs = await step.run("fetch-llm-configs", async () => {
      const { data } = await supabase
        .from("workspace_llm_config")
        .select("workspace_id, prompts_per_day, llm_providers(key)")
        .eq("enabled", true)
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

      const count = Math.min(config.prompts_per_day, available.length);
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
