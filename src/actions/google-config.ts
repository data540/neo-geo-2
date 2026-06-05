"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const updateGoogleConfigSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(1),
  // GSC site URL: "sc-domain:ejemplo.com" o "https://www.ejemplo.com/"
  gscSiteUrl: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  // GA4 property ID: solo dígitos
  ga4PropertyId: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^\d+$/.test(v), {
      message: "El GA4 property ID debe ser solo números (ej. 123456789)",
    }),
});

export async function updateGoogleConfigAction(input: unknown): Promise<ActionResult> {
  const parsed = updateGoogleConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, workspaceSlug, gscSiteUrl, ga4PropertyId } = parsed.data;
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const { error } = await supabase
    .from("workspaces")
    .update({ gsc_site_url: gscSiteUrl, ga4_property_id: ga4PropertyId })
    .eq("id", workspaceId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/${workspaceSlug}/settings`);
  revalidatePath(`/${workspaceSlug}/analytics`);
  return { success: true };
}

// Dispara el refresco manual de datos Google para este workspace.
export async function triggerGoogleRefreshAction(workspaceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  await inngest.send({ name: "google/analytics.refresh", data: { workspaceId } });
  return { success: true };
}
