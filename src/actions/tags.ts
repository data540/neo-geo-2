"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignTagSchema, createTagSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

async function requireManage(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  return data === true;
}

export async function createTagAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    workspaceId: formData.get("workspaceId") as string,
    name: formData.get("name") as string,
    color: (formData.get("color") as string) || "#6366f1",
  };

  const parsed = createTagSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, name, color } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompt_tags")
    .insert({ workspace_id: workspaceId, name, color })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: "Error al crear el tag" };

  return { success: true, data: { id: data.id } };
}

export async function assignTagToPromptAction(data: unknown): Promise<ActionResult> {
  const parsed = assignTagSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const { promptId, tagId, workspaceId } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompt_tag_assignments")
    .insert({ prompt_id: promptId, tag_id: tagId });

  if (error) return { success: false, error: "Error al asignar tag" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (workspace) revalidatePath(`/${workspace.slug}/prompts`);

  return { success: true };
}

export async function removeTagFromPromptAction(
  promptId: string,
  tagId: string,
  workspaceId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompt_tag_assignments")
    .delete()
    .eq("prompt_id", promptId)
    .eq("tag_id", tagId);

  if (error) return { success: false, error: "Error al quitar tag" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (workspace) revalidatePath(`/${workspace.slug}/prompts`);

  return { success: true };
}
