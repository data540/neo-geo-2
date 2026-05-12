"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAirlinePromptText, isAllowedAirlineCountry } from "@/lib/airline/guardrails";
import { executePromptRun } from "@/lib/llm/executePromptRun";
import { createClient } from "@/lib/supabase/server";
import {
  createPromptSchema,
  runPromptSchema,
  togglePromptStatusSchema,
} from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireManage(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  return data === true;
}

export async function createPromptAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    text: formData.get("text") as string,
    country: (formData.get("country") as string) || "ES",
    workspaceId: formData.get("workspaceId") as string,
  };

  const parsed = createPromptSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { text, country, workspaceId } = parsed.data;

  if (!isAllowedAirlineCountry(country)) {
    return { success: false, error: "Mercado no permitido. Solo ES y CO." };
  }

  if (!isAirlinePromptText(text)) {
    return {
      success: false,
      error:
        "El prompt debe estar relacionado con aerolineas (vuelos, equipaje, check-in, cancelaciones, reembolsos, etc.).",
    };
  }

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompts")
    .insert({ workspace_id: workspaceId, text, country, status: "active" })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: "Error al crear el prompt" };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (workspace) {
    revalidatePath(`/${workspace.slug}/prompts`);
  }

  return { success: true, data: { id: data.id } };
}

export async function deletePromptAction(
  promptId: string,
  workspaceId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompts")
    .delete()
    .eq("id", promptId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { success: false, error: "Error al eliminar el prompt" };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (workspace) {
    revalidatePath(`/${workspace.slug}/prompts`);
  }

  return { success: true };
}

export async function togglePromptStatusAction(data: unknown): Promise<ActionResult> {
  const parsed = togglePromptStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { promptId, workspaceId, status } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prompts")
    .update({ status })
    .eq("id", promptId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { success: false, error: "Error al actualizar el estado" };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (workspace) {
    revalidatePath(`/${workspace.slug}/prompts`);
  }

  return { success: true };
}

export async function runPromptNowAction(data: unknown): Promise<ActionResult> {
  const parsed = runPromptSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { promptId, workspaceId, llmKey } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) {
    return { success: false, error: "Sin permisos" };
  }

  const supabase = getServiceClient();

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", llmKey)
    .single();

  if (!provider) return { success: false, error: "Proveedor LLM no encontrado" };

  const { data: run, error: runError } = await supabase
    .from("prompt_runs")
    .insert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: provider.id,
      status: "queued",
    })
    .select("id")
    .single();

  if (runError || !run) return { success: false, error: "No se pudo crear el run" };

  // Fire & forget — el run se ejecuta en background, la UI hace polling
  void executePromptRun(run.id);

  const { data: ws } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (ws?.slug) {
    revalidatePath(`/${ws.slug}/prompts`);
  }

  return { success: true };
}
