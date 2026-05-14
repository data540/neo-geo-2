import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { extractPotentialCompetitorsFromResponse } from "../src/lib/detection/detectBrands";

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

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
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

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id, slug")
    .order("created_at", { ascending: true });

  if (workspacesError) {
    throw new Error(`Workspace fetch failed: ${workspacesError.message}`);
  }

  let totalRuns = 0;
  let totalCandidates = 0;
  let totalInserted = 0;

  for (const workspace of workspaces ?? []) {
    const [{ data: ownBrands }, { data: existingCompetitors }, { data: runs, error: runsError }] =
      await Promise.all([
        supabase.from("brands").select("name").eq("workspace_id", workspace.id).eq("type", "own"),
        supabase.from("brands").select("name").eq("workspace_id", workspace.id).eq("type", "competitor"),
        supabase
          .from("prompt_runs")
          .select("id, raw_response")
          .eq("workspace_id", workspace.id)
          .eq("status", "completed")
          .not("raw_response", "is", null),
      ]);

    if (runsError) {
      console.error(`${workspace.slug}: run fetch failed (${runsError.message})`);
      continue;
    }

    totalRuns += runs?.length ?? 0;

    const existingNames = new Set(
      [
        ...(ownBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
        ...(existingCompetitors ?? []).map((b) => normalizeName(String(b.name ?? ""))),
      ].filter(Boolean)
    );

    const candidateMap = new Map<string, { name: string; count: number }>();
    for (const run of runs ?? []) {
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

    const entries = Array.from(candidateMap.values());
    totalCandidates += entries.length;

    const toInsert = entries.filter((entry) => entry.count >= 2);
    if (toInsert.length === 0) {
      console.log(`${workspace.slug}: analyzed ${runs?.length ?? 0} runs, no new competitors`);
      continue;
    }

    const { error: insertError } = await supabase.from("brands").insert(
      toInsert.map((entry) => ({
        workspace_id: workspace.id,
        name: entry.name,
        aliases: [],
        type: "competitor",
      }))
    );

    if (insertError) {
      console.error(`${workspace.slug}: insert failed (${insertError.message})`);
      continue;
    }

    totalInserted += toInsert.length;
    console.log(
      `${workspace.slug}: analyzed ${runs?.length ?? 0} runs, candidates ${entries.length}, inserted ${toInsert.length}`
    );
  }

  console.log(
    `Done. runs=${totalRuns}, extracted_candidates=${totalCandidates}, inserted_competitors=${totalInserted}`
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
