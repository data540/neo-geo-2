/**
 * Limpieza one-off de competidores falsos positivos en `brands`.
 *
 * Re-clasifica todos los competidores existentes con el clasificador endurecido
 * (solo se conserva lo que sea marca real con confianza ALTA) y:
 *   - Borra los que NO sean competidores reales (categorías, tipos de local, conceptos).
 *   - Borra los duplicados, conservando una sola fila por nombre normalizado.
 *   - Registra los nombres inválidos en `competitor_rejections` (blocklist) para
 *     que el CRON y la extracción en tiempo real no los reinserten.
 *
 * Uso:  pnpm exec tsx scripts/cleanup-competitors.ts            (todos los workspaces)
 *       pnpm exec tsx scripts/cleanup-competitors.ts foodbox    (solo un slug)
 *       DRY_RUN=1 pnpm exec tsx scripts/cleanup-competitors.ts  (no borra, solo informa)
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  classifyCompetitorCandidates,
  normalizeCompetitorName,
  shouldPrefilterCompetitorCandidate,
} from "../src/lib/llm/classifyCompetitors";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type CompetitorRow = { id: string; name: string };

async function processWorkspace(
  // biome-ignore lint/suspicious/noExplicitAny: cliente supabase sin tipos generados
  supabase: any,
  workspace: { id: string; slug: string; domain: string | null; brand_statement: string | null },
  dryRun: boolean
) {
  // 1. Cargar todos los competidores (paginado)
  const rows: CompetitorRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("brands")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("type", "competitor")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    const page = (data ?? []) as CompetitorRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  if (rows.length === 0) {
    console.log(`  [${workspace.slug}] sin competidores. Nada que hacer.`);
    return { kept: 0, deleted: 0, blocklisted: 0 };
  }

  // 2. Agrupar por nombre normalizado (para detectar duplicados)
  const groups = new Map<string, CompetitorRow[]>();
  for (const row of rows) {
    const norm = normalizeCompetitorName(String(row.name ?? ""));
    if (!norm) {
      // nombre vacío tras normalizar → inválido
      groups.set(`__empty__${row.id}`, [row]);
      continue;
    }
    const list = groups.get(norm) ?? [];
    list.push(row);
    groups.set(norm, list);
  }

  // 3. Re-clasificar un representante por grupo
  const { data: ownBrands } = await supabase
    .from("brands")
    .select("name")
    .eq("workspace_id", workspace.id)
    .eq("type", "own");

  const candidates = [...groups.entries()]
    .filter(([norm]) => !norm.startsWith("__empty__"))
    .map(([, list]) => ({ name: list[0]!.name, count: list.length, examples: [] }));

  const classifications = await classifyCompetitorCandidates({
    ownBrandName: String(ownBrands?.[0]?.name ?? ""),
    workspaceDomain: workspace.domain,
    businessContext: workspace.brand_statement,
    candidates,
    maxCandidates: 20000,
  });

  // Índice de clasificación por nombre normalizado
  const byNorm = new Map(classifications.map((c) => [normalizeCompetitorName(c.name), c]));

  // Criterio de CONSERVACIÓN en limpieza: marca real reconocida (high o medium).
  // Más permisivo que la inserción futura (isAcceptedCompetitor = solo high) para
  // no destruir competidores reales menos conocidos ya presentes en la lista.
  const keepInCleanup = (norm: string): boolean => {
    const cls = byNorm.get(norm);
    return !!cls && cls.isCompetitor && cls.confidence !== "low";
  };

  // 4. Decidir qué borrar / conservar / blocklistear
  const idsToDelete: string[] = [];
  const namesToBlocklist: string[] = [];
  let kept = 0;
  const deletedNames: string[] = [];

  for (const [norm, list] of groups.entries()) {
    const isEmpty = norm.startsWith("__empty__");
    const keep = !isEmpty && keepInCleanup(norm);

    if (keep) {
      // Conservar la primera fila, borrar duplicados (sin blocklist)
      kept++;
      for (const row of list.slice(1)) idsToDelete.push(row.id);
    } else {
      // Basura/categoría/no-competidor → borrar todas y registrar en blocklist
      for (const row of list) idsToDelete.push(row.id);
      if (!isEmpty) {
        namesToBlocklist.push(norm);
        deletedNames.push(list[0]!.name);
      }
    }
  }

  console.log(
    `  [${workspace.slug}] total=${rows.length} grupos=${groups.size} ` +
      `conservados=${kept} a_borrar=${idsToDelete.length} blocklist=${namesToBlocklist.length}`
  );

  if (dryRun) {
    console.log(`  [${workspace.slug}] DRY_RUN — muestra a BORRAR:`, deletedNames.slice(0, 50).join(", "));
    const keptSample = [...groups.entries()]
      .filter(([norm]) => !norm.startsWith("__empty__") && keepInCleanup(norm))
      .slice(0, 30)
      .map(([, list]) => list[0]!.name);
    console.log(`  [${workspace.slug}] DRY_RUN — muestra CONSERVADOS:`, keptSample.join(", "));
    return { kept, deleted: idsToDelete.length, blocklisted: namesToBlocklist.length };
  }

  // 5. Borrar mentions + brands en lotes
  for (const batch of chunk(idsToDelete, 200)) {
    await supabase
      .from("mentions")
      .delete()
      .eq("workspace_id", workspace.id)
      .in("brand_id", batch);
    await supabase
      .from("brands")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("type", "competitor")
      .in("id", batch);
  }

  // 6. Registrar inválidos en blocklist
  if (namesToBlocklist.length > 0) {
    const entries = [...new Set(namesToBlocklist)].map((normalized_name) => ({
      workspace_id: workspace.id,
      normalized_name,
    }));
    for (const batch of chunk(entries, 500)) {
      await supabase
        .from("competitor_rejections")
        .upsert(batch, { onConflict: "workspace_id,normalized_name", ignoreDuplicates: true });
    }
  }

  return { kept, deleted: idsToDelete.length, blocklisted: namesToBlocklist.length };
}

/**
 * Limpia la cola de sugerencias PENDIENTES re-clasificando con el LLM endurecido.
 * Primero descarta basura estructural con el prefilter (gratis) y luego pasa el
 * resto por el clasificador, conservando solo marcas reales (high o medium).
 * Borra el resto: frases, abstractos, categorías y negocios de otros sectores.
 */
