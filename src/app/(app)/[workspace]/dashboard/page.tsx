import { Eye, Smile, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiOverviewDashboard } from "@/components/dashboard/AiOverviewDashboard";
import { BrandVisibilityTrendChart } from "@/components/dashboard/BrandVisibilityTrendChart";
import { CompetitorShareTrendsChart } from "@/components/dashboard/CompetitorShareTrendsChart";
import { DashboardRefreshButton } from "@/components/dashboard/DashboardRefreshButton";
import { ExportDashboardButton } from "@/components/dashboard/ExportDashboardButton";
import { LlmComparisonTable } from "@/components/dashboard/LlmComparisonTable";
import { MarketShareDonut } from "@/components/dashboard/MarketShareDonut";
import { MentionBreakdownPanel } from "@/components/dashboard/MentionBreakdownPanel";
import { RunAllPromptsButton } from "@/components/dashboard/RunAllPromptsButton";
import { SourcePowerRanking } from "@/components/dashboard/SourcePowerRanking";
import { TopCompetitorsPanel } from "@/components/dashboard/TopCompetitorsPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { Delta, fmtScore, sentimentLabel, Sparkline } from "@/components/dashboard/kpi-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { parseAioContent } from "@/lib/aio/parseAioContent";
import {
  getWorkspaceBrandPerformanceMetrics,
  getWorkspaceBrandVisibilityTrendMetrics,
} from "@/lib/metrics/visibility";
import { createClient } from "@/lib/supabase/server";
import type {
  LlmComparisonRow,
  LlmProviderKey,
  MarketShareEntry,
  MentionBreakdownEntry,
  MentionType,
  SourceRankingEntry,
  TopCompetitorEntry,
} from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; range?: string; country?: string }>;
}

function calcAvgSentiment(
  mentions: Array<{ sentiment: string | null; sentiment_score: number | null }>
): number | null {
  if (mentions.length === 0) return null;
  const sum = mentions.reduce((acc, m) => {
    if (m.sentiment_score !== null) return acc + m.sentiment_score;
    if (m.sentiment === "positive") return acc + 1;
    if (m.sentiment === "negative") return acc - 1;
    return acc;
  }, 0);
  return Math.round((sum / mentions.length) * 100) / 100;
}

// Colapsa filas de daily_workspace_metrics (una por proveedor y fecha) en una
// sola fila por fecha, promediando los campos numéricos. Se usa en "All LLMs".
type DailyMetricRow = {
  date: string;
  active_prompts_count: number | null;
  brand_mentions_count: number | null;
  avg_position: number | null;
  brand_consistency: number | null;
  avg_sov: number | null;
};

function avgOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
}

