import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";
import {
  type CompetitorCandidateForClassification,
  classifyCompetitorCandidates,
  isAcceptedCompetitor,
  normalizeCompetitorName,
  shouldPrefilterCompetitorCandidate,
} from "@/lib/llm/classifyCompetitors";

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface WorkspaceRow {
  id: string;
  slug: string;
  domain: string | null;
  brand_statement: string | null;
}

interface RunRow {
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

async function processWorkspace(
  workspace: WorkspaceRow
): Promise<{
  analyzedRuns: number;
  extractedCandidates: number;
  suggestedCompetitors: number;
}> {
  const supabase = getServiceClient();

  const [
    { data: ownBrands },
    { data: existingCompetitors },
    { data: pendingSuggestions },
    { data: rejections },
  ] = await Promise.all([
    supabase.from("brands").select("name").eq("workspace_id", workspace.id).eq("type", "own"),
    supabase
      .from("brands")
      .select("name")
      .eq("workspace_id", workspace.id)
      .eq("type", "competitor"),
    supabase
      .from("competitor_suggestions")
      .select("normalized_name")
      .eq("workspace_id", workspace.id)
      .eq("status", "pending"),
    supabase
      .from("competitor_rejections")
      .select("normalized_name")
      .eq("workspace_id", workspace.id),
  ]);

  const existingNames = new Set(
    [
      ...(ownBrands ?? []).map((b) => normalizeCompetitorName(String(b.name ?? ""))),
      ...(existingCompetitors ?? []).map((b) => normalizeCompetitorName(String(b.name ?? ""))),
    ].filter(Boolean)
  );
  const pendingNames = new Set(
    (pendingSuggestions ?? []).map((s) => s.normalized_name as string).filter(Boolean)
  );
  const blocklist = new Set(
    (rejections ?? []).map((r) => r.normalized_name as string).filter(Boolean)
  );

  const candidateMap = new Map<string, { name: string; count: number; examples: string[] }>();
  const pageSize = 500;
  let analyzedRuns = 0;
  let offset = 0;
  const processedRunIds: string[] = [];

  while (true) {
    const { data } = await supabase
      .from("prompt_runs")
      .select("id, raw_response")
      .eq("workspace_id", workspace.id)
      .eq("status", "completed")
      .not("raw_response", "is", null)
      .is("competitors_extracted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const chunk = (data ?? []) as RunRow[];
    if (chunk.length === 0) break;
    analyzedRuns += chunk.length;

    for (const run of chunk) {
      processedRunIds.push(run.id);
      const rawResponse = String(run.raw_response ?? "");
      for (const candidate of extractPotentialCompetitorsFromResponse(rawResponse)) {
        if (!shouldPrefilterCompetitorCandidate(candidate)) continue;
        const normalized = normalizeCompetitorName(candidate);
        if (!normalized || existingNames.has(normalized) || blocklist.has(normalized)) continue;

        const existing = candidateMap.get(normalized);
        if (!existing) {
          candidateMap.set(normalized, {
            name: candidate.trim(),
            count: 1,
            examples: [snippetForCandidate(rawResponse, candidate)],
          });
        } else {
          existing.count += 1;
          if (existing.examples.length < 3) {
            existing.examples.push(snippetForCandidate(rawResponse, candidate));
          }
          if (candidate.length > existing.name.length) existing.name = candidate.trim();
        }
      }
    }

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const markProcessed = async () => {
    if (processedRunIds.length === 0) return;
    const MARK_BATCH = 1000;
    const ts = new Date().toISOString();
    for (let i = 0; i < processedRunIds.length; i += MARK_BATCH) {
      await supabase
        .from("prompt_runs")
        .update({ competitors_extracted_at: ts })
        .in("id", processedRunIds.slice(i, i + MARK_BATCH));
    }
  };

  const candidates: CompetitorCandidateForClassification[] = [...candidateMap.values()];
  if (candidates.length === 0) {
    await markProcessed();
    return { analyzedRuns, extractedCandidates: 0, suggestedCompetitors: 0 };
  }

  const classifications = await classifyCompetitorCandidates({
    ownBrandName: String(ownBrands?.[0]?.name ?? ""),
    workspaceDomain: workspace.domain,
    businessContext: workspace.brand_statement,
    candidates,
  });
  const validByName = new Map(
    classifications
      .filter(isAcceptedCompetitor)
      .map((c) => [normalizeCompetitorName(c.name), c])
  );

  // Solo sugerir los que no estén ya como pendientes
  const toSuggest = [...candidateMap.entries()]
    .filter(([normalizedName]) => validByName.has(normalizedName) && !pendingNames.has(normalizedName))
    .map(([normalizedName, value]) => ({
      workspace_id: workspace.id,
      prompt_run_id: null,
      name: validByName.get(normalizedName)?.normalizedName || value.name,
      normalized_name: normalizedName,
      status: "pending" as const,
      source: "auto_extraction" as const,
    }));

  if (toSuggest.length === 0) {
    await markProcessed();
    return { analyzedRuns, extractedCandidates: candidates.length, suggestedCompetitors: 0 };
  }

  const { error } = await supabase.from("competitor_suggestions").insert(toSuggest);

  if (error) {
    console.error(
      `[extractCompetitorsFromPromptRunsDaily] ${workspace.slug} insert failed:`,
      error.message
    );
    await markProcessed();
    return { analyzedRuns, extractedCandidates: candidates.length, suggestedCompetitors: 0 };
  }

  await markProcessed();
  return {
    analyzedRuns,
    extractedCandidates: candidates.length,
    suggestedCompetitors: toSuggest.length,
  };
}

export const extractCompetitorsFromPromptRunsDaily = inngest.createFunction(
  {
    id: "extract-competitors-from-prompt-runs-daily",
    name: "Extract Competitors From Prompt Runs Daily",
    triggers: [{ cron: "30 3 * * *" }],
  },
  async ({ step }) => {
    const supabase = getServiceClient();

    const workspaces = await step.run("fetch-workspaces", async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("id, slug, domain, brand_statement")
        .order("created_at", { ascending: true });
      return (data ?? []) as WorkspaceRow[];
    });

    let totalRuns = 0;
    let totalCandidates = 0;
    let totalSuggested = 0;

    for (const workspace of workspaces) {
      const result = await step.run(`process-workspace-${workspace.slug}`, async () =>
        processWorkspace(workspace)
      );

      totalRuns += result.analyzedRuns;
      totalCandidates += result.extractedCandidates;
      totalSuggested += result.suggestedCompetitors;
    }

    return {
      workspaces: workspaces.length,
      analyzedRuns: totalRuns,
      extractedCandidates: totalCandidates,
      suggestedCompetitors: totalSuggested,
    };
  }
);
