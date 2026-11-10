import { notFound } from "next/navigation";
import {
  averagePosition,
  bestRankedPositionsByRun,
  getPeriodWindow,
  getWorkspaceBrandPerformanceMetrics,
} from "@/lib/metrics/visibility";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceCountryFilter } from "@/lib/workspace-country";
import type { WorkspaceMemberRole } from "@/types";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { AnalyzeExecutedPromptsButton } from "./AnalyzeExecutedPromptsButton";
import { CompetitorKpiCards } from "./CompetitorKpiCards";
import { CompetitorListWithSearch } from "./CompetitorListWithSearch";
import type { RankPoint } from "./CompetitorRankChart";
import { CompetitorSuggestionActions } from "./CompetitorSuggestionActions";
import { CompetitorTableSortable } from "./CompetitorTableSortable";
import { CompetitorTrendsPanel } from "./CompetitorTrendsPanel";
import type { CompetitorDynamic } from "./MarketDynamicsCards";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; range?: string; country?: string; show_inactive?: string }>;
}

interface CompetitorRow {
  id: string;
  name: string;
  domain: string | null;
  aliases: string[];
}

interface MentionRow {
  prompt_run_id: string;
  brand_id: string | null;
  brand_type: "own" | "competitor" | null;
  position: number | null;
  position_source: string | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data" | null;
  mention_type: string | null;
  created_at: string;
}

interface RunRow {
  id: string;
  prompt_id: string;
  completed_at: string;
}

