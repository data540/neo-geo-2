"use server";

import { revalidatePath } from "next/cache";
import { findNonAirlinePrompts, isAllowedAirlineCountry } from "@/lib/airline/guardrails";
import { generatePromptCandidates } from "@/lib/geo/conversationalPromptGenerator";
import { auditPromptCoverage } from "@/lib/geo/promptCoverageAuditor";
import { prioritizePrompts } from "@/lib/geo/promptPrioritizer";
import { createClient } from "@/lib/supabase/server";
import { acceptPromptsSchema, geoResearchInputSchema } from "@/lib/validations/schemas";
import type {
  ActionResult,
  CoverageAuditResult,
  PrioritizedPrompt,
  PromptCandidate,
} from "@/types";

function hasCoverageKeyword(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

function validateRequiredAirlineCoverage(prompts: string[]): string[] {
  const checks: Array<{ key: string; pattern: RegExp; label: string }> = [
    { key: "cancellations", pattern: /cancel|anulad/, label: "cancelaciones/anulaciones" },
    { key: "baggage", pattern: /equipaje|maleta/, label: "equipaje" },
    { key: "checkin", pattern: /check-?in|embarque|boarding/, label: "check-in/embarque" },
    {
      key: "refunds",
      pattern: /reembolso|devolucion|compensacion|indemnizacion/,
      label: "reembolsos/compensaciones",
    },
  ];

  const missing = checks
    .filter((check) => !prompts.some((prompt) => hasCoverageKeyword(prompt, check.pattern)))
    .map((check) => check.label);

  return missing;
}

function validateFunnelCoverage(candidates: PromptCandidate[]): string[] {
  const selectedStages = new Set(
    candidates.map((candidate) => candidate.funnel_stage).filter(Boolean) as Array<
      "top" | "middle" | "bottom"
    >
  );

  const missing: string[] = [];
  if (!selectedStages.has("top")) missing.push("top");
  if (!selectedStages.has("middle")) missing.push("middle");
  if (!selectedStages.has("bottom")) missing.push("bottom");
  return missing;
}

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

  if (!isAllowedAirlineCountry(researchInput.country)) {
    return { success: false, error: "Mercado no permitido. Solo ES y CO." };
  }

  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const candidates = await generatePromptCandidates(researchInput);
  const nonAirlineCandidates = findNonAirlinePrompts(candidates.map((c) => c.prompt));
  if (nonAirlineCandidates.length > 0) {
    return {
      success: false,
      error:
        "La generacion devolvio prompts fuera del alcance aerolinea. Ajusta contexto y vuelve a intentar.",
    };
  }

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

  const result = await auditPromptCoverage({
    brandName,
    category,
    country: workspace?.country ?? "ES",
    targetAudience: workspace?.brand_statement ?? "",
    competitors: (competitors ?? []).map((c) => c.name as string),
    candidates: candidates as PromptCandidate[],
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

  const prioritized = await prioritizePrompts(candidates as PromptCandidate[], limit);

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

  const nonAirlineCandidates = findNonAirlinePrompts(
    (candidates as PromptCandidate[]).map((c) => c.prompt)
  );
  if (nonAirlineCandidates.length > 0) {
    return {
      success: false,
      error:
        "No se pueden activar prompts fuera del alcance aerolinea. Revisa la seleccion de candidatos.",
    };
  }

  const missingCoverage = validateRequiredAirlineCoverage(
    (candidates as PromptCandidate[]).map((c) => c.prompt)
  );
  if (missingCoverage.length > 0) {
    return {
      success: false,
      error: `No se puede activar: faltan prompts para ${missingCoverage.join(", ")}.`,
    };
  }

  const missingFunnelStages = validateFunnelCoverage(candidates as PromptCandidate[]);
  if (missingFunnelStages.length > 0) {
    return {
      success: false,
      error: `No se puede activar: faltan prompts en etapas del funnel (${missingFunnelStages.join(", ")}).`,
    };
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
