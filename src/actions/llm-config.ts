"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, WorkspaceLlmConfigWithProvider } from "@/types";

const upsertLlmConfigSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(1),
  configs: z
    .array(
      z.object({
        llmProviderId: z.string().uuid(),
        promptsPerDay: z.number().int().min(0).max(50),
      })
    )
    .min(1)
    .max(10),
});

export async function getLlmConfigAction(
  workspaceId: string
): Promise<ActionResult<WorkspaceLlmConfigWithProvider[]>> {
  const supabase = await createClient();

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    p_workspace_id: workspaceId,
  });
  if (!isMember) return { success: false, error: "Sin permisos" };

  const { data, error } = await supabase
    .from("workspace_llm_config")
    .select("*, llm_providers(key, name)")
    .eq("workspace_id", workspaceId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as WorkspaceLlmConfigWithProvider[] };
}

export async function upsertLlmConfigAction(input: unknown): Promise<ActionResult> {
  const parsed = upsertLlmConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, workspaceSlug, configs } = parsed.data;
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const rows = configs.map((c) => ({
    workspace_id: workspaceId,
    llm_provider_id: c.llmProviderId,
    prompts_per_day: c.promptsPerDay,
    enabled: c.promptsPerDay > 0,
  }));

  const { error } = await supabase
    .from("workspace_llm_config")
    .upsert(rows, { onConflict: "workspace_id,llm_provider_id" });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/${workspaceSlug}/settings`);
  return { success: true };
}
