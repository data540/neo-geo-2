import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { upsertDailyWorkspaceMetrics } from "@/lib/metrics/upsertDailyWorkspaceMetrics";

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
          await upsertDailyWorkspaceMetrics({
            supabase,
            workspaceId: workspace.id,
            llmProviderId: provider.id,
            date: today,
          });
          revalidatePath(`/${workspace.slug}/dashboard`);
        });
        aggregated++;
      }
    }

    return { aggregated };
  }
);
