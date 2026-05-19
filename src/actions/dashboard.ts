"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { upsertDailyWorkspaceMetrics } from "@/lib/metrics/upsertDailyWorkspaceMetrics";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function refreshDashboardAction(
  workspaceId: string,
  slug: string,
  llmKey: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", llmKey)
    .single();
  if (!provider) return { success: false, error: "Provider no encontrado" };

  const today = new Date().toISOString().slice(0, 10);
  const service = getServiceClient();

  await upsertDailyWorkspaceMetrics({
    supabase: service,
    workspaceId,
    llmProviderId: provider.id as string,
    date: today,
  });

  revalidatePath(`/${slug}/dashboard`);
  return { success: true };
}