async function cleanSuggestions(
  // biome-ignore lint/suspicious/noExplicitAny: cliente supabase sin tipos generados
  supabase: any,
  workspace: { id: string; slug: string; domain: string | null; brand_statement: string | null },
  dryRun: boolean
) {
  const rows: Array<{ id: string; name: string }> = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("competitor_suggestions")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("status", "pending")
      .range(offset, offset + pageSize - 1);
    const page = (data ?? []) as Array<{ id: string; name: string }>;
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  if (rows.length === 0) return { kept: 0, deleted: 0 };

  // Paso 1: prefilter estructural (gratis) — descarta frases/categorías/mojibake
  const passPrefilter = rows.filter((r) => shouldPrefilterCompetitorCandidate(String(r.name ?? "")));
  const failPrefilterIds = rows
    .filter((r) => !shouldPrefilterCompetitorCandidate(String(r.name ?? "")))
    .map((r) => r.id);

  // Paso 2: clasificar con LLM el resto y conservar solo marcas reales (high/medium)
  const { data: ownBrands } = await supabase
    .from("brands")
    .select("name")
    .eq("workspace_id", workspace.id)
    .eq("type", "own");

  const classifications = await classifyCompetitorCandidates({
    ownBrandName: String(ownBrands?.[0]?.name ?? ""),
    workspaceDomain: workspace.domain,
    businessContext: workspace.brand_statement,
    candidates: passPrefilter.map((r) => ({ name: r.name, count: 1, examples: [] })),
    maxCandidates: 20000,
  });
  const acceptedNorm = new Set(
    classifications
      .filter((c) => c.isCompetitor && c.confidence !== "low")
      .map((c) => normalizeCompetitorName(c.name))
  );

  const llmRejectIds = passPrefilter
    .filter((r) => !acceptedNorm.has(normalizeCompetitorName(String(r.name ?? ""))))
    .map((r) => r.id);

  const idsToDelete = [...failPrefilterIds, ...llmRejectIds];
  const kept = rows.length - idsToDelete.length;

  console.log(
    `  [${workspace.slug}] sugerencias pendientes=${rows.length} ` +
      `conservadas=${kept} a_borrar=${idsToDelete.length} ` +
      `(prefilter=${failPrefilterIds.length} llm=${llmRejectIds.length})`
  );

  if (dryRun || idsToDelete.length === 0) return { kept, deleted: idsToDelete.length };

  for (const batch of chunk(idsToDelete, 200)) {
    await supabase.from("competitor_suggestions").delete().in("id", batch);
  }
  return { kept, deleted: idsToDelete.length };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars");
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dryRun = process.env.DRY_RUN === "1";
  const slugFilter = process.argv[2];

  let query = supabase.from("workspaces").select("id, slug, domain, brand_statement");
  if (slugFilter) query = query.eq("slug", slugFilter);
  const { data: workspaces } = await query;

  if (!workspaces || workspaces.length === 0) {
    console.log("No se encontraron workspaces.");
    return;
  }

  console.log(`${dryRun ? "[DRY_RUN] " : ""}Limpiando ${workspaces.length} workspace(s)...\n`);

  let totalKept = 0;
  let totalDeleted = 0;
  const suggestionsOnly = process.env.SUGGESTIONS_ONLY === "1";

  for (const ws of workspaces) {
    console.log(`→ ${ws.slug}`);
    if (!suggestionsOnly) {
      const r = await processWorkspace(supabase, ws, dryRun);
      totalKept += r.kept;
      totalDeleted += r.deleted;
    }
    const s = await cleanSuggestions(supabase, ws, dryRun);
    totalDeleted += s.deleted;
  }

  console.log(
    `\n${dryRun ? "[DRY_RUN] " : ""}Hecho. Conservados=${totalKept} Borrados=${totalDeleted}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
