"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";
import {
  type CompetitorCandidateForClassification,
  classifyCompetitorCandidates,
  normalizeCompetitorName,
  shouldPrefilterCompetitorCandidate,
} from "@/lib/llm/classifyCompetitors";
import { createClient } from "@/lib/supabase/server";
import { createCompetitorSchema, updateCompetitorSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

function normalizeName(value: string): string {
  return normalizeCompetitorName(value);
}

function shouldKeepCompetitorCandidate(name: string): boolean {
  return shouldPrefilterCompetitorCandidate(name);
}

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
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
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
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
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

const deleteCompetitorsBulkSchema = z.object({
  workspaceId: z.string().uuid(),
  brandIds: z.array(z.string().uuid()).min(1).max(10_000),
});

const DELETE_BATCH_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function deleteCompetitorsBulkAction(
  input: unknown
): Promise<ActionResult<{ deletedCompetitors: number; deletedMentions: number }>> {
  const parsed = deleteCompetitorsBulkSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { workspaceId, brandIds } = parsed.data;
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const uniqueBrandIds = Array.from(new Set(brandIds));
  const supabase = await createClient();

  let deletedMentionsCount = 0;
  let deletedCompetitorsCount = 0;

  for (const batch of chunkArray(uniqueBrandIds, DELETE_BATCH_SIZE)) {
    const { data: deletedMentions, error: mentionError } = await supabase
      .from("mentions")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("brand_id", batch)
      .select("id");

    if (mentionError) return { success: false, error: "Error al eliminar menciones" };
    deletedMentionsCount += deletedMentions?.length ?? 0;
  }

  const rejectionEntries: { workspace_id: string; normalized_name: string }[] = [];

  for (const batch of chunkArray(uniqueBrandIds, DELETE_BATCH_SIZE)) {
    // Obtener nombres antes del DELETE para registrarlos en el blocklist
    const { data: toReject } = await supabase
      .from("brands")
      .select("name")
      .in("id", batch)
      .eq("workspace_id", workspaceId)
      .eq("type", "competitor");

    const { data: deletedCompetitors, error } = await supabase
      .from("brands")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("type", "competitor")
      .in("id", batch)
      .select("id");

    if (error) return { success: false, error: "Error al eliminar competidores" };
    deletedCompetitorsCount += deletedCompetitors?.length ?? 0;

    for (const b of toReject ?? []) {
      const normalized = normalizeCompetitorName(String(b.name ?? ""));
      if (normalized) rejectionEntries.push({ workspace_id: workspaceId, normalized_name: normalized });
    }
  }

  // Registrar en blocklist para que el CRON y la extracción en tiempo real no los re-inserten
  if (rejectionEntries.length > 0) {
    await supabase.from("competitor_rejections").upsert(rejectionEntries, {
      onConflict: "workspace_id,normalized_name",
      ignoreDuplicates: true,
    });
  }

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return {
    success: true,
    data: {
      deletedCompetitors: deletedCompetitorsCount,
      deletedMentions: deletedMentionsCount,
    },
  };
}

export async function deleteCompetitorAction(
  brandId: string,
  workspaceId: string
): Promise<ActionResult> {
  const result = await deleteCompetitorsBulkAction({ workspaceId, brandIds: [brandId] });
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function approveCompetitorSuggestionAction(
  suggestionId: string,
  workspaceId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: suggestion } = await supabase
    .from("competitor_suggestions")
    .select("id, name, status")
    .eq("id", suggestionId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!suggestion || suggestion.status !== "pending") {
    return { success: false, error: "Sugerencia no disponible" };
  }

  const { error: brandError } = await supabase.from("brands").insert({
    workspace_id: workspaceId,
    name: suggestion.name,
    aliases: [],
    type: "competitor",
  });

  if (brandError) return { success: false, error: "No se pudo crear el competidor" };

  await supabase
    .from("competitor_suggestions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", suggestionId)
    .eq("workspace_id", workspaceId);

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return { success: true };
}

export async function rejectCompetitorSuggestionAction(
  suggestionId: string,
  workspaceId: string
): Promise<ActionResult> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("competitor_suggestions")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", suggestionId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending");

  if (error) return { success: false, error: "No se pudo rechazar la sugerencia" };

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return { success: true };
}

interface PromptRunForExtraction {
  id: string;
  raw_response: string | null;
}

function snippetForCandidate(rawResponse: string, candidate: string): string {
  const index = rawResponse.toLowerCase().indexOf(candidate.toLowerCase());
  if (index < 0) return rawResponse.replace(/\s+/g, " ").trim().slice(0, 240);
  const start = Math.max(0, index - 120);
  const end = Math.min(rawResponse.length, index + candidate.length + 160);
  return rawResponse.slice(start, end).replace(/\s+/g, " ").trim();
}

