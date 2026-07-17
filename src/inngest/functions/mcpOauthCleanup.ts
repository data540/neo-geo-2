import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const mcpOauthCleanup = inngest.createFunction(
  {
    id: "mcp-oauth-cleanup",
    name: "MCP OAuth Cleanup",
    triggers: [{ cron: "0 4 * * *" }], // 4am UTC diario
  },
  async ({ step }) => {
    await step.run("delete-expired-oauth-rows", async () => {
      const supabase = getServiceClient();
      const now = new Date().toISOString();

      // Eliminar códigos OAuth consumidos o expirados
      await supabase
        .from("mcp_oauth_codes")
        .delete()
        .or(`expires_at.lt.${now},consumed_at.not.is.null`);

      // Eliminar tokens OAuth revocados o expirados
      await supabase
        .from("mcp_oauth_tokens")
        .delete()
        .or(`expires_at.lt.${now},revoked_at.not.is.null`);

      return { deleted: true };
    });
  }
);
