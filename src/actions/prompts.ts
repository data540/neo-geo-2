"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { detectBrands } from "@/lib/detection/detectBrands";
import { runPrompt } from "@/lib/llm/runner";
import { calculateConsistency, calculateSOV } from "@/lib/metrics/calculate";
import { createClient } from "@/lib/supabase/server";
import {
  createPromptSchema,
  runPromptSchema,
  togglePromptStatusSchema,
} from "@/lib/validations/schemas";
import type { ActionResult, Brand, LlmProviderKey } from "@/types";

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

  // 1. Obtener contexto
  const [{ data: prompt }, { data: workspace }, { data: ownBrands }, { data: competitorBrands }, { data: llmProvider }] =
    await Promise.all([
      supabase.from("prompts").select("*").eq("id", promptId).single(),
      supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
      supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "own"),
      supabase.from("brands").select("*").eq("workspace_id", workspaceId).eq("type", "competitor"),
      supabase.from("llm_providers").select("*").eq("key", llmKey).single(),
    ]);

  if (!prompt || !workspace || !llmProvider) {
    return { success: false, error: "Datos del prompt no encontrados" };
  }

  const ownBrand = (ownBrands ?? [])[0] as Brand | undefined;
  if (!ownBrand) return { success: false, error: "No hay brand propia en el workspace" };

  // 2. Crear prompt_run
  const { data: run, error: runError } = await supabase
    .from("prompt_runs")
    .insert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: llmProvider.id,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runError || !run) return { success: false, error: "No se pudo crear el run" };

  try {
    // 3. Llamar al LLM
    const llmResult = await runPrompt({
      provider: llmKey as LlmProviderKey,
      prompt: prompt.text as string,
      workspace: { id: workspace.id as string, slug: workspace.slug as string },
      brand: { name: ownBrand.name, aliases: ownBrand.aliases },
      competitors: (competitorBrands ?? []).map((c: Brand) => ({ name: c.name, aliases: c.aliases })),
    });

    // 4. Guardar respuesta
    await supabase.from("prompt_runs").update({
      raw_response: llmResult.rawResponse,
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    // 5. Detectar marcas
    const detection = detectBrands({
      rawResponse: llmResult.rawResponse,
      ownBrand: { id: ownBrand.id, name: ownBrand.name, aliases: ownBrand.aliases },
      competitors: (competitorBrands ?? []).map((c: Brand) => ({ id: c.id, name: c.name, aliases: c.aliases })),
    });

    // 6. Insertar mentions
    const mentions: Record<string, unknown>[] = [];
    if (detection.ownBrandMentioned) {
      mentions.push({
        workspace_id: workspaceId, prompt_run_id: run.id, brand_id: ownBrand.id,
        brand_name_detected: detection.detectedBrandName, brand_type: "own",
        position: detection.ownBrandPosition,
        sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
        confidence: detection.confidence,
      });
    }
    for (const comp of detection.competitors) {
      mentions.push({
        workspace_id: workspaceId, prompt_run_id: run.id, brand_id: comp.brandId,
        brand_name_detected: comp.name, brand_type: "competitor",
        position: comp.position, sentiment: comp.sentiment, confidence: comp.confidence,
      });
    }
    if (mentions.length > 0) await supabase.from("mentions").insert(mentions);

    // 7. Upsert daily_prompt_metrics
    const today = new Date().toISOString().slice(0, 10);
    const sov = calculateSOV(detection.ownBrandMentioned ? 1 : 0, detection.competitors.length);
    const { data: recentRuns } = await supabase
      .from("prompt_runs").select("id").eq("prompt_id", promptId)
      .eq("llm_provider_id", llmProvider.id).eq("status", "completed")
      .order("completed_at", { ascending: false }).limit(5);
    const recentRunIds = (recentRuns ?? []).map((r) => r.id as string);
    let mentionCount = 0;
    if (recentRunIds.length > 0) {
      const { count } = await supabase.from("mentions").select("*", { count: "exact", head: true })
        .in("prompt_run_id", recentRunIds).eq("brand_type", "own");
      mentionCount = count ?? 0;
    }
    await supabase.from("daily_prompt_metrics").upsert({
      workspace_id: workspaceId, prompt_id: promptId, llm_provider_id: llmProvider.id,
      date: today, brand_mentioned: detection.ownBrandMentioned,
      brand_position: detection.ownBrandPosition, competitor_count: detection.competitors.length,
      sov, sentiment: detection.sentiment !== "no_data" ? detection.sentiment : null,
      consistency_score: calculateConsistency(mentionCount, recentRunIds.length || 1),
    }, { onConflict: "prompt_id,llm_provider_id,date" });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[runPromptNow] error:", errMsg);
    await supabase.from("prompt_runs").update({ status: "failed", error_message: errMsg }).eq("id", run.id);
    return { success: false, error: errMsg };
  }

  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).single();
  if (ws?.slug) {
    revalidatePath(`/${ws.slug}/prompts`);
    revalidatePath(`/${ws.slug}/dashboard`);
  }

  return { success: true };
}