function aggregateMetricsByDate(rows: DailyMetricRow[]): DailyMetricRow[] {
  const byDate = new Map<string, DailyMetricRow[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.date);
    if (bucket) bucket.push(row);
    else byDate.set(row.date, [row]);
  }
  return Array.from(byDate.entries())
    .map(([date, group]) => ({
      date,
      active_prompts_count: avgOf(group.map((g) => g.active_prompts_count)),
      brand_mentions_count: group.reduce((s, g) => s + (g.brand_mentions_count ?? 0), 0),
      avg_position: avgOf(group.map((g) => g.avg_position)),
      brand_consistency: avgOf(group.map((g) => g.brand_consistency)),
      avg_sov: avgOf(group.map((g) => g.avg_sov)),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ── Range config ───────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { value: 1, label: "Ayer" },
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
  { value: 180, label: "6M" },
  { value: 365, label: "1Y" },
  { value: 3650, label: "Max" },
] as const;

const VALID_RANGES = RANGE_OPTIONS.map((r) => String(r.value));

export default async function DashboardPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm, range = "7", country } = await searchParams;
  const llmKey = llm ?? null;

  const supabase = await createClient();
  const days = VALID_RANGES.includes(range) ? Number(range) : 7;
  const rangeLabel = days === 1 ? "Yesterday" : days === 3650 ? "All time" : `Last ${days} days`;
  const selectedRange = RANGE_OPTIONS.find((r) => r.value === days);
  const dailyRangeLabel = days === 1 ? "Ayer" : days === 3650 ? "Todos los datos" : `${days} días`;
  const badgeLabel =
    days === 1
      ? "Ayer"
      : selectedRange?.label
        ? `Últimos ${selectedRange.label}`
        : `Últimos ${days}D`;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, brand_name, country")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  // Resolver provider solo si hay un LLM concreto. "All LLMs" (llmKey === null)
  // agrega métricas de todos los proveedores.
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

  // ── Load 2× period for delta calculation ──────────────────────────────────
  let metricsQuery = supabase
    .from("daily_workspace_metrics")
    .select(
      "date, active_prompts_count, brand_mentions_count, avg_position, brand_consistency, avg_sov"
    )
    .eq("workspace_id", workspace.id)
    .order("date", { ascending: false })
    // En "All LLMs" hay una fila por proveedor y fecha: ampliamos el límite.
    .limit(providerId ? days * 2 : days * 2 * 4);
  if (providerId) metricsQuery = metricsQuery.eq("llm_provider_id", providerId);
  const { data: allMetricRowsRaw } = await metricsQuery;

  // En "All LLMs" colapsamos a una fila por fecha promediando brand_consistency
  // (único campo de esta tabla que se usa aguas abajo, en el chart).
  const allMetricRows = providerId
    ? (allMetricRowsRaw ?? [])
    : aggregateMetricsByDate(allMetricRowsRaw ?? []);

  const rows = allMetricRows.slice(0, days);

  // ── Current period KPIs ────────────────────────────────────────────────────
  const brandPerformanceMetrics = await getWorkspaceBrandPerformanceMetrics({
    workspaceId: workspace.id,
    country: country ?? null,
    days,
    llmProviderId: providerId,
  });
  const brandVisibilityTrendMetrics = await getWorkspaceBrandVisibilityTrendMetrics({
    workspaceId: workspace.id,
    country: country ?? null,
    days,
    llmProviderId: providerId,
    ownBrandName: workspace.brand_name,
  });

  const mentionsTotal = brandPerformanceMetrics.current.runsWithOwnBrand;
  const prevMentionsTotal = brandPerformanceMetrics.previous.runsWithOwnBrand;

  const visibility = brandPerformanceMetrics.current.visibilityPct;
  const avgPosition = brandPerformanceMetrics.current.avgPosition;
  const minPosition = brandPerformanceMetrics.current.minPosition;
  const maxPosition = brandPerformanceMetrics.current.maxPosition;

  const visibilityDelta = brandPerformanceMetrics.visibilityDeltaPct;
  const avgPositionDelta = brandPerformanceMetrics.avgPositionDelta;
  const mentionsDelta =
    mentionsTotal > 0 || prevMentionsTotal > 0 ? mentionsTotal - prevMentionsTotal : null;

  // ── Sentiment from mentions ────────────────────────────────────────────────
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days);

  // Filtro de país para sentiment: obtener prompt_ids del país seleccionado
  let sentimentPromptIds: string[] | null = null;
  if (country) {
    const { data: countryPrompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("country", country);
    sentimentPromptIds = (countryPrompts ?? []).map((p) => p.id as string);
  }

  let sentimentQuery = supabase
    .from("mentions")
    .select("sentiment, sentiment_score, created_at, prompt_run_id")
    .eq("workspace_id", workspace.id)
    .eq("brand_type", "own")
    .gte("created_at", prevPeriodStart.toISOString())
    .order("created_at", { ascending: false });

  const { data: sentimentMentionsRaw } = await sentimentQuery;

  // Filtrar client-side por país y/o LLM (via prompt_run lookup). El sentiment
  // así respeta el filtro de proveedor igual que el resto de KPIs.
  let sentimentRunIds: Set<string> | null = null;
  if (sentimentPromptIds !== null || providerId) {
    let runsFilterQuery = supabase
      .from("prompt_runs")
      .select("id")
      .eq("workspace_id", workspace.id)
      .gte("created_at", prevPeriodStart.toISOString())
      .limit(20000);
    if (sentimentPromptIds !== null) {
      runsFilterQuery = runsFilterQuery.in(
        "prompt_id",
        sentimentPromptIds.length > 0 ? sentimentPromptIds : ["__none__"]
      );
    }
    if (providerId) {
      runsFilterQuery = runsFilterQuery.eq("llm_provider_id", providerId);
    }
    const { data: filteredRuns } = await runsFilterQuery;
    sentimentRunIds = new Set((filteredRuns ?? []).map((r) => r.id as string));
  }

  const { data: sentimentMentions } = { data: sentimentRunIds
    ? (sentimentMentionsRaw ?? []).filter((m) => sentimentRunIds!.has((m as { prompt_run_id: string }).prompt_run_id))
    : sentimentMentionsRaw };

  const allSentimentMentions = sentimentMentions ?? [];
  const currSentimentMentions = allSentimentMentions.filter(
    (m) => new Date(m.created_at) >= periodStart
  );
  const prevSentimentMentions = allSentimentMentions.filter(
    (m) => new Date(m.created_at) < periodStart
  );

  const avgSentiment = calcAvgSentiment(currSentimentMentions);
  const prevAvgSentiment = calcAvgSentiment(prevSentimentMentions);
  const sentimentDelta =
    avgSentiment !== null && prevAvgSentiment !== null
      ? Math.round((avgSentiment - prevAvgSentiment) * 100) / 100
      : null;

  const sent = sentimentLabel(avgSentiment);

  // ── Sparkline series ───────────────────────────────────────────────────────
  const visibilitySeries = brandPerformanceMetrics.daily.map((r) => r.visibilityPct ?? 0);
  const mentionsSeries = brandPerformanceMetrics.daily.map((r) => r.runsWithOwnBrand);
  const avgPositionSeries = brandPerformanceMetrics.daily
    .map((r) => r.avgPosition)
    .filter((position): position is number => typeof position === "number");
  // Sentiment series: normalize -1..1 → 0..100
  const sentimentSeries =
    currSentimentMentions.length > 0 ? [Math.round(((avgSentiment ?? 0) + 1) * 50)] : [50];

  const metricsByDate = new Map(rows.map((r) => [r.date, r]));
  const chartData = brandPerformanceMetrics.daily.map((r) => {
    const metric = metricsByDate.get(r.date);
    return {
      date: r.date,
      menciones: r.runsWithOwnBrand,
      visibilidad: r.visibilityPct,
      posicion: r.avgPosition,
      consistencia: metric?.brand_consistency ?? null,
    };
  });

  // ── Recent runs ────────────────────────────────────────────────────────────
  const { data: recentRuns } = await supabase
    .from("prompt_runs")
    .select("id, status, created_at, completed_at, prompts(text), llm_providers(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // ── Dashboard analytics (RPC parallel fetch) ──────────────────────────────
  type MarketShareRow = {
    brand_id: string;
    brand_name: string;
    brand_domain: string | null;
    brand_type: "own" | "competitor";
    mentions_count: number;
    share_pct: number;
  };
  type BreakdownRow = { mention_type: MentionType; count: number; pct: number };
  type CompetitorRow = {
    competitor_id: string;
    competitor_name: string;
    competitor_domain: string | null;
    mentions_count: number;
    share_pct: number;
    trend_pct: number | null;
  };
  type SourceRow = { domain: string; citations_count: number; pct_of_runs: number };
  type LlmRow = {
    llm_key: LlmProviderKey;
    llm_name: string;
    visibility_pct: number;
    sov_pct: number;
    avg_rank: number | null;
    top_competitor_name: string | null;
    top_competitor_sov: number;
    avg_sentiment: number | null;
    total_runs: number;
  };

  const [marketShareRes, breakdownRes, competitorsRes, sourcesRes, llmRes] = await Promise.all([
    supabase.rpc("get_workspace_market_share", { workspace_slug: slug, days, llm_key: llmKey, p_country_filter: country ?? null }),
    supabase.rpc("get_workspace_mention_breakdown", { workspace_slug: slug, days, llm_key: llmKey, p_country_filter: country ?? null }),
    supabase.rpc("get_workspace_top_competitors", {
      workspace_slug: slug,
      days,
      limit_n: 5,
      llm_key: llmKey,
      p_country_filter: country ?? null,
    }),
    supabase.rpc("get_workspace_top_sources", {
      workspace_slug: slug,
      days,
      limit_n: 5,
      llm_key: llmKey,
      p_country_filter: country ?? null,
    }),
    supabase.rpc("get_workspace_llm_comparison", { workspace_slug: slug, days, p_country_filter: country ?? null }),
  ]);

  const marketShare: MarketShareEntry[] = ((marketShareRes.data ?? []) as MarketShareRow[]).map(
    (r) => ({
      brandId: r.brand_id,
      brandName: r.brand_name,
      brandDomain: r.brand_domain,
      brandType: r.brand_type,
      mentionsCount: Number(r.mentions_count),
      sharePct: Number(r.share_pct),
    })
  );
  const breakdown: MentionBreakdownEntry[] = ((breakdownRes.data ?? []) as BreakdownRow[]).map(
    (r) => ({
      mentionType: r.mention_type,
      count: Number(r.count),
      pct: Number(r.pct),
    })
  );
  const topCompetitors: TopCompetitorEntry[] = ((competitorsRes.data ?? []) as CompetitorRow[]).map(
    (r) => ({
      competitorId: r.competitor_id,
      competitorName: r.competitor_name,
      competitorDomain: r.competitor_domain,
      mentionsCount: Number(r.mentions_count),
      sharePct: Number(r.share_pct),
      trendPct: r.trend_pct !== null ? Number(r.trend_pct) : null,
    })
  );
  const topSources: SourceRankingEntry[] = ((sourcesRes.data ?? []) as SourceRow[]).map((r) => ({
    domain: r.domain,
    citationsCount: Number(r.citations_count),
    pctOfRuns: Number(r.pct_of_runs),
  }));
  const llmComparison: LlmComparisonRow[] = ((llmRes.data ?? []) as LlmRow[]).map((r) => ({
    llmKey: r.llm_key,
    llmName: r.llm_name,
    visibilityPct: Number(r.visibility_pct),
    sovPct: Number(r.sov_pct),
    avgRank: r.avg_rank !== null ? Number(r.avg_rank) : null,
    topCompetitorName: r.top_competitor_name,
    topCompetitorSov: Number(r.top_competitor_sov),
    avgSentiment: r.avg_sentiment !== null ? Number(r.avg_sentiment) : null,
    totalRuns: Number(r.total_runs),
  }));

  // SOV de la marca propia para la vista AI Overview (marketShare ya filtra por llm_key)
  const ownSov = marketShare.find((m) => m.brandType === "own")?.sharePct ?? 0;

  // ── AI Overview content derivation (solo cuando se filtra por "AI Overviews") ──
  const isAiOverview = llm === "gemini";

  // Métricas derivadas del texto del modelo (Topic Sections, Content Structure)
  let aio = {
    topicSections: [] as ReturnType<typeof parseAioContent>["topicSections"],
    contentStructure: [] as ReturnType<typeof parseAioContent>["contentStructure"],
    blocksAnalyzed: 0,
    responsesAnalyzed: 0,
  };
  // Métricas SERP reales de la caché semanal (Presence Rate, SERP Position)
  let serpMetrics = {
    presenceRate: null as number | null,
    avgSerpPosition: null as number | null,
    distribution: null as { pos1: number; pos2: number; pos3plus: number; noAio: number } | null,
    serpTopicSections: [] as Array<{ name: string; count: number }>,
    totalSnapshots: 0,
  };

  if (isAiOverview && providerId) {
    // Datos del texto del modelo (sin coste SERP)
    const { data: aioRuns } = await supabase
      .from("prompt_runs")
      .select("raw_response")
      .eq("workspace_id", workspace.id)
      .eq("llm_provider_id", providerId)
      .eq("status", "completed")
      .gte("created_at", periodStart.toISOString())
      .limit(5000);
    const rawResponses = (aioRuns ?? [])
      .map((r) => (r as { raw_response: string | null }).raw_response)
      .filter((r): r is string => typeof r === "string" && r.length > 0);
    aio = parseAioContent(rawResponses);

    // Datos SERP reales de la caché semanal (se generan por el CRON de Inngest)
    const { data: serpRows } = await supabase
      .from("prompt_serp_cache")
      .select("ai_overview_present, ai_overview_serp_position, ai_overview_sections")
      .eq("workspace_id", workspace.id)
      // Tomamos el snapshot más reciente de cada prompt dentro del período
      .gte("fetched_at", periodStart.toISOString())
      .order("fetched_at", { ascending: false })
      .limit(2000);

    if (serpRows && serpRows.length > 0) {
      type SerpRow = {
        ai_overview_present: boolean;
        ai_overview_serp_position: number | null;
        ai_overview_sections: Array<{ name: string; position: number }>;
      };
      const rows = serpRows as SerpRow[];
      const total = rows.length;
      const present = rows.filter((r) => r.ai_overview_present);
      const presenceRate = Math.round((present.length / total) * 1000) / 10;

      const positions = present
        .map((r) => r.ai_overview_serp_position)
        .filter((p): p is number => typeof p === "number");
      const avgSerpPosition =
        positions.length > 0
          ? Math.round((positions.reduce((s, v) => s + v, 0) / positions.length) * 10) / 10
          : null;

      const dist = { pos1: 0, pos2: 0, pos3plus: 0, noAio: 0 };
      for (const r of rows) {
        if (!r.ai_overview_present) dist.noAio++;
        else if (r.ai_overview_serp_position === 1) dist.pos1++;
        else if (r.ai_overview_serp_position === 2) dist.pos2++;
        else dist.pos3plus++;
      }

      // Secciones SERP reales: contar apariciones por nombre de sección
      const sectionCounts = new Map<string, number>();
      for (const r of present) {
        for (const s of r.ai_overview_sections ?? []) {
          if (s.name) sectionCounts.set(s.name, (sectionCounts.get(s.name) ?? 0) + 1);
        }
      }
      const serpTopicSections = Array.from(sectionCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      serpMetrics = { presenceRate, avgSerpPosition, distribution: dist, serpTopicSections, totalSnapshots: total };
    }
  }

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">Showing daily data</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Range selector */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-full px-1 py-1">
              {RANGE_OPTIONS.map(({ value, label }) => {
                const active = days === value;
                return (
                  <Link
                    key={value}
                    href={`/${slug}/dashboard?${llm ? `llm=${llm}&` : ""}range=${value}`}
                    className={[
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      active
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <ExportDashboardButton workspaceSlug={slug} days={days} llmKey={llmKey} />
            {/* Live data badge */}
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Live data
            </span>
            <RunAllPromptsButton workspaceId={workspace.id} />
            <DashboardRefreshButton
              workspaceId={workspace.id}
              slug={workspace.slug}
              llmKey={llm ?? "chatgpt"}
            />
          </div>
        </div>

        {isAiOverview ? (
          <AiOverviewDashboard
            visibility={visibility}
            visibilitySeries={visibilitySeries}
            visibilityDelta={visibilityDelta}
            ownSov={ownSov}
            avgSentiment={avgSentiment}
            sentimentDelta={sentimentDelta}
            topicSections={aio.topicSections}
            contentStructure={aio.contentStructure}
            blocksAnalyzed={aio.blocksAnalyzed}
            responsesAnalyzed={aio.responsesAnalyzed}
            rangeLabel={rangeLabel}
            presenceRate={serpMetrics.presenceRate}
            avgSerpPosition={serpMetrics.avgSerpPosition}
            serpDistribution={serpMetrics.distribution}
            serpTopicSections={serpMetrics.serpTopicSections}
            totalSnapshots={serpMetrics.totalSnapshots}
          />
        ) : (
          <>
        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Visibility */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Visibility
                </p>
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-slate-900">
                  {visibility != null ? `${visibility}%` : "—"}
                </p>
                <Delta value={visibilityDelta} suffix="%" />
              </div>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Queries completadas donde aparece la marca
              </p>
              <Sparkline values={visibilitySeries} strokeColor="#6366f1" fillColor="#6366f1" />
            </CardContent>
          </Card>

          {/* Avg Position */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Avg Position
                </p>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4 text-blue-500" aria-hidden="true" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-slate-900">
                  {avgPosition != null ? `#${avgPosition}` : "—"}
                </p>
                <Delta value={avgPositionDelta} invertColors={true} />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {rangeLabel}
                {minPosition !== null && maxPosition !== null && minPosition !== maxPosition && (
                  <span className="ml-1">· #{minPosition}–#{maxPosition}</span>
                )}
              </p>
              <Sparkline values={avgPositionSeries} strokeColor="#3b82f6" fillColor="#3b82f6" />
            </CardContent>
          </Card>

          {/* Brand Mentions */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Brand Mentions
                </p>
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-green-500" aria-hidden="true" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-slate-900">{mentionsTotal}</p>
                <Delta value={mentionsDelta} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <Sparkline values={mentionsSeries} strokeColor="#22c55e" fillColor="#22c55e" />
            </CardContent>
          </Card>

          {/* Sentiment */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Sentiment
                </p>
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <Smile className="w-4 h-4 text-amber-500" aria-hidden="true" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-3xl font-bold ${sent.color}`}>{sent.text}</p>
                {avgSentiment !== null && (
                  <span className={`text-sm font-mono font-semibold ${sent.color} opacity-75`}>
                    {fmtScore(avgSentiment)}
                  </span>
                )}
                <Delta value={sentimentDelta} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <Sparkline values={sentimentSeries} strokeColor="#f59e0b" fillColor="#f59e0b" />
            </CardContent>
          </Card>
        </div>

        {/* ── Brand Visibility Evolution ── */}
        <BrandVisibilityTrendChart data={brandVisibilityTrendMetrics} />

        {/* ── Analytics panels ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketShareDonut
            data={marketShare}
            ownBrandName={workspace.brand_name}
            badgeLabel={badgeLabel}
            workspaceId={workspace.id}
          />
          <MentionBreakdownPanel data={breakdown} badgeLabel={badgeLabel} />
        </div>

        <LlmComparisonTable
          rows={llmComparison}
          workspaceSlug={slug}
          range={days}
          activeLlmKey={llm ?? ""}
        />

        <CompetitorShareTrendsChart data={brandVisibilityTrendMetrics} badgeLabel={badgeLabel} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopCompetitorsPanel data={topCompetitors} />
          <SourcePowerRanking data={topSources} badgeLabel={badgeLabel} />
        </div>

        {/* ── Visibility Trends ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Visibility Trends
          </p>
          <TrendChart data={chartData} />
        </div>

        {/* ── Daily data table ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">
              Tendencia diaria ({dailyRangeLabel})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Visibilidad y posicion media calculadas desde runs completados; SOV medio viene de las
              metricas diarias.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Queries completadas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Queries con marca
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Visibilidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    SOV medio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Posicion media
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Brand Consistency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brandPerformanceMetrics.daily.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                      No hay registros diarios en este rango.
                    </td>
                  </tr>
                ) : (
                  brandPerformanceMetrics.daily.map((r) => {
                    const metric = metricsByDate.get(r.date);

                    return (
                      <tr key={r.date} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(`${r.date}T00:00:00`).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{r.completedRuns}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.runsWithOwnBrand}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.visibilityPct != null ? `${r.visibilityPct}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {metric?.avg_sov != null ? `${metric.avg_sov}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.avgPosition != null ? `#${r.avgPosition}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {metric?.brand_consistency != null ? `${metric.brand_consistency}%` : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent runs ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Últimas ejecuciones</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {!recentRuns || recentRuns.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">
                Aún no hay ejecuciones. Ejecuta un prompt desde la vista de Prompts.
              </p>
            ) : (
              recentRuns.map((run) => {
                const prompt = run.prompts as unknown as { text: string } | null;
                const providerRow = run.llm_providers as unknown as { name: string } | null;
                const statusColor =
                  run.status === "completed"
                    ? "text-green-600 bg-green-50"
                    : run.status === "failed"
                      ? "text-red-600 bg-red-50"
                      : run.status === "running"
                        ? "text-blue-600 bg-blue-50"
                        : "text-slate-500 bg-slate-100";

                return (
                  <div key={run.id} className="px-5 py-3 flex items-center gap-4">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${statusColor}`}
                    >
                      {run.status}
                    </span>
                    <span className="text-sm text-slate-700 flex-1 truncate">
                      {prompt?.text ?? "—"}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {providerRow?.name ?? "—"}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(run.created_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
