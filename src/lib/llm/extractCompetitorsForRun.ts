import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";
import {
  type CompetitorCandidateForClassification,
  classifyCompetitorCandidates,
  normalizeCompetitorName,
  shouldPrefilterCompetitorCandidate,
} from "@/lib/llm/classifyCompetitors";

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
  insertedCompetitors: number;
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
    return { insertedCompetitors: 0, rejectedByBlocklist: 0 };
  }

  // 2. Cargar marcas existentes y blocklist en paralelo
  const [{ data: existingBrands }, { data: rejections }] = await Promise.all([
    supabase.from("brands").select("name").eq("workspace_id", workspaceId),
    supabase
      .from("competitor_rejections")
      .select("normalized_name")
      .eq("workspace_id", workspaceId),
  ]);

  const existingNormalized = new Set(
    (existingBrands ?? []).map((b) => normalizeCompetitorName(String(b.name ?? "")))
  );
  const blocklist = new Set(
    (rejections ?? []).map((r) => r.normalized_name as string)
  );

  // 3. Deduplicar y excluir los ya existentes o bloqueados
  const candidateMap = new Map<string, CompetitorCandidateForClassification>();
  let rejectedByBlocklist = 0;

  for (const candidate of rawCandidates) {
    const normalized = normalizeCompetitorName(candidate);
    if (!normalized || existingNormalized.has(normalized)) continue;
    if (blocklist.has(normalized)) {
      rejectedByBlocklist++;
      continue;
    }

    const existing = candidateMap.get(normalized);
    if (!existing) {
      candidateMap.set(normalized, { name: candidate.trim(), count: 1, examples: [] });
    } else {
      existing.count++;
    }
  }

  if (candidateMap.size === 0) {
    await markRunExtracted(supabase, promptRunId);
    return { insertedCompetitors: 0, rejectedByBlocklist };
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
      .filter((c) => c.isCompetitor && c.confidence !== "low")
      .map((c) => [normalizeCompetitorName(c.name), c])
  );

  // 5. Insertar solo los validados por el LLM
  const toInsert = [...candidateMap.entries()]
    .filter(([norm]) => validByNormalized.has(norm))
    .map(([norm, value]) => ({
      workspace_id: workspaceId,
      name: validByNormalized.get(norm)!.normalizedName || value.name,
      aliases: [] as string[],
      type: "competitor" as const,
    }));

  if (toInsert.length > 0) {
    await supabase.from("brands").upsert(toInsert, {
      onConflict: "workspace_id,name,type",
      ignoreDuplicates: true,
    });
  }

  // 6. Marcar el run como procesado
  await markRunExtracted(supabase, promptRunId);

  return { insertedCompetitors: toInsert.length, rejectedByBlocklist };
}
