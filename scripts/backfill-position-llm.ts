import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { extractRankingFromList } from "../src/lib/detection/extractRanking";
import { analyzePositionBatch } from "../src/lib/llm/positionAnalyzer";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const BATCH_RUNS = 25;

interface MentionRow {
  id: string;
  prompt_run_id: string;
  brand_name_detected: string | null;
  brand_id: string | null;
  position_source: string | null;
}

interface RunRow {
  id: string;
  raw_response: string | null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Buscando mentions pendientes de análisis de posición LLM...");
  const { count, error: countError } = await supabase
    .from("mentions")
    .select("*", { count: "exact", head: true })
    .or("position_source.is.null,position_source.eq.appearance_order")
    .not("brand_name_detected", "is", null);

  if (countError) {
    console.error("Error al contar mentions:", countError);
    process.exit(1);
  }

  const total = count ?? 0;
  if (total === 0) {
    console.log("No hay menciones pendientes. Backfill completo.");
    return;
  }
  console.log(`Total mentions pendientes: ${total.toLocaleString()}`);

  let processedMentions = 0;
  let updatedViaRegex = 0;
  let updatedViaLlm = 0;
  let failedRuns = 0;
  let processedRuns = 0;

  while (true) {
    const { data: pendingMentions, error: selErr } = await supabase
      .from("mentions")
      .select("id, prompt_run_id, brand_name_detected, brand_id, position_source")
      .or("position_source.is.null,position_source.eq.appearance_order")
      .not("brand_name_detected", "is", null)
      .limit(BATCH_RUNS * 20);

    if (selErr) {
      console.error("Error seleccionando mentions:", selErr);
      process.exit(1);
    }

    const rows = (pendingMentions ?? []) as MentionRow[];
    if (rows.length === 0) break;

    // Agrupar por prompt_run_id
    const byRun = new Map<string, MentionRow[]>();
    for (const m of rows) {
      const list = byRun.get(m.prompt_run_id) ?? [];
      list.push(m);
      byRun.set(m.prompt_run_id, list);
    }
    const runIds = [...byRun.keys()].slice(0, BATCH_RUNS);

    // Obtener raw_response de cada run
    const { data: runRows } = await supabase
      .from("prompt_runs")
      .select("id, raw_response")
      .in("id", runIds);

    const runMap = new Map<string, string | null>(
      ((runRows ?? []) as RunRow[]).map((r) => [r.id, r.raw_response])
    );

    for (const runId of runIds) {
      const mentionsForRun = byRun.get(runId) ?? [];
      const rawResponse = runMap.get(runId);
      processedMentions += mentionsForRun.length;

      if (!rawResponse) {
        // Sin raw_response → marcar como appearance_order para no volver a procesar
        await supabase
          .from("mentions")
          .update({ position_source: "appearance_order" })
          .in("id", mentionsForRun.map((m) => m.id));
        continue;
      }

      // Capa 1: intentar extracción por regex de lista
      const brandInputs = mentionsForRun
        .filter((m) => m.brand_name_detected)
        .map((m) => ({
          id: m.brand_id ?? m.id,
          name: m.brand_name_detected as string,
          aliases: [],
        }));

      const ranking = extractRankingFromList(rawResponse, brandInputs);

      if (ranking.size >= 1) {
        // Actualizar las menciones que se encontraron en la lista
        for (const [brandId, match] of ranking) {
          const mentionIds = mentionsForRun
            .filter((m) => (m.brand_id ?? m.id) === brandId)
            .map((m) => m.id);
          if (mentionIds.length === 0) continue;
          const { error: updErr } = await supabase
            .from("mentions")
            .update({ position: match.rank, position_source: match.source })
            .in("id", mentionIds);
          if (updErr) {
            console.error(`  update regex fallo run=${runId} brand=${match.matchedName}:`, updErr.message);
          } else {
            updatedViaRegex += mentionIds.length;
          }
        }
        // Menciones no rankeadas en la lista → appearance_order
        const rankedBrandIds = new Set(ranking.keys());
        const unrankedIds = mentionsForRun
          .filter((m) => !rankedBrandIds.has(m.brand_id ?? m.id))
          .map((m) => m.id);
        if (unrankedIds.length > 0) {
          await supabase
            .from("mentions")
            .update({ position_source: "appearance_order" })
            .in("id", unrankedIds);
        }
        processedRuns += 1;
        continue;
      }

      // Capa 2: LLM fallback (solo si hay OPENROUTER_API_KEY)
      if (!process.env.OPENROUTER_API_KEY?.trim()) {
        // Sin key → dejar como appearance_order
        await supabase
          .from("mentions")
          .update({ position_source: "appearance_order" })
          .in("id", mentionsForRun.map((m) => m.id));
        continue;
      }

      const brandNames = mentionsForRun
        .map((m) => m.brand_name_detected)
        .filter((n): n is string => Boolean(n));

      try {
        const results = await analyzePositionBatch(rawResponse, brandNames);
        for (const r of results) {
          if (r.rank === null) continue;
          const { error: updErr, count: updCount } = await supabase
            .from("mentions")
            .update({ position: r.rank, position_source: "llm" }, { count: "exact" })
            .eq("prompt_run_id", runId)
            .eq("brand_name_detected", r.brandName);
          if (updErr) {
            console.error(`  update LLM fallo run=${runId} brand=${r.brandName}:`, updErr.message);
          } else {
            updatedViaLlm += updCount ?? 0;
          }
        }
        // Menciones sin rank LLM → appearance_order
        const rankedNames = new Set(results.filter((r) => r.rank !== null).map((r) => r.brandName.toLowerCase()));
        const unrankedIds = mentionsForRun
          .filter((m) => !rankedNames.has((m.brand_name_detected ?? "").toLowerCase()))
          .map((m) => m.id);
        if (unrankedIds.length > 0) {
          await supabase
            .from("mentions")
            .update({ position_source: "appearance_order" })
            .in("id", unrankedIds);
        }
        processedRuns += 1;
      } catch (err) {
        console.error(`  LLM fallo run=${runId}:`, err instanceof Error ? err.message : err);
        failedRuns += 1;
        // Marcar como appearance_order para no reintentar indefinidamente
        await supabase
          .from("mentions")
          .update({ position_source: "appearance_order" })
          .in("id", mentionsForRun.map((m) => m.id));
      }
    }

    const pct = ((processedMentions / total) * 100).toFixed(1);
    console.log(
      `  ${processedMentions}/${total} mentions (${pct}%) — runs OK: ${processedRuns}, fallidos: ${failedRuns}, regex: ${updatedViaRegex}, LLM: ${updatedViaLlm}`
    );
  }

  console.log("\n=== Backfill position LLM completado ===");
  console.log(`Mentions procesadas: ${processedMentions}`);
  console.log(`Actualizadas vía regex (lista): ${updatedViaRegex}`);
  console.log(`Actualizadas vía LLM: ${updatedViaLlm}`);
  console.log(`Runs procesados: ${processedRuns}`);
  console.log(`Runs fallidos: ${failedRuns}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
