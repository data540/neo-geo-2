import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { AnalyzeExecutedPromptsButton } from "./AnalyzeExecutedPromptsButton";
import { CompetitorKpiCards } from "./CompetitorKpiCards";
import type { RankPoint } from "./CompetitorRankChart";
import { CompetitorSuggestionActions } from "./CompetitorSuggestionActions";
import { CompetitorTableSortable } from "./CompetitorTableSortable";
import { CompetitorTrendsPanel } from "./CompetitorTrendsPanel";
import { DeleteCompetitorButton } from "./DeleteCompetitorButton";
import type { CompetitorDynamic } from "./MarketDynamicsCards";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; range?: string; country?: string }>;
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
  sentiment: "positive" | "neutral" | "negative" | "no_data" | null;
  mention_type: string | null;
  created_at: string;
}

interface RunRow {
  id: string;
  prompt_id: string;
  created_at: string;
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

const LLM_OPTIONS = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "gemini", label: "AI Overviews" },
  { key: "perplexity", label: "Perplexity" },
] as const;

export default async function CompetitorsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm = "chatgpt", range = "30", country } = await searchParams;

  // ── Cálculo de ventana temporal ────────────────────────────────────────────
  const isYesterday = range === "yesterday";
  const todayMidnightUTC = new Date();
  todayMidnightUTC.setUTCHours(0, 0, 0, 0);
  const yesterdayMidnightUTC = new Date(todayMidnightUTC);
  yesterdayMidnightUTC.setUTCDate(yesterdayMidnightUTC.getUTCDate() - 1);

  const PERIOD_DAYS = isYesterday ? 1 : range === "7" ? 7 : range === "90" ? 90 : 30;
  const BUCKET_DAYS = isYesterday ? 1 : range === "7" ? 1 : range === "90" ? 15 : 5;
  const TOTAL_BUCKETS = 7;
  const queryLimit = isYesterday ? 2000 : range === "7" ? 2000 : range === "90" ? 20000 : 6000;

  // Para Yesterday: desde ayer 00:00 UTC hasta hoy 00:00 UTC
  // Para rangos numéricos: miramos el doble del período para poder comparar
  const lookbackIso = isYesterday
    ? yesterdayMidnightUTC.toISOString()
    : new Date(Date.now() - PERIOD_DAYS * 2 * 24 * 60 * 60 * 1000).toISOString();
  const ceilingIso: string | null = isYesterday ? todayMidnightUTC.toISOString() : null;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

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

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id, key")
    .eq("key", llm)
    .single();

  // Filtro de país: obtener prompt_ids del país seleccionado
  let countryPromptIds: string[] | null = null;
  if (country) {
    const { data: countryPrompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("country", country);
    countryPromptIds = (countryPrompts ?? []).map((p) => p.id as string);
  }

  let runsQuery = supabase
    .from("prompt_runs")
    .select("id, prompt_id, created_at")
    .eq("workspace_id", workspace.id)
    .eq("llm_provider_id", provider?.id ?? "")
    .eq("status", "completed")
    .gte("created_at", lookbackIso)
    .order("created_at", { ascending: false })
    .limit(queryLimit);
  if (ceilingIso) runsQuery = runsQuery.lt("created_at", ceilingIso);
  if (countryPromptIds !== null) {
    runsQuery = runsQuery.in("prompt_id", countryPromptIds.length > 0 ? countryPromptIds : ["__none__"]);
  }
  const { data: completedRunsData } = await runsQuery;

  const completedRuns = (completedRunsData ?? []) as RunRow[];
  const runIds = completedRuns.map((r) => r.id);
  const runIdToPromptId = new Map(completedRuns.map((r) => [r.id, r.prompt_id]));

  // Nota: .in("prompt_run_id", runIds) falla con "Bad Request" cuando hay
  // cientos de IDs (URL de ~25KB). En su lugar filtramos por workspace_id + fecha
  // y luego reducimos client-side al proveedor LLM activo con un Set.
  let mentions: MentionRow[] = [];
  if (runIds.length > 0) {
    const runIdSet = new Set(runIds);
    let mentionsQuery = supabase
      .from("mentions")
      .select("prompt_run_id, brand_id, brand_type, position, sentiment, mention_type, created_at")
      .eq("workspace_id", workspace.id)
      .gte("created_at", lookbackIso)
      .limit(15000);
    if (ceilingIso) mentionsQuery = mentionsQuery.lt("created_at", ceilingIso);
    const { data: mentionRows } = await mentionsQuery;
    mentions = ((mentionRows ?? []) as MentionRow[]).filter((m) => runIdSet.has(m.prompt_run_id));
  }

  const ownMentions = mentions.filter((m) => m.brand_type === "own").length;
  const competitorMentionsAll = mentions.filter((m) => m.brand_type === "competitor").length;
  const sovPool = ownMentions + competitorMentionsAll;
  const totalRuns = completedRuns.length;

  // Para THREAT: SOV de la marca propia (sin normalizar)
  const ownSovPct = sovPool > 0 ? (ownMentions / sovPool) * 100 : 0;

  const competitorPerformance: CompetitorPerformanceRow[] = competitors
    .map((competitor) => {
      const cMentions = mentions.filter(
        (m) => m.brand_type === "competitor" && m.brand_id === competitor.id
      );
      const positions = cMentions
        .map((m) => m.position)
        .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
      const runIdsSet = new Set(cMentions.map((m) => m.prompt_run_id));
      const promptIdsSet = new Set(
        Array.from(runIdsSet)
          .map((runId) => runIdToPromptId.get(runId))
          .filter((id): id is string => Boolean(id))
      );

      const avgPosition =
        positions.length > 0
          ? round1(positions.reduce((a, b) => a + b, 0) / positions.length)
          : null;

      // VISIBILITY: % de queries (runs) donde aparece el competidor
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

  // KPIs de la marca propia
  const ownMentionRows = mentions.filter((m) => m.brand_type === "own");
  const ownRunsWithMention = new Set(ownMentionRows.map((m) => m.prompt_run_id)).size;
  // Brand Visibility = runs con mención de marca / total runs × 100 (igual que Dashboard)
  const ownVisibility = totalRuns > 0 ? round1((ownRunsWithMention / totalRuns) * 100) : 0;
  const ownPositions = ownMentionRows
    .map((m) => m.position)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  const ownAvgPosition =
    ownPositions.length > 0
      ? round1(ownPositions.reduce((a, b) => a + b, 0) / ownPositions.length)
      : null;
  const ownSov = sovPool > 0 ? round1((ownMentions / sovPool) * 100) : null;
  const highThreats = competitorPerformance.filter((c) => c.threatLevel === "high").length;

  // === Tendencias temporales: buckets + deltas ===
  const nowMs = Date.now();
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

  // Index mention => bucket
  function bucketIndexForDate(iso: string): number {
    const t = new Date(iso).getTime();
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b && t >= b.start && t < b.end) return i;
    }
    return -1;
  }

  // Window split: current (0-30d) vs previous (30-60d)
  const currentWindowStart = nowMs - PERIOD_DAYS * dayMs;
  const previousWindowStart = nowMs - 2 * PERIOD_DAYS * dayMs;
  function windowFor(iso: string): "current" | "previous" | null {
    const t = new Date(iso).getTime();
    if (t >= currentWindowStart) return "current";
    if (t >= previousWindowStart) return "previous";
    return null;
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

  // Acumular posiciones por bucket × brand
  const bucketPositions = new Map<string, number[]>();
  // Acumular métricas por ventana × brand (solo competidores)
  type WindowAgg = {
    competitorMentions: number;
    runIdsWithMention: Set<string>;
    positions: number[];
    totalRuns: number;
    ownMentions: number;
    allCompetitorMentions: number;
  };
  const windowsByBrand = new Map<string, { current: WindowAgg; previous: WindowAgg }>();
  function getBrandWindow(brandId: string) {
    let entry = windowsByBrand.get(brandId);
    if (!entry) {
      const empty = (): WindowAgg => ({
        competitorMentions: 0,
        runIdsWithMention: new Set<string>(),
        positions: [],
        totalRuns: 0,
        ownMentions: 0,
        allCompetitorMentions: 0,
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
    const w = windowFor(run.created_at);
    if (!w) continue;
    windowTotals[w].runs.add(run.id);
  }

  // Mentions: una sola pasada para chart + windows
  for (const m of mentions) {
    if (!m.brand_id) continue;
    const w = windowFor(m.created_at);

    // Chart: solo brand_id en el top
    if (chartBrandIds.has(m.brand_id)) {
      const idx = bucketIndexForDate(m.created_at);
      if (idx >= 0 && typeof m.position === "number" && Number.isFinite(m.position)) {
        const key = `${idx}|${m.brand_id}`;
        const arr = bucketPositions.get(key) ?? [];
        arr.push(m.position);
        bucketPositions.set(key, arr);
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
        if (typeof m.position === "number" && Number.isFinite(m.position)) {
          agg.positions.push(m.position);
        }
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
      const positions = bucketPositions.get(`${idx}|${id}`) ?? [];
      point[name] =
        positions.length > 0
          ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
          : null;
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
    const avgPos =
      agg.positions.length > 0
        ? agg.positions.reduce((a, b) => a + b, 0) / agg.positions.length
        : null;
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
          {/* Filtros LLM */}
          <div className="flex items-center gap-2">
            {LLM_OPTIONS.map((option) => {
              const isActive = llm === option.key;
              const href = `/${slug}/competitors?llm=${option.key}&range=${range}`;
              return (
                <a
                  key={option.key}
                  href={href}
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {option.label}
                </a>
              );
            })}
          </div>

          <div className="w-px h-5 bg-slate-200" />

          {/* Selector de rango de fechas */}
          <div className="flex items-center gap-1.5">
            <a
              href={`/${slug}/competitors?llm=${llm}&range=yesterday`}
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
                  href={`/${slug}/competitors?llm=${llm}&range=${d}`}
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
          rows={competitorPerformance}
          totalRuns={totalRuns}
          llm={llm}
          rangeLabel={isYesterday ? "Yesterday" : `últimos ${PERIOD_DAYS} días`}
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {!competitors || competitors.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Aún no has añadido competidores.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {competitors.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    {c.domain && <p className="text-xs text-slate-400 mt-0.5">{c.domain}</p>}
                    {Array.isArray(c.aliases) && c.aliases.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Alias: {(c.aliases as string[]).join(", ")}
                      </p>
                    )}
                  </div>
                  <DeleteCompetitorButton
                    competitorId={c.id}
                    workspaceId={workspace.id}
                    name={c.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
