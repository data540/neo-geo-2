import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { analyzeSentimentBatch } from "../src/lib/llm/sentimentAnalyzer";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const BATCH_RUNS = 25;

interface MentionRow {
  id: string;
  prompt_run_id: string;
  brand_name_detected: string | null;
  sentiment_source: string | null;
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
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("Falta OPENROUTER_API_KEY — el backfill requiere LLM");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Buscando mentions pendientes de análisis LLM...");
  const { count, error: countError } = await supabase
    .from("mentions")
    .select("*", { count: "exact", head: true })
    .or("sentiment_source.is.null,sentiment_source.eq.heuristic")
    .not("brand_name_detected", "is", null);

  if (countError) {
    console.error("Error al contar mentions:", countError);
    process.exit(1);
  }

  const total = count ?? 0;
  if (total === 0) {
    console.log("No hay menciones pendientes.");
    return;
  }
  console.log(`Total mentions pendientes: ${total.toLocaleString()}`);

  let processedMentions = 0;
  let updatedMentions = 0;
  let failedRuns = 0;
  let processedRuns = 0;

  while (true) {
    const { data: pendingMentions, error: selErr } = await supabase
      .from("mentions")
      .select("id, prompt_run_id, brand_name_detected, sentiment_source")
      .or("sentiment_source.is.null,sentiment_source.eq.heuristic")
      .not("brand_name_detected", "is", null)
      .limit(BATCH_RUNS * 20);

    if (selErr) {
      console.error("Error seleccionando mentions:", selErr);
      process.exit(1);
    }
    const rows = (pendingMentions ?? []) as MentionRow[];
    if (rows.length === 0) break;

    const byRun = new Map<string, MentionRow[]>();
    for (const m of rows) {
      const list = byRun.get(m.prompt_run_id) ?? [];
      list.push(m);
      byRun.set(m.prompt_run_id, list);
    }
    const runIds = [...byRun.keys()].slice(0, BATCH_RUNS);

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
        await supabase
          .from("mentions")
          .update({ sentiment_source: "heuristic", sentiment_score: 0, sentiment_confidence: 0 })
          .in(
            "id",
            mentionsForRun.map((m) => m.id)
          );
        continue;
      }

      const brandNames = [
        ...new Set(mentionsForRun.map((m) => m.brand_name_detected).filter((n): n is string => Boolean(n))),
      ];
      if (brandNames.length === 0) continue;

      try {
        const results = await analyzeSentimentBatch(rawResponse, brandNames);
        for (const r of results) {
          const { error: updErr, count: updCount } = await supabase
            .from("mentions")
            .update(
              {
                sentiment_score: r.score,
                sentiment_confidence: r.confidence,
                sentiment_source: "llm",
              },
              { count: "exact" }
            )
            .eq("prompt_run_id", runId)
            .eq("brand_name_detected", r.brandName);
          if (updErr) console.error(`  update fallo run=${runId} brand=${r.brandName}:`, updErr.message);
          else updatedMentions += updCount ?? 0;
        }
        processedRuns += 1;
      } catch (err) {
        console.error(`  LLM fallo run=${runId}:`, err instanceof Error ? err.message : err);
        failedRuns += 1;
        // Marcar como llm_failed para no reintentar en el mismo backfill
        await supabase
          .from("mentions")
          .update({ sentiment_source: "llm_failed" })
          .in("id", mentionsForRun.map((m) => m.id));
      }
    }

    const pct = ((processedMentions / total) * 100).toFixed(1);
    console.log(
      `  ${processedMentions}/${total} mentions (${pct}%) — runs OK: ${processedRuns}, fallidos: ${failedRuns}, updated: ${updatedMentions}`
    );
  }

  console.log("\n=== Backfill sentiment LLM completado ===");
  console.log(`Mentions procesadas: ${processedMentions}`);
  console.log(`Mentions actualizadas: ${updatedMentions}`);
  console.log(`Runs procesados: ${processedRuns}`);
  console.log(`Runs fallidos: ${failedRuns}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
