import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const aggregateDailyMetrics = inngest.createFunction(
  {
    id: "aggregate-daily-metrics",
    name: "Aggregate Daily Workspace Metrics",
    triggers: [{ cron: "0 2 * * *" }],
  },
  async ({ step }) => {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const providers = await step.run("fetch-providers", async () => {
      const { data } = await supabase.from("llm_providers").select("id, key").eq("enabled", true);
      return data ?? [];
    });

    const workspaces = await step.run("fetch-workspaces", async () => {
      const { data } = await supabase.from("workspaces").select("id, slug");
      return data ?? [];
    });

    if (!providers.length || !workspaces.length) return { aggregated: 0 };

    let aggregated = 0;

    for (const workspace of workspaces) {
      for (const provider of providers) {
        await step.run(`aggregate-${workspace.id}-${provider.key}`, async () => {
          const { data: metrics } = await supabase
            .from("daily_prompt_metrics")
            .select("*")
            .eq("workspace_id", workspace.id)
            .eq("llm_provider_id", provider.id)
            .eq("date", today);

          if (!metrics || metrics.length === 0) return;

          const activePrompts = metrics.length;
          const mentionedPrompts = metrics.filter((m) => m.brand_mentioned).length;
          const positions = metrics
            .filter((m) => m.brand_mentioned && m.brand_position !== null)
            .map((m) => m.brand_position as number);
          const avgPosition =
            positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
          const highConsistencyCount = metrics.filter(
            (m) => (m.consistency_score ?? 0) >= 70
          ).length;
          const brandConsistency = Math.round((highConsistencyCount / activePrompts) * 1000) / 10;
          const sovValues = metrics.filter((m) => m.sov !== null).map((m) => m.sov as number);
          const avgSov =
            sovValues.length > 0
              ? Math.round((sovValues.reduce((a, b) => a + b, 0) / sovValues.length) * 10) / 10
              : null;

          await supabase.from("daily_workspace_metrics").upsert(
            {
              workspace_id: workspace.id,
              llm_provider_id: provider.id,
              date: today,
              active_prompts_count: activePrompts,
              brand_mentions_count: mentionedPrompts,
              avg_position: avgPosition,
              brand_consistency: brandConsistency,
              avg_sov: avgSov,
            },
            { onConflict: "workspace_id,llm_provider_id,date" }
          );
        });
        aggregated++;
      }
    }

    return { aggregated };
  }
);
