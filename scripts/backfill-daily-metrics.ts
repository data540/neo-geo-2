/**
 * Backfill de daily_prompt_metrics y daily_workspace_metrics
 * a partir de los prompt_runs y mentions existentes.
 *
 * Uso: npx tsx scripts/backfill-daily-metrics.ts
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("🚀 Backfill de métricas diarias...\n");

  // 1. Agrupa runs completados por (prompt_id, llm_provider_id, date)
  //    y calcula métricas a partir de las mentions existentes.
  const { data: runs, error: runsError } = await supabase
    .from("prompt_runs")
    .select("id, workspace_id, prompt_id, llm_provider_id, completed_at, created_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (runsError) throw runsError;
  console.log(`Runs completados encontrados: ${runs?.length ?? 0}`);

  if (!runs || runs.length === 0) {
    console.log("No hay runs completados. Nada que hacer.");
    return;
  }

  // 2. Carga todas las mentions de una vez
  const runIds = runs.map((r) => r.id);
  const { data: allMentions, error: mentionsError } = await supabase
    .from("mentions")
    .select("prompt_run_id, brand_type, position, sentiment")
    .in("prompt_run_id", runIds);

  if (mentionsError) throw mentionsError;
  console.log(`Menciones encontradas: ${allMentions?.length ?? 0}\n`);

  // Índice mentions por run_id
  const mentionsByRun = new Map<string, typeof allMentions>();
  for (const m of allMentions ?? []) {
    if (!mentionsByRun.has(m.prompt_run_id)) mentionsByRun.set(m.prompt_run_id, []);
    mentionsByRun.get(m.prompt_run_id)!.push(m);
  }

  // 3. Agrupa runs por (workspace_id, prompt_id, llm_provider_id, date)
  type DayKey = string;
  type RunGroup = {
    workspace_id: string;
    prompt_id: string;
    llm_provider_id: string;
    date: string;
    runIds: string[];
  };

  const groups = new Map<DayKey, RunGroup>();
  for (const run of runs) {
    const date = (run.completed_at ?? run.created_at).slice(0, 10);
    const key = `${run.workspace_id}|${run.prompt_id}|${run.llm_provider_id}|${date}`;
    if (!groups.has(key)) {
      groups.set(key, {
        workspace_id: run.workspace_id,
        prompt_id: run.prompt_id,
        llm_provider_id: run.llm_provider_id,
        date,
        runIds: [],
      });
    }
    groups.get(key)!.runIds.push(run.id);
  }

  console.log(`Grupos (prompt × día): ${groups.size}`);

  // 4. Calcula y hace upsert en daily_prompt_metrics
  const promptMetrics = [];
  for (const g of groups.values()) {
    // Toma el último run del día para las métricas puntuales
    const lastRunId = g.runIds[g.runIds.length - 1]!;
    const mentions = mentionsByRun.get(lastRunId) ?? [];

    const ownMentions = mentions.filter((m) => m.brand_type === "own");
    const compMentions = mentions.filter((m) => m.brand_type === "competitor");

    const brandMentioned = ownMentions.length > 0;
    const brandPosition = brandMentioned
      ? Math.min(...ownMentions.map((m) => m.position ?? 999).filter((p) => p < 999))
      : null;
    const competitorCount = compMentions.length;
    const total = (brandMentioned ? 1 : 0) + competitorCount;
    const sov = total > 0 ? Math.round(((brandMentioned ? 1 : 0) / total) * 1000) / 10 : null;

    // Sentimiento: el más frecuente entre las menciones propias
    const sentiments = ownMentions.map((m) => m.sentiment).filter(Boolean);
    const sentiment =
      sentiments.length > 0
        ? (Object.entries(
            sentiments.reduce(
              (acc, s) => {
                acc[s!] = (acc[s!] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            )
          ).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? null)
        : null;

    // Consistencia en ese día: % de runs del día donde apareció la marca
    const runsWithOwn = g.runIds.filter((rid) => {
      const ms = mentionsByRun.get(rid) ?? [];
      return ms.some((m) => m.brand_type === "own");
    }).length;
    const consistencyScore = Math.round((runsWithOwn / g.runIds.length) * 100);

    promptMetrics.push({
      workspace_id: g.workspace_id,
      prompt_id: g.prompt_id,
      llm_provider_id: g.llm_provider_id,
      date: g.date,
      brand_mentioned: brandMentioned,
      brand_position: brandPosition === 999 ? null : brandPosition,
      competitor_count: competitorCount,
      sov,
      sentiment,
      consistency_score: consistencyScore,
    });
  }

  // Upsert en lotes de 200
  const BATCH = 200;
  for (let i = 0; i < promptMetrics.length; i += BATCH) {
    const batch = promptMetrics.slice(i, i + BATCH);
    const { error } = await supabase
      .from("daily_prompt_metrics")
      .upsert(batch, { onConflict: "prompt_id,llm_provider_id,date" });
    if (error) throw error;
    process.stdout.write(`  daily_prompt_metrics: ${Math.min(i + BATCH, promptMetrics.length)}/${promptMetrics.length}\r`);
  }
  console.log(`\n✅ daily_prompt_metrics: ${promptMetrics.length} filas insertadas`);

  // 5. Agrega daily_workspace_metrics por (workspace_id, llm_provider_id, date)
  type WsKey = string;
  type WsGroup = {
    workspace_id: string;
    llm_provider_id: string;
    date: string;
    metrics: typeof promptMetrics;
  };

  const wsGroups = new Map<WsKey, WsGroup>();
  for (const pm of promptMetrics) {
    const key = `${pm.workspace_id}|${pm.llm_provider_id}|${pm.date}`;
    if (!wsGroups.has(key)) {
      wsGroups.set(key, {
        workspace_id: pm.workspace_id,
        llm_provider_id: pm.llm_provider_id,
        date: pm.date,
        metrics: [],
      });
    }
    wsGroups.get(key)!.metrics.push(pm);
  }

  const workspaceMetrics = [];
  for (const wg of wsGroups.values()) {
    const ms = wg.metrics;
    const activePrompts = ms.length;
    const mentionedCount = ms.filter((m) => m.brand_mentioned).length;
    const positions = ms
      .filter((m) => m.brand_mentioned && m.brand_position !== null)
      .map((m) => m.brand_position as number);
    const avgPosition =
      positions.length > 0
        ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
        : null;
    const sovValues = ms.filter((m) => m.sov !== null).map((m) => m.sov as number);
    const avgSov =
      sovValues.length > 0
        ? Math.round((sovValues.reduce((a, b) => a + b, 0) / sovValues.length) * 10) / 10
        : null;
    const highConsistency = ms.filter((m) => (m.consistency_score ?? 0) >= 70).length;
    const brandConsistency = Math.round((highConsistency / activePrompts) * 1000) / 10;

    workspaceMetrics.push({
      workspace_id: wg.workspace_id,
      llm_provider_id: wg.llm_provider_id,
      date: wg.date,
      active_prompts_count: activePrompts,
      brand_mentions_count: mentionedCount,
      avg_position: avgPosition,
      avg_sov: avgSov,
      brand_consistency: brandConsistency,
    });
  }

  for (let i = 0; i < workspaceMetrics.length; i += BATCH) {
    const batch = workspaceMetrics.slice(i, i + BATCH);
    const { error } = await supabase
      .from("daily_workspace_metrics")
      .upsert(batch, { onConflict: "workspace_id,llm_provider_id,date" });
    if (error) throw error;
  }
  console.log(`✅ daily_workspace_metrics: ${workspaceMetrics.length} filas insertadas`);

  // Resumen
  const dates = [...new Set(workspaceMetrics.map((m) => m.date))].sort();
  console.log(`\n📅 Rango de fechas: ${dates[0]} → ${dates[dates.length - 1]}`);
  console.log(`📊 Días con datos: ${dates.length}`);
  console.log("\n✅ Backfill completado.");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
