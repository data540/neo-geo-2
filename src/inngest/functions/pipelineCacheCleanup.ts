import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const pipelineCacheCleanup = inngest.createFunction(
  {
    id: "pipeline-cache-cleanup",
    name: "Pipeline Cache Cleanup",
    triggers: [{ cron: "0 3 * * *" }], // 3am UTC diario
  },
  async ({ step }) => {
    await step.run("delete-expired-entries", async () => {
      const supabase = getServiceClient();

      await supabase
        .from("pipeline_cache")
        .delete()
        .or(`expires_at.lt.${new Date().toISOString()},invalidated_at.not.is.null`);

      return { deleted: true };
    });
  }
);
