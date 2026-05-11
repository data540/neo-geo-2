"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCompetitorSchema, updateCompetitorSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

async function requireManage(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  return data === true;
}

async function getWorkspaceSlug(workspaceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).single();
  return data?.slug ?? null;
}

export async function createCompetitorAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    workspaceId: formData.get("workspaceId") as string,
    name: formData.get("name") as string,
    domain: formData.get("domain") as string,
    aliases:
      (formData.get("aliases") as string)
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
  };

  const parsed = createCompetitorSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, name, domain, aliases } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({
      workspace_id: workspaceId,
      name,
      domain: domain || null,
      aliases,
      type: "competitor",
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: "Error al crear competidor" };

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return { success: true, data: { id: data.id } };
}

export async function updateCompetitorAction(data: unknown): Promise<ActionResult> {
  const parsed = updateCompetitorSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { brandId, workspaceId, name, domain, aliases } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({
      ...(name && { name }),
      ...(domain !== undefined && { domain: domain || null }),
      ...(aliases !== undefined && { aliases }),
    })
    .eq("id", brandId)
    .eq("workspace_id", workspaceId)
    .eq("type", "competitor");

  if (error) return { success: false, error: "Error al actualizar competidor" };

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return { success: true };
}

export async function deleteCompetitorAction(
  brandId: string,
  workspaceId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .delete()
    .eq("id", brandId)
    .eq("workspace_id", workspaceId)
    .eq("type", "competitor");

  if (error) return { success: false, error: "Error al eliminar competidor" };

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return { success: true };
}
