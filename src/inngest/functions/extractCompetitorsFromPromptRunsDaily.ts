import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";

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
  "airline",
  "aeroline",
];

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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

interface WorkspaceRow {
  id: string;
  slug: string;
}

interface RunRow {
  raw_response: string | null;
}

async function processWorkspace(workspaceId: string, slug: string): Promise<{
  analyzedRuns: number;
  extractedCandidates: number;
  insertedCompetitors: number;
}> {
  const supabase = getServiceClient();

  const [{ data: ownBrands }, { data: existingCompetitors }] = await Promise.all([
    supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "own"),
    supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "competitor"),
  ]);

  const existingNames = new Set(
    [
      ...(ownBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
      ...(existingCompetitors ?? []).map((b) => normalizeName(String(b.name ?? ""))),
    ].filter(Boolean)
  );

  const candidateMap = new Map<string, { name: string; count: number }>();
  const pageSize = 500;
  let analyzedRuns = 0;
  let offset = 0;

  while (true) {
    const { data } = await supabase
      .from("prompt_runs")
      .select("raw_response")
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .not("raw_response", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const chunk = (data ?? []) as RunRow[];
    if (chunk.length === 0) break;
    analyzedRuns += chunk.length;

    for (const run of chunk) {
      const candidates = extractPotentialCompetitorsFromResponse(String(run.raw_response ?? ""));
      for (const candidate of candidates) {
        const normalized = normalizeName(candidate);
        if (!normalized || existingNames.has(normalized)) continue;
        if (!shouldKeepCompetitorCandidate(candidate)) continue;

        const existing = candidateMap.get(normalized);
        if (!existing) {
          candidateMap.set(normalized, { name: candidate.trim(), count: 1 });
        } else {
          existing.count += 1;
          if (candidate.length > existing.name.length) {
            existing.name = candidate.trim();
          }
        }
      }
    }

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const candidates = Array.from(candidateMap.values());
  const toInsert = candidates.filter((entry) => entry.count >= 2);

  if (toInsert.length === 0) {
    return { analyzedRuns, extractedCandidates: candidates.length, insertedCompetitors: 0 };
  }

  const { error } = await supabase.from("brands").insert(
    toInsert.map((entry) => ({
      workspace_id: workspaceId,
      name: entry.name,
      aliases: [],
      type: "competitor",
    }))
  );

  if (error) {
    console.error(`[extractCompetitorsFromPromptRunsDaily] ${slug} insert failed:`, error.message);
    return { analyzedRuns, extractedCandidates: candidates.length, insertedCompetitors: 0 };
  }

  return {
    analyzedRuns,
    extractedCandidates: candidates.length,
    insertedCompetitors: toInsert.length,
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
      const { data } = await supabase.from("workspaces").select("id, slug").order("created_at", {
        ascending: true,
      });
      return (data ?? []) as WorkspaceRow[];
    });

    let totalRuns = 0;
    let totalCandidates = 0;
    let totalInserted = 0;

    for (const workspace of workspaces) {
      const result = await step.run(`process-workspace-${workspace.slug}`, async () =>
        processWorkspace(workspace.id, workspace.slug)
      );

      totalRuns += result.analyzedRuns;
      totalCandidates += result.extractedCandidates;
      totalInserted += result.insertedCompetitors;
    }

    return {
      workspaces: workspaces.length,
      analyzedRuns: totalRuns,
      extractedCandidates: totalCandidates,
      insertedCompetitors: totalInserted,
    };
  }
);
