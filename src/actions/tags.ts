"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assignTagSchema,
  createTagSchema,
  deleteTagSchema,
  updateTagSchema,
} from "@/lib/validations/schemas";
import type { ActionResult, PromptTag } from "@/types";

async function getWorkspaceSlug(workspaceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).single();
  return (data?.slug as string | undefined) ?? null;
}

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

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) {
    revalidatePath(`/${slug}/tags`);
    revalidatePath(`/${slug}/prompts`);
  }

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

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/prompts`);

  return { success: true };
}

export async function updateTagAction(data: unknown): Promise<ActionResult> {
  const parsed = updateTagSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { tagId, workspaceId, name, color } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompt_tags")
    .update({ name, color })
    .eq("id", tagId)
    .eq("workspace_id", workspaceId);

  if (error) return { success: false, error: "Error al actualizar el tag" };

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) {
    revalidatePath(`/${slug}/tags`);
    revalidatePath(`/${slug}/prompts`);
  }

  return { success: true };
}

export async function deleteTagAction(data: unknown): Promise<ActionResult> {
  const parsed = deleteTagSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { tagId, workspaceId } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompt_tags")
    .delete()
    .eq("id", tagId)
    .eq("workspace_id", workspaceId);

  if (error) return { success: false, error: "Error al eliminar el tag" };

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) {
    revalidatePath(`/${slug}/tags`);
    revalidatePath(`/${slug}/prompts`);
  }

  return { success: true };
}

export interface WorkspaceTagWithUsage extends PromptTag {
  prompt_count: number;
}

export async function getWorkspaceTagsAction(
  workspaceId: string
): Promise<ActionResult<WorkspaceTagWithUsage[]>> {
  const supabase = await createClient();

  const { data: tags, error } = await supabase
    .from("prompt_tags")
    .select("id, workspace_id, name, color, created_at")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) return { success: false, error: "Error al cargar tags" };

  const tagIds = (tags ?? []).map((t) => t.id as string);
  const counts: Record<string, number> = {};

  if (tagIds.length > 0) {
    const { data: assignments } = await supabase
      .from("prompt_tag_assignments")
      .select("tag_id")
      .in("tag_id", tagIds);

    for (const a of assignments ?? []) {
      const id = a.tag_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }

  const result: WorkspaceTagWithUsage[] = (tags ?? []).map((t) => ({
    id: t.id as string,
    workspace_id: t.workspace_id as string,
    name: t.name as string,
    color: t.color as string,
    created_at: t.created_at as string,
    prompt_count: counts[t.id as string] ?? 0,
  }));

  return { success: true, data: result };
}
