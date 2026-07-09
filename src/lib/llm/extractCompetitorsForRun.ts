import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";
import {
  cleanCompetitorCandidate,
  type CompetitorCandidateForClassification,
  classifyCompetitorCandidates,
  isAcceptedCompetitor,
  normalizeCompetitorName,
  shouldPrefilterCompetitorCandidate,
} from "@/lib/llm/classifyCompetitors";

/**
 * ¿El candidato normalizado es el mismo nombre, un fragmento/prefijo o una
 * variante más específica de una marca ya existente? Compara por token de
 * palabra completa en ambas direcciones para colapsar casos como
 * "Iber" ⊂ "Iberia" o "Iberia Express" ⊃ "Iberia", evitando crear un brand
 * duplicado que dispararía doble conteo de menciones.
 */
function isSubstringOfExistingBrand(normalized: string, existing: Set<string>): boolean {
  if (existing.has(normalized)) return true;
  for (const brand of existing) {
    if (!brand) continue;
    const shorter = brand.length <= normalized.length ? brand : normalized;
    const longer = brand.length <= normalized.length ? normalized : brand;
    // El token corto debe aparecer delimitado por palabras completas dentro del
    // largo. Los nombres normalizados están separados por un solo espacio, así
    // que basta comprobar con espacios de guarda. Exige >= 4 chars para no
    // colapsar por subcadenas triviales.
    if (shorter.length < 4) continue;
    if (` ${longer} `.includes(` ${shorter} `)) return true;
  }
  return false;
}

interface ExtractForRunInput {
  supabase: SupabaseClient;
  workspaceId: string;
  promptRunId: string;
  rawResponse: string;
  ownBrandName: string;
  workspaceDomain?: string | null;
  businessContext?: string | null;
}

export interface ExtractForRunResult {
  suggestedCompetitors: number;
  rejectedByBlocklist: number;
}

async function markRunExtracted(supabase: SupabaseClient, promptRunId: string): Promise<void> {
  await supabase
    .from("prompt_runs")
    .update({ competitors_extracted_at: new Date().toISOString() })
    .eq("id", promptRunId);
}

export async function extractCompetitorsForRun(
  input: ExtractForRunInput
): Promise<ExtractForRunResult> {
  const { supabase, workspaceId, promptRunId, rawResponse } = input;

  // 1. Extraer candidatos crudos con filtro de pre-selección
  const rawCandidates = extractPotentialCompetitorsFromResponse(rawResponse).filter(
    shouldPrefilterCompetitorCandidate
  );

  if (rawCandidates.length === 0) {
    await markRunExtracted(supabase, promptRunId);
    return { suggestedCompetitors: 0, rejectedByBlocklist: 0 };
  }

  // 2. Cargar marcas existentes, sugerencias pendientes y blocklist en paralelo
  const [{ data: existingBrands }, { data: pendingSuggestions }, { data: rejections }] =
    await Promise.all([
      supabase.from("brands").select("name").eq("workspace_id", workspaceId),
      supabase
        .from("competitor_suggestions")
        .select("normalized_name")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
      supabase
        .from("competitor_rejections")
        .select("normalized_name")
        .eq("workspace_id", workspaceId),
    ]);

  const existingNormalized = new Set(
    (existingBrands ?? []).map((b) => normalizeCompetitorName(String(b.name ?? "")))
  );
  const pendingNormalized = new Set(
    (pendingSuggestions ?? []).map((s) => s.normalized_name as string)
  );
  const blocklist = new Set(
    (rejections ?? []).map((r) => r.normalized_name as string)
  );

  // 3. Deduplicar y excluir los ya existentes o bloqueados
  const candidateMap = new Map<string, CompetitorCandidateForClassification>();
  let rejectedByBlocklist = 0;

  for (const rawCandidate of rawCandidates) {
    const candidate = cleanCompetitorCandidate(rawCandidate);
    if (!candidate) continue;
    const normalized = normalizeCompetitorName(candidate);
    // Colapsa fragmentos/prefijos/variantes de una marca ya existente
    // ("Iber" ⊂ "Iberia", "Iberia Express" ⊃ "Iberia") para no crear duplicados.
    if (!normalized || isSubstringOfExistingBrand(normalized, existingNormalized)) continue;
    if (blocklist.has(normalized)) {
      rejectedByBlocklist++;
      continue;
    }

    const existing = candidateMap.get(normalized);
    if (!existing) {
      candidateMap.set(normalized, { name: candidate, count: 1, examples: [] });
    } else {
      existing.count++;
    }
  }

  if (candidateMap.size === 0) {
    await markRunExtracted(supabase, promptRunId);
    return { suggestedCompetitors: 0, rejectedByBlocklist };
  }

  // 4. Clasificar con LLM — gate pre-inserción (no post-hoc)
  const classifications = await classifyCompetitorCandidates({
    ownBrandName: input.ownBrandName,
    workspaceDomain: input.workspaceDomain,
    businessContext: input.businessContext,
    candidates: [...candidateMap.values()],
  });

  const validByNormalized = new Map(
    classifications
      .filter(isAcceptedCompetitor)
      .map((c) => [normalizeCompetitorName(c.name), c])
  );

  // 5. Insertar sugerencias — solo validados por LLM que no estén ya pendientes
  const toSuggest = [...candidateMap.entries()]
    .filter(([norm]) => validByNormalized.has(norm) && !pendingNormalized.has(norm))
    .map(([norm, value]) => ({
      workspace_id: workspaceId,
      prompt_run_id: promptRunId,
      name: validByNormalized.get(norm)!.normalizedName || value.name,
      normalized_name: norm,
      status: "pending" as const,
      source: "auto_extraction" as const,
    }));

  if (toSuggest.length > 0) {
    await supabase.from("competitor_suggestions").insert(toSuggest);
  }

  // 6. Marcar el run como procesado
  await markRunExtracted(supabase, promptRunId);

  return { suggestedCompetitors: toSuggest.length, rejectedByBlocklist };
}