interface CompetitorPerformanceRow {
  competitorId: string;
  name: string;
  avgPosition: number | null;
  sov: number | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data";
  sentimentScore: number | null;
  visibility: number;
  mentions: number;
  promptsCovered: number;
  lastSeenAt: string | null;
  mentionBreakdown: {
    primary_recommendation: number;
    list_option: number;
    comparison: number;
    general_mention: number;
    warning: number;
  };
  recScore: number | null;
  threatLevel: "high" | "medium" | "low";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function getDominantSentiment(
  sentiments: Array<"positive" | "neutral" | "negative" | "no_data" | null>
): "positive" | "neutral" | "negative" | "no_data" {
  const tally = {
    positive: 0,
    neutral: 0,
    negative: 0,
    no_data: 0,
  };

  for (const s of sentiments) {
    if (!s) {
      tally.no_data += 1;
      continue;
    }
    tally[s] += 1;
  }

  const ordered: Array<keyof typeof tally> = ["positive", "neutral", "negative", "no_data"];
  let best: keyof typeof tally = "no_data";
  let bestScore = -1;
  for (const key of ordered) {
    if (tally[key] > bestScore) {
      best = key;
      bestScore = tally[key];
    }
  }

  return best;
}

export default async function CompetitorsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm, range = "7", country, show_inactive } = await searchParams;
  const showInactive = show_inactive === "1";
  const llmKey = llm ?? null;

  // ── Ventana temporal: misma definición que el Dashboard ────────────────────
  // "Yesterday" = últimas 24 h (igual que "Ayer" en el Dashboard). Se cargan
  // dos periodos: el actual para KPIs/tabla y el anterior solo para deltas.
  const isYesterday = range === "yesterday";
  const PERIOD_DAYS = isYesterday ? 1 : range === "7" ? 7 : range === "90" ? 90 : 30;
  const BUCKET_DAYS = isYesterday ? 1 : range === "7" ? 1 : range === "90" ? 15 : 5;
  const TOTAL_BUCKETS = 7;
  const { now, currentStart, previousStart } = getPeriodWindow(PERIOD_DAYS);

  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .single()
    : { data: null };
  const countryFilter = resolveWorkspaceCountryFilter({
    workspaceSlug: slug,
    requestedCountry: country,
    userRole: (membership?.role as WorkspaceMemberRole | undefined) ?? null,
  });

  const { data: competitorsData } = await supabase
    .from("brands")
    .select("id, name, domain, aliases")
    .eq("workspace_id", workspace.id)
    .eq("type", "competitor")
    .order("name");

  const competitors = (competitorsData ?? []) as CompetitorRow[];

  const { data: ownBrandData } = await supabase
    .from("brands")
    .select("id, name, aliases")
    .eq("workspace_id", workspace.id)
    .eq("type", "own")
    .maybeSingle();

  const { data: suggestions } = await supabase
    .from("competitor_suggestions")
    .select("id, name, created_at")
    .eq("workspace_id", workspace.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(30);

  // Resolver provider solo si hay un LLM concreto seleccionado.
  // "All LLMs" (llmKey === null) agrega todos los proveedores.
  let providerId: string | null = null;
  if (llmKey) {
    const { data: provider } = await supabase
      .from("llm_providers")
      .select("id")
      .eq("key", llmKey)
      .single();

    if (!provider) notFound();
    providerId = provider.id;
  }

  // Filtro de país: obtener prompt_ids del país seleccionado
  let countryPromptIds: string[] | null = null;
  if (countryFilter) {
    const { data: countryPrompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("country", countryFilter);
    countryPromptIds = (countryPrompts ?? []).map((p) => p.id as string);
  }

  // Paginamos los runs igual que las menciones: un .limit() fijo trunca la
  // ventana cuando el volumen crece y deja incompletos los buckets del gráfico.
  // Se filtra por completed_at, igual que el Dashboard.
  const completedRuns: RunRow[] = [];
  {
    const PAGE = 1000;
    const MAX_PAGES = 60;
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      let runsQuery = supabase
        .from("prompt_runs")
        .select("id, prompt_id, completed_at")
        .eq("workspace_id", workspace.id)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .gte("completed_at", previousStart.toISOString())
        .lt("completed_at", now.toISOString())
        .order("completed_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (providerId) runsQuery = runsQuery.eq("llm_provider_id", providerId);
      if (countryPromptIds !== null) {
        runsQuery = runsQuery.in(
          "prompt_id",
          countryPromptIds.length > 0 ? countryPromptIds : ["__none__"]
        );
      }
      const { data: pageRows } = await runsQuery;
      const rows = (pageRows ?? []) as RunRow[];
      completedRuns.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }
  const runIdToPromptId = new Map(completedRuns.map((r) => [r.id, r.prompt_id]));
  const runCompletedAtMs = new Map(
    completedRuns.map((r) => [r.id, new Date(r.completed_at).getTime()])
  );
  const currentStartMs = currentStart.getTime();
  const previousStartMs = previousStart.getTime();

  /** Periodo de un run según su completed_at (la misma referencia que el Dashboard). */
  function windowForRun(runId: string): "current" | "previous" | null {
    const t = runCompletedAtMs.get(runId);
    if (t === undefined) return null;
    if (t >= currentStartMs) return "current";
    if (t >= previousStartMs) return "previous";
    return null;
  }

  // Nota: .in("prompt_run_id", runIds) falla con "Bad Request" cuando hay
  // cientos de IDs (URL de ~25KB). En su lugar filtramos por workspace_id + fecha
  // y luego reducimos client-side a los runs cargados con un Set.
  // El prefiltro por fecha lleva 1 día de margen: las menciones se insertan
  // antes de marcar el run como completado.
  let mentions: MentionRow[] = [];
  if (completedRuns.length > 0) {
    const mentionsSinceIso = new Date(previousStartMs - 24 * 60 * 60 * 1000).toISOString();
    const collected: MentionRow[] = [];
    const PAGE = 1000;
    const MAX_PAGES = 80; // tope de seguridad: hasta 80k menciones
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data: pageRows } = await supabase
        .from("mentions")
        .select(
          "prompt_run_id, brand_id, brand_type, position, position_source, sentiment, mention_type, created_at"
        )
        .eq("workspace_id", workspace.id)
        .gte("created_at", mentionsSinceIso)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      const rows = (pageRows ?? []) as MentionRow[];
      collected.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
    mentions = collected.filter((m) => runCompletedAtMs.has(m.prompt_run_id));
  }

  // ── Periodo actual: base de KPIs y tabla ───────────────────────────────────
  const currentMentions = mentions.filter((m) => windowForRun(m.prompt_run_id) === "current");
  const totalRuns = completedRuns.filter((r) => windowForRun(r.id) === "current").length;

  const ownMentions = currentMentions.filter((m) => m.brand_type === "own").length;
  const competitorMentionsAll = currentMentions.filter((m) => m.brand_type === "competitor").length;
  const sovPool = ownMentions + competitorMentionsAll;

  // Para THREAT: SOV de la marca propia (sin normalizar)
  const ownSovPct = sovPool > 0 ? (ownMentions / sovPool) * 100 : 0;

  const competitorPerformance: CompetitorPerformanceRow[] = competitors
    .map((competitor) => {
      const cMentions = currentMentions.filter(
        (m) => m.brand_type === "competitor" && m.brand_id === competitor.id
      );
      const runIdsSet = new Set(cMentions.map((m) => m.prompt_run_id));
      const promptIdsSet = new Set(
        Array.from(runIdsSet)
          .map((runId) => runIdToPromptId.get(runId))
          .filter((id): id is string => Boolean(id))
      );

      // POSICIÓN: misma regla que la marca propia en el Dashboard — mejor
      // posición rankeada por respuesta, promediada entre respuestas.
      const avgPosition = averagePosition(bestRankedPositionsByRun(cMentions));

      // VISIBILITY: % de respuestas (runs) donde aparece el competidor, igual
      // que la visibilidad de la marca propia, para que sean comparables.
      const visibility = totalRuns > 0 ? round1((runIdsSet.size / totalRuns) * 100) : 0;

      const sov = sovPool > 0 ? round1((cMentions.length / sovPool) * 100) : null;
      const sentiment = getDominantSentiment(cMentions.map((m) => m.sentiment));

      // SENTIMENT SCORE: media de +1/0/−1 (excluyendo no_data)
      const sentimentedMentions = cMentions.filter((m) => m.sentiment && m.sentiment !== "no_data");
      const sentimentScore =
        sentimentedMentions.length > 0
          ? round1(
              sentimentedMentions.reduce(
                (acc, m) =>
                  acc + (m.sentiment === "positive" ? 1 : m.sentiment === "negative" ? -1 : 0),
                0
              ) / sentimentedMentions.length
            )
          : null;

      // MENTION BREAKDOWN por tipo
      const mentionBreakdown = {
        primary_recommendation: cMentions.filter((m) => m.mention_type === "primary_recommendation")
          .length,
        list_option: cMentions.filter((m) => m.mention_type === "list_option").length,
        comparison: cMentions.filter((m) => m.mention_type === "comparison").length,
        general_mention: cMentions.filter((m) => m.mention_type === "general_mention").length,
        warning: cMentions.filter((m) => m.mention_type === "warning").length,
      };

      // REC. SCORE: % de menciones de tipo primary_recommendation (0-100)
      const recScore =
        cMentions.length > 0
          ? round1((mentionBreakdown.primary_recommendation / cMentions.length) * 100)
          : null;

      // THREAT LEVEL: relativo al SOV de la marca propia
      const compSovPct = sovPool > 0 ? (cMentions.length / sovPool) * 100 : 0;
      const threatLevel: "high" | "medium" | "low" =
        compSovPct > ownSovPct * 1.2 ? "high" : compSovPct > ownSovPct * 0.4 ? "medium" : "low";

      const lastSeenAt =
        cMentions.length > 0
          ? (cMentions
              .map((m) => m.created_at)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null)
          : null;

      return {
        competitorId: competitor.id,
        name: competitor.name,
        avgPosition,
        sov,
        sentiment,
        sentimentScore,
        visibility,
        mentions: cMentions.length,
        promptsCovered: promptIdsSet.size,
        lastSeenAt,
        mentionBreakdown,
        recScore,
        threatLevel,
      };
    })
    .sort((a, b) => {
      if (a.avgPosition === null && b.avgPosition === null) return b.visibility - a.visibility;
      if (a.avgPosition === null) return 1;
      if (b.avgPosition === null) return -1;
      if (a.avgPosition !== b.avgPosition) return a.avgPosition - b.avgPosition;
      return b.visibility - a.visibility;
    });

  // KPIs de la marca propia: misma función que el Dashboard, así coinciden
  // por construcción (mismos runs, ventana, país, LLM y regla de posición).
  const ownPerformance = await getWorkspaceBrandPerformanceMetrics({
    workspaceId: workspace.id,
    country: countryFilter,
    days: PERIOD_DAYS,
    llmProviderId: providerId,
  });
  const ownVisibility = ownPerformance.current.visibilityPct ?? 0;
  const ownAvgPosition = ownPerformance.current.avgPosition;
  const ownSov = sovPool > 0 ? round1((ownMentions / sovPool) * 100) : null;
  const highThreats = competitorPerformance.filter((c) => c.threatLevel === "high").length;

  // === Tendencias temporales: buckets + deltas ===
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const buckets: { start: number; end: number; label: string }[] = [];
  for (let i = TOTAL_BUCKETS - 1; i >= 0; i--) {
    const end = nowMs - i * BUCKET_DAYS * dayMs;
    const start = end - BUCKET_DAYS * dayMs;
    const label = new Date(end).toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
    buckets.push({ start, end, label });
  }

  // Bucket del run (por completed_at), no de la mención
  function bucketIndexForRun(runId: string): number {
    const t = runCompletedAtMs.get(runId);
    if (t === undefined) return -1;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b && t >= b.start && t < b.end) return i;
    }
    return -1;
  }

  // Top brands para chart: 5 competidores con más mentions globales + own
  const topChartCompetitors = [...competitorPerformance]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);
  const chartBrandIds = new Set<string>([
    ...(ownBrandData ? [ownBrandData.id as string] : []),
    ...topChartCompetitors.map((c) => c.competitorId),
  ]);
  const idToBrandName = new Map<string, string>();
  if (ownBrandData) idToBrandName.set(ownBrandData.id as string, ownBrandData.name as string);
  for (const c of competitorPerformance) idToBrandName.set(c.competitorId, c.name);

  // Acumular menciones por bucket × brand (la posición se calcula después
  // con la misma regla de mejor posición rankeada por respuesta)
  const bucketMentions = new Map<string, MentionRow[]>();
  // Acumular métricas por ventana × brand (solo competidores)
  type WindowAgg = {
    competitorMentions: number;
    runIdsWithMention: Set<string>;
    rows: MentionRow[];
  };
  const windowsByBrand = new Map<string, { current: WindowAgg; previous: WindowAgg }>();
  function getBrandWindow(brandId: string) {
    let entry = windowsByBrand.get(brandId);
    if (!entry) {
      const empty = (): WindowAgg => ({
        competitorMentions: 0,
        runIdsWithMention: new Set<string>(),
        rows: [],
      });
      entry = { current: empty(), previous: empty() };
      windowsByBrand.set(brandId, entry);
    }
    return entry;
  }

  // Totales por ventana (para SOV pool)
  const windowTotals = {
    current: { runs: new Set<string>(), ownMentions: 0, competitorMentions: 0 },
    previous: { runs: new Set<string>(), ownMentions: 0, competitorMentions: 0 },
  };

  // Runs por ventana
  for (const run of completedRuns) {
    const w = windowForRun(run.id);
    if (!w) continue;
    windowTotals[w].runs.add(run.id);
  }

  // Mentions: una sola pasada para chart + windows
  for (const m of mentions) {
    if (!m.brand_id) continue;
    const w = windowForRun(m.prompt_run_id);

    // Chart: solo brand_id en el top
    if (chartBrandIds.has(m.brand_id)) {
      const idx = bucketIndexForRun(m.prompt_run_id);
      if (idx >= 0) {
        const key = `${idx}|${m.brand_id}`;
        const arr = bucketMentions.get(key) ?? [];
        arr.push(m);
        bucketMentions.set(key, arr);
      }
    }

    // Windows
    if (w) {
      if (m.brand_type === "own") {
        windowTotals[w].ownMentions += 1;
      } else if (m.brand_type === "competitor") {
        windowTotals[w].competitorMentions += 1;
        const agg = getBrandWindow(m.brand_id)[w];
        agg.competitorMentions += 1;
        agg.runIdsWithMention.add(m.prompt_run_id);
        agg.rows.push(m);
      }
    }
  }

  // Construir rankSeries
  const chartBrandNames: string[] = [];
  for (const id of chartBrandIds) {
    const name = idToBrandName.get(id);
    if (name) chartBrandNames.push(name);
  }
  const rankSeries: RankPoint[] = buckets.map((bucket, idx) => {
    const point: RankPoint = { date: bucket.label };
    for (const id of chartBrandIds) {
      const name = idToBrandName.get(id);
      if (!name) continue;
      point[name] = averagePosition(
        bestRankedPositionsByRun(bucketMentions.get(`${idx}|${id}`) ?? [])
      );
    }
    return point;
  });

  // Construir dynamics: top 6 competidores por mentions en ventana actual
  function computeBrandWindowStats(
    agg: WindowAgg,
    totalRuns: number,
    ownMentions: number,
    competitorMentionsAllBrands: number
  ) {
    const sovPool = ownMentions + competitorMentionsAllBrands;
    const sov = sovPool > 0 ? (agg.competitorMentions / sovPool) * 100 : null;
    const vis = totalRuns > 0 ? (agg.runIdsWithMention.size / totalRuns) * 100 : null;
    const avgPos = averagePosition(bestRankedPositionsByRun(agg.rows));
    return { sov, vis, avgPos };
  }

  const dynamics: CompetitorDynamic[] = [];
  for (const c of competitorPerformance) {
    const entry = windowsByBrand.get(c.competitorId);
    if (!entry) continue;
    const curStats = computeBrandWindowStats(
      entry.current,
      windowTotals.current.runs.size,
      windowTotals.current.ownMentions,
      windowTotals.current.competitorMentions
    );
    const prevStats = computeBrandWindowStats(
      entry.previous,
      windowTotals.previous.runs.size,
      windowTotals.previous.ownMentions,
      windowTotals.previous.competitorMentions
    );

    const sovDelta =
      curStats.sov !== null && prevStats.sov !== null ? round1(curStats.sov - prevStats.sov) : null;
    const visDelta =
      curStats.vis !== null && prevStats.vis !== null ? round1(curStats.vis - prevStats.vis) : null;
    const posDelta =
      curStats.avgPos !== null && prevStats.avgPos !== null
        ? round1(curStats.avgPos - prevStats.avgPos)
        : null;

    const trend: CompetitorDynamic["trend"] =
      sovDelta === null || sovDelta === 0 ? "stable" : sovDelta > 0 ? "rising" : "declining";

    dynamics.push({
      competitorId: c.competitorId,
      name: c.name,
      trend,
      sovDelta,
      visDelta,
      posDelta,
    });
  }
  const topDynamics = dynamics
    .filter((d) => d.sovDelta !== null || d.visDelta !== null || d.posDelta !== null)
    .sort((a, b) => Math.abs(b.sovDelta ?? 0) - Math.abs(a.sovDelta ?? 0))
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Competidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Marcas que tu IA monitoriza en las respuestas junto a la tuya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de rango de fechas */}
          <div className="flex items-center gap-1.5">
            <a
              href={`/${slug}/competitors?${llm ? `llm=${llm}&` : ""}range=yesterday`}
              className={[
                "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isYesterday
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              Yesterday
            </a>
            {([7, 30, 90] as const).map((d) => {
              const active = !isYesterday && PERIOD_DAYS === d;
              return (
                <a
                  key={d}
                  href={`/${slug}/competitors?${llm ? `llm=${llm}&` : ""}range=${d}`}
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {d}D
                </a>
              );
            })}
          </div>
        </div>

        <CompetitorKpiCards
          kpis={{
            visibility: ownVisibility,
            avgPosition: ownAvgPosition,
            sov: ownSov,
            totalCompetitors: competitors.length,
            highThreats,
          }}
        />

        <CompetitorTrendsPanel
          chartData={rankSeries}
          brandNames={chartBrandNames}
          ownBrandName={(ownBrandData?.name as string) ?? ""}
          dynamics={topDynamics}
          periodDays={PERIOD_DAYS}
        />

        <CompetitorTableSortable
          workspaceId={workspace.id}
          rows={
            showInactive
              ? competitorPerformance
              : competitorPerformance.filter((c) => c.mentions > 0)
          }
          inactiveCount={competitorPerformance.filter((c) => c.mentions === 0).length}
          showInactive={showInactive}
          toggleHref={`/${slug}/competitors?${[
            llm ? `llm=${llm}` : "",
            `range=${range}`,
            country ? `country=${country}` : "",
            showInactive ? "" : "show_inactive=1",
          ]
            .filter(Boolean)
            .join("&")}`}
          totalRuns={totalRuns}
          llm={llm ?? "All LLMs"}
          rangeLabel={isYesterday ? "últimas 24 horas" : `últimos ${PERIOD_DAYS} días`}
        />

        <AddCompetitorForm workspaceId={workspace.id} />

        <AnalyzeExecutedPromptsButton workspaceId={workspace.id} />

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Sugerencias detectadas por IA</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Se generan a partir de respuestas de LLM. Revisa y aprueba solo las validas.
            </p>
          </div>

          {!suggestions || suggestions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No hay sugerencias pendientes.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">
                      Detectado automaticamente en respuestas LLM
                    </p>
                  </div>
                  <CompetitorSuggestionActions
                    suggestionId={s.id}
                    workspaceId={workspace.id}
                    name={s.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <CompetitorListWithSearch competitors={competitors ?? []} workspaceId={workspace.id} />
      </div>
    </div>
  );
}
