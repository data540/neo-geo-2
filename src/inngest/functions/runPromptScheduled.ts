import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const runPromptScheduled = inngest.createFunction(
  {
    id: "prompt-run-scheduled",
    name: "Run Prompts Scheduled",
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    const supabase = getServiceClient();

    const prompts = await step.run("fetch-active-prompts", async () => {
      const { data } = await supabase
        .from("prompts")
        .select("id, workspace_id")
        .eq("status", "active");
      return data ?? [];
    });

    if (!prompts.length) {
      return { sent: 0 };
    }

    const events = prompts.map((p) => ({
      name: "prompt/run.manual" as const,
      data: {
        promptId: p.id as string,
        workspaceId: p.workspace_id as string,
        llmKey: "chatgpt" as const,
      },
    }));

    await step.run("send-events", () => inngest.send(events));

    return { sent: events.length };
  }
);
