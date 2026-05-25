"use server";

import { revalidatePath } from "next/cache";
import { generatePromptCandidates } from "@/lib/geo/conversationalPromptGenerator";
import { auditPromptCoverage } from "@/lib/geo/promptCoverageAuditor";
import { prioritizePrompts } from "@/lib/geo/promptPrioritizer";
import {
  type InitialContext,
  prepareInitialContext,
  retrievePhaseKnowledge,
} from "@/lib/geo/promptResearchSkill";
import { inngest } from "@/inngest/client";
import { createClient } from "@/lib/supabase/server";
import { acceptPromptsSchema, geoResearchInputSchema } from "@/lib/validations/schemas";
import type {
  ActionResult,
  CoverageAuditResult,
  GeoResearchInput,
  PrioritizedPrompt,
  PromptCandidate,
} from "@/types";

async function requireManage(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  return data === true;
}

export async function generatePromptsAction(
  formData: FormData
): Promise<ActionResult<{ sessionId: string; candidates: PromptCandidate[] }>> {
  const raw = {
    workspaceId: formData.get("workspaceId") as string,
    brandName: formData.get("brandName") as string,
    domain: formData.get("domain") as string,
    brandStatement: formData.get("brandStatement") as string,
    country: (formData.get("country") as string) || "ES",
    location: formData.get("location") as string,
    category: formData.get("category") as string,
    productsServices: formData.get("productsServices") as string,
    targetAudience: formData.get("targetAudience") as string,
    competitors:
      (formData.get("competitors") as string)
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    differentiators: formData.get("differentiators") as string,
    numberOfPrompts: Number(formData.get("numberOfPrompts") || "10"),
  };

  const parsed = geoResearchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, ...researchInput } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const knowledgeChunks = await retrievePhaseKnowledge("generator", researchInput);
  const candidates = await generatePromptCandidates(researchInput, knowledgeChunks);

  const sessionId = crypto.randomUUID();
  const supabase = await createClient();

  const { error: insertError } = await supabase.from("prompt_candidates").insert(
    candidates.map((c) => ({
      workspace_id: workspaceId,
      session_id: sessionId,
      prompt: c.prompt,
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      persona: c.persona,
      includes_brand: c.includes_brand,
      includes_competitor: c.includes_competitor,
      strategic_value: c.strategic_value,
      conversion_intent: c.conversion_intent,
      ai_search_likelihood: c.ai_search_likelihood,
      priority_score: c.priority_score,
      reason: c.reason,
      coverage_area: c.coverage_area,
      selected: true,
    }))
  );

  if (insertError) {
    console.error("[generatePrompts] insertError:", insertError.message, insertError.code);
    return { success: false, error: `Error al guardar candidatos: ${insertError.message}` };
  }

  const { data: saved } = await supabase
    .from("prompt_candidates")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");

  return {
    success: true,
    data: { sessionId, candidates: (saved ?? []) as PromptCandidate[] },
  };
}

