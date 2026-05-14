"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";
import { createCompetitorSchema, updateCompetitorSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

const AIRLINE_NAME_HINTS = [
  "air",
  "airlines",
  "airways",
  "avianca",
  "iberia",
  "latam",
  "ryanair",
  "vueling",
  "wizz",
  "easyjet",
  "klm",
  "lufthansa",
  "turkish",
  "aeromexico",
  "volaris",
  "copa",
  "delta",
  "united",
  "american",
  "jetblue",
  "emirates",
  "qatar",
  "etihad",
  "air europa",
  "air france",
  "sky",
  "flight",
  "airline",
  "aeroline",
];

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function shouldKeepCompetitorCandidate(name: string): boolean {
  const normalized = normalizeName(name);
  if (normalized.length < 3) return false;
  if (/(^|\s)(compara|comparar|elige|mejor|opcion|opciones|vuelo|vuelos|ruta|rutas)($|\s)/i.test(normalized)) {
    return false;
  }
  if (/^(espana|colombia|madrid|bogota|barcelona|medellin|aeropuerto)$/i.test(normalized)) {
    return false;
  }
  return AIRLINE_NAME_HINTS.some((hint) => normalized.includes(hint));
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

  if (brandError) {
    return { success: false, error: "No se pudo crear el competidor" };
  }

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

export async function extractCompetitorsFromExecutedPromptsAction(
  workspaceId: string
): Promise<
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

  const [
    { data: ownBrands },
    { data: competitorBrands },
    { data: pendingSuggestions, error: pendingSuggestionsError },
  ] =
    await Promise.all([
      supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "own"),
      supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "competitor"),
      supabase
        .from("competitor_suggestions")
        .select("normalized_name")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
    ]);

  const existingNames = new Set(
    [
      ...(ownBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
      ...(competitorBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
      ...((pendingSuggestionsError ? [] : pendingSuggestions) ?? []).map((s) =>
        normalizeName(String(s.normalized_name ?? ""))
      ),
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
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const chunk = (data ?? []) as PromptRunForExtraction[];
    if (chunk.length === 0) break;
    runs.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const candidateMap = new Map<string, { name: string; count: number; firstRunId: string }>();

  for (const run of runs) {
    if (!run.raw_response) continue;

    const candidates = extractPotentialCompetitorsFromResponse(run.raw_response);
    for (const candidate of candidates) {
      const normalized = normalizeName(candidate);
      if (!normalized || existingNames.has(normalized)) continue;
      if (!shouldKeepCompetitorCandidate(candidate)) continue;

      const existing = candidateMap.get(normalized);
      if (!existing) {
        candidateMap.set(normalized, {
          name: candidate.trim(),
          count: 1,
          firstRunId: run.id,
        });
      } else {
        existing.count += 1;
        if (candidate.length > existing.name.length) {
          existing.name = candidate.trim();
        }
      }
    }
  }

  const entries = Array.from(candidateMap.entries());
  const competitorsToCreate = entries
    .filter(([, value]) => value.count >= 2)
    .map(([normalizedName, value]) => ({ normalizedName, ...value }));
  const suggestionsToCreate = entries
    .filter(([, value]) => value.count < 2)
    .map(([normalizedName, value]) => ({ normalizedName, ...value }));

  if (competitorsToCreate.length > 0) {
    const { error: insertCompetitorsError } = await supabase.from("brands").insert(
      competitorsToCreate.map((candidate) => ({
        workspace_id: workspaceId,
        name: candidate.name,
        aliases: [],
        type: "competitor",
      }))
    );

    if (insertCompetitorsError) {
      return { success: false, error: "No se pudieron crear competidores desde los runs" };
    }
  }

  let createdSuggestions = 0;
  if (suggestionsToCreate.length > 0 && !pendingSuggestionsError) {
    const { error: insertSuggestionsError } = await supabase.from("competitor_suggestions").insert(
      suggestionsToCreate.map((candidate) => ({
        workspace_id: workspaceId,
        prompt_run_id: candidate.firstRunId,
        name: candidate.name,
        normalized_name: candidate.normalizedName,
        status: "pending",
      }))
    );

    if (!insertSuggestionsError) {
      createdSuggestions = suggestionsToCreate.length;
    }
  }

  const slug = await getWorkspaceSlug(workspaceId);
  if (slug) revalidatePath(`/${slug}/competitors`);

  return {
    success: true,
    data: {
      analyzedRuns: runs.length,
      detectedCandidates: entries.length,
      createdCompetitors: competitorsToCreate.length,
      createdSuggestions,
    },
  };
}