function addCandidate(
  candidateMap: Map<string, { name: string; count: number; examples: string[] }>,
  candidate: string,
  rawResponse: string
) {
  const normalized = normalizeName(candidate);
  if (!normalized || !shouldKeepCompetitorCandidate(candidate)) return;

  const existing = candidateMap.get(normalized);
  if (!existing) {
    candidateMap.set(normalized, {
      name: candidate.trim(),
      count: 1,
      examples: [snippetForCandidate(rawResponse, candidate)],
    });
    return;
  }

  existing.count += 1;
  if (existing.examples.length < 3) existing.examples.push(snippetForCandidate(rawResponse, candidate));
  if (candidate.length > existing.name.length) existing.name = candidate.trim();
}

async function getWorkspaceClassificationContext(workspaceId: string) {
  const supabase = await createClient();
  const [{ data: workspace }, { data: ownBrands }, { data: competitorBrands }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("domain, brand_statement")
        .eq("id", workspaceId)
        .single(),
      supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "own"),
      supabase
        .from("brands")
        .select("name")
        .eq("workspace_id", workspaceId)
        .eq("type", "competitor"),
    ]);

  return { workspace, ownBrands, competitorBrands };
}

export async function extractCompetitorsFromExecutedPromptsAction(workspaceId: string): Promise<
  ActionResult<{
    analyzedRuns: number;
    detectedCandidates: number;
    createdCompetitors: number;
    createdSuggestions: number;
  }>
> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { workspace, ownBrands, competitorBrands } =
    await getWorkspaceClassificationContext(workspaceId);

  const existingNames = new Set(
    [
      ...(ownBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
      ...(competitorBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
    ].filter(Boolean)
  );

  const runs: PromptRunForExtraction[] = [];
  const pageSize = 500;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("prompt_runs")
      .select("id, raw_response")
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .not("raw_response", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const chunk = (data ?? []) as PromptRunForExtraction[];
    if (chunk.length === 0) break;
    runs.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const candidateMap = new Map<string, { name: string; count: number; examples: string[] }>();
  for (const run of runs) {
    if (!run.raw_response) continue;
    for (const candidate of extractPotentialCompetitorsFromResponse(run.raw_response)) {
      const normalized = normalizeName(candidate);
      if (!normalized || existingNames.has(normalized)) continue;
      addCandidate(candidateMap, candidate, run.raw_response);
    }
  }

  const candidates: CompetitorCandidateForClassification[] = [...candidateMap.values()];
  const classifications = await classifyCompetitorCandidates({
    ownBrandName: String(ownBrands?.[0]?.name ?? ""),
    workspaceDomain: workspace?.domain ?? null,
    businessContext: workspace?.brand_statement ?? null,
    candidates,
  });
  const validByName = new Map(
    classifications
      .filter((c) => c.isCompetitor && c.confidence !== "low")
      .map((c) => [normalizeName(c.name), c])
  );
  const competitorsToCreate = [...candidateMap.entries()]
    .filter(([normalizedName]) => validByName.has(normalizedName))
    .map(([normalizedName, value]) => ({
      name: validByName.get(normalizedName)?.normalizedName || value.name,
    }));

  if (competitorsToCreate.length > 0) {
    const { error } = await supabase.from("brands").insert(
      competitorsToCreate.map((candidate) => ({
        workspace_id: workspaceId,
        name: candidate.name,
        aliases: [],
        type: "competitor",
      }))
    );
    if (error) return { success: false, error: "No se pudieron crear competidores desde los runs" };
  }

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return {
    success: true,
    data: {
      analyzedRuns: runs.length,
      detectedCandidates: candidateMap.size,
      createdCompetitors: competitorsToCreate.length,
      createdSuggestions: 0,
    },
  };
}

export async function auditExistingCompetitorsAction(workspaceId: string): Promise<
  ActionResult<{
    invalidCompetitors: Array<{ brandId: string; name: string; reason: string }>;
    checked: number;
  }>
> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  const supabase = await createClient();
  const { workspace, ownBrands } = await getWorkspaceClassificationContext(workspaceId);
  const { data: competitors } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("type", "competitor")
    .order("name");

  const rows = (competitors ?? []) as Array<{ id: string; name: string }>;
  if (rows.length === 0) {
    return { success: true, data: { invalidCompetitors: [], checked: 0 } };
  }

  const classifications = await classifyCompetitorCandidates({
    ownBrandName: String(ownBrands?.[0]?.name ?? ""),
    workspaceDomain: workspace?.domain ?? null,
    businessContext: workspace?.brand_statement ?? null,
    candidates: rows.map((row) => ({ name: row.name, count: 1, examples: [] })),
    maxCandidates: 500,
  });
  const byName = new Map(classifications.map((c) => [normalizeName(c.name), c]));
  const invalidCompetitors = rows.flatMap((row) => {
    const classification = byName.get(normalizeName(row.name));
    if (classification?.isCompetitor) return [];
    return [
      {
        brandId: row.id,
        name: row.name,
        reason: classification?.reason || "No parece un competidor real",
      },
    ];
  });

  return { success: true, data: { invalidCompetitors, checked: rows.length } };
}