export async function auditCoverageAction(
  workspaceId: string,
  sessionId: string,
  brandName: string,
  category: string
): Promise<ActionResult<CoverageAuditResult>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();

  const { data: candidates } = await supabase
    .from("prompt_candidates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("session_id", sessionId)
    .eq("selected", true);

  if (!candidates || candidates.length === 0) {
    return { success: false, error: "No hay candidatos para auditar" };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("country, brand_statement")
    .eq("id", workspaceId)
    .single();

  const { data: competitors } = await supabase
    .from("brands")
    .select("name")
    .eq("workspace_id", workspaceId)
    .eq("type", "competitor");

  const auditorInputForRag: GeoResearchInput = {
    brandName,
    domain: "",
    brandStatement: workspace?.brand_statement ?? "",
    country: workspace?.country ?? "ES",
    location: "",
    category,
    productsServices: "",
    targetAudience: workspace?.brand_statement ?? "",
    competitors: (competitors ?? []).map((c) => c.name as string),
    differentiators: "",
    numberOfPrompts: candidates.length,
  };
  const knowledgeChunks = await retrievePhaseKnowledge("auditor", auditorInputForRag);

  const result = await auditPromptCoverage({
    brandName,
    category,
    country: workspace?.country ?? "ES",
    targetAudience: workspace?.brand_statement ?? "",
    competitors: (competitors ?? []).map((c) => c.name as string),
    candidates: candidates as PromptCandidate[],
    knowledgeChunks,
  });

  return { success: true, data: result };
}

export async function prioritizePromptsAction(
  workspaceId: string,
  sessionId: string,
  limit: number
): Promise<ActionResult<PrioritizedPrompt[]>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();

  const { data: candidates } = await supabase
    .from("prompt_candidates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("session_id", sessionId)
    .eq("selected", true);

  if (!candidates || candidates.length === 0) {
    return { success: false, error: "No hay candidatos para priorizar" };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("country, brand_name")
    .eq("id", workspaceId)
    .single();

  const prioritizerInputForRag: GeoResearchInput = {
    brandName: (workspace?.brand_name as string) ?? "",
    domain: "",
    brandStatement: "",
    country: workspace?.country ?? "ES",
    location: "",
    category: "Vuelos comerciales de pasajeros",
    productsServices: "",
    targetAudience: "",
    competitors: [],
    differentiators: "",
    numberOfPrompts: candidates.length,
  };
  const knowledgeChunks = await retrievePhaseKnowledge("prioritizer", prioritizerInputForRag);

  const prioritized = await prioritizePrompts(
    candidates as PromptCandidate[],
    limit,
    knowledgeChunks
  );

  // Actualizar priority_rank en DB
  for (const p of prioritized) {
    const match = (candidates as PromptCandidate[]).find((c) => c.prompt === p.prompt);
    if (match) {
      await supabase
        .from("prompt_candidates")
        .update({ priority_rank: p.priorityRank, risk_if_brand_absent: p.riskIfBrandAbsent })
        .eq("id", match.id)
        .eq("session_id", sessionId);
    }
  }

  return { success: true, data: prioritized };
}

export async function acceptPromptsAction(data: unknown): Promise<ActionResult> {
  const parsed = acceptPromptsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { workspaceId, sessionId, selectedIds } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();

  const { data: candidates } = await supabase
    .from("prompt_candidates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("session_id", sessionId)
    .in("id", selectedIds);

  if (!candidates || candidates.length === 0) {
    return { success: false, error: "No se encontraron candidatos seleccionados" };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug, country")
    .eq("id", workspaceId)
    .single();

  // Insertar en tabla prompts
  await supabase.from("prompts").insert(
    (candidates as PromptCandidate[]).map((c) => ({
      workspace_id: workspaceId,
      text: c.prompt,
      country: c.country || workspace?.country || "ES",
      status: "active",
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      persona: c.persona,
      includes_brand: c.includes_brand,
      includes_competitor: c.includes_competitor,
      strategic_value: c.strategic_value,
      conversion_intent: c.conversion_intent,
      ai_search_likelihood: c.ai_search_likelihood,
      priority_score: c.priority_score,
      research_reason: c.reason,
      coverage_area: c.coverage_area,
    }))
  );

  // Marcar candidatos como activados
  await supabase
    .from("prompt_candidates")
    .update({ activated: true })
    .eq("session_id", sessionId)
    .in("id", selectedIds);

  if (workspace?.slug) {
    revalidatePath(`/${workspace.slug}/prompts`);
    revalidatePath(`/${workspace.slug}/prompt-research`);
  }

  return { success: true };
}

export async function getInitialContextAction(
  workspaceId: string
): Promise<ActionResult<InitialContext>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const context = await prepareInitialContext(workspaceId);
  return { success: true, data: context };
}

export async function runFullAutoResearchAction(
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  const raw = {
    workspaceId: formData.get("workspaceId") as string,
    brandName: formData.get("brandName") as string,
    domain: formData.get("domain") as string,
    brandStatement: formData.get("brandStatement") as string,
    country: (formData.get("country") as string) || "ES",
    location: formData.get("location") as string,
    category: formData.get("category") as string,
    productsServices: formData.get("productsServices") as string,
    targetAudience: formData.get("targetAudience") as string,
    competitors:
      (formData.get("competitors") as string)
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    differentiators: formData.get("differentiators") as string,
    numberOfPrompts: Number(formData.get("numberOfPrompts") || "30"),
  };

  const parsed = geoResearchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, ...researchInput } = parsed.data;

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();

  // Obtener datos para el input canónico del caché
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug, knowledge_revision")
    .eq("id", workspaceId)
    .single();

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const sessionId = crypto.randomUUID();

  // Crear fila inicial en pipeline_runs para que el cliente pueda suscribirse inmediatamente
  await supabase.from("pipeline_runs").insert({
    workspace_id: workspaceId,
    session_id: sessionId,
    phase: "init",
    status: "queued",
    created_at: new Date().toISOString(),
  });

  // Disparar el pipeline Inngest de forma asíncrona (respuesta inmediata)
  await inngest.send({
    name: "geo/research.start",
    data: {
      workspaceId,
      workspaceSlug: workspace?.slug ?? "",
      sessionId,
      researchInput,
      kbRevision: (workspace?.knowledge_revision as string | null) ?? "v0",
      brandProfileRevision: brandProfile?.updated_at
        ? new Date(brandProfile.updated_at as string).toISOString().slice(0, 10)
        : "",
    },
  });

  return { success: true, data: { sessionId } };
}

export async function cancelAutoResearchAction(
  workspaceId: string,
  sessionId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  await inngest.send({
    name: "geo/research.cancel",
    data: { sessionId },
  });

  return { success: true };
}
