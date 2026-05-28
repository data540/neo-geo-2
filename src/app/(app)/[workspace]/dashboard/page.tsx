import { Eye, Smile, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandVisibilityTrendChart } from "@/components/dashboard/BrandVisibilityTrendChart";
import { DashboardRefreshButton } from "@/components/dashboard/DashboardRefreshButton";
import { ExportDashboardButton } from "@/components/dashboard/ExportDashboardButton";
import { LlmComparisonTable } from "@/components/dashboard/LlmComparisonTable";
import { MarketShareDonut } from "@/components/dashboard/MarketShareDonut";
import { MentionBreakdownPanel } from "@/components/dashboard/MentionBreakdownPanel";
import { RunAllPromptsButton } from "@/components/dashboard/RunAllPromptsButton";
import { SourcePowerRanking } from "@/components/dashboard/SourcePowerRanking";
import { TopCompetitorsPanel } from "@/components/dashboard/TopCompetitorsPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { Card, CardContent } from "@/components/ui/card";
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

// ── Sparkline with filled area ─────────────────────────────────────────────────
function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height * 0.85);
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({
  values,
  strokeColor,
  fillColor,
}: {
  values: number[];
  strokeColor: string;
  fillColor: string;
}) {
  const width = 220;
  const height = 42;
  const linePath = buildSparklinePath(values, width, height);
  const areaPath = linePath ? `${linePath} L ${width} ${height} L 0 ${height} Z` : "";

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-10"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        {areaPath && <path d={areaPath} fill={fillColor} fillOpacity="0.15" stroke="none" />}
        {linePath ? (
          <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" />
        ) : (
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={strokeColor}
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
}

// ── Delta badge ────────────────────────────────────────────────────────────────
function Delta({
  value,
  invertColors = false,
  suffix = "",
}: {
  value: number | null;
  invertColors?: boolean;
  suffix?: string;
}) {
  if (value === null || value === 0) return <span className="text-xs text-slate-400">—</span>;
  const isUp = value > 0;
  const isGood = invertColors ? !isUp : isUp;
  const abs = Math.abs(value);
  const formatted = abs % 1 === 0 ? `${abs}` : `${abs.toFixed(1)}`;
  return (
    <span className={`text-sm font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
      {isUp ? "↑" : "↓"}
      {formatted}
      {suffix}
    </span>
  );
}

// ── Sentiment helpers ──────────────────────────────────────────────────────────
function sentimentLabel(score: number | null): { text: string; color: string } {
  if (score === null) return { text: "—", color: "text-slate-400" };
  if (score >= 0.2) return { text: "Positive", color: "text-emerald-600" };
  if (score <= -0.2) return { text: "Negative", color: "text-red-500" };
  return { text: "Mixed", color: "text-amber-500" };
}

function fmtScore(score: number | null): string {
  if (score === null) return "";
  return `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
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
  const { llm = "chatgpt", range = "7", country } = await searchParams;

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

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", llm)
    .single();

  if (!provider) notFound();

  // ── Load 2× period for delta calculation ──────────────────────────────────
  const { data: allMetricRows } = await supabase
    .from("daily_workspace_metrics")
    .select(
      "date, active_prompts_count, brand_mentions_count, avg_position, brand_consistency, avg_sov"
    )
    .eq("workspace_id", workspace.id)
    .eq("llm_provider_id", provider.id)
    .order("date", { ascending: false })
    .limit(days * 2);

  const rows = (allMetricRows ?? []).slice(0, days);

  // ── Current period KPIs ────────────────────────────────────────────────────
  const brandPerformanceMetrics = await getWorkspaceBrandPerformanceMetrics({
    workspaceId: workspace.id,
    country: country ?? null,
    days,
    llmProviderId: provider.id,
  });
  const brandVisibilityTrendMetrics = await getWorkspaceBrandVisibilityTrendMetrics({
    workspaceId: workspace.id,
    country: country ?? null,
    days,
    llmProviderId: provider.id,
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

  // Filtrar client-side por país si aplica (via prompt_run → prompt_id lookup)
  let sentimentRunIds: Set<string> | null = null;
  if (sentimentPromptIds !== null) {
    const { data: filteredRuns } = await supabase
      .from("prompt_runs")
      .select("id")
      .eq("workspace_id", workspace.id)
      .in("prompt_id", sentimentPromptIds.length > 0 ? sentimentPromptIds : ["__none__"]);
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
    supabase.rpc("get_workspace_market_share", { workspace_slug: slug, days, llm_key: llm, p_country_filter: country ?? null }),
    supabase.rpc("get_workspace_mention_breakdown", { workspace_slug: slug, days, llm_key: llm, p_country_filter: country ?? null }),
    supabase.rpc("get_workspace_top_competitors", {
      workspace_slug: slug,
      days,
      limit_n: 5,
      llm_key: llm,
      p_country_filter: country ?? null,
    }),
    supabase.rpc("get_workspace_top_sources", {
      workspace_slug: slug,
      days,
      limit_n: 5,
      llm_key: llm,
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
                    href={`/${slug}/dashboard?llm=${llm}&range=${value}`}
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
            <ExportDashboardButton workspaceSlug={slug} days={days} llmKey={llm} />
            {/* Live data badge */}
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Live data
            </span>
            <RunAllPromptsButton workspaceId={workspace.id} />
            <DashboardRefreshButton workspaceId={workspace.id} slug={workspace.slug} llmKey={llm} />
          </div>
        </div>

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

        {/* ── Analytics panels ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketShareDonut
            data={marketShare}
            ownBrandName={workspace.brand_name}
            badgeLabel={badgeLabel}
          />
          <MentionBreakdownPanel data={breakdown} badgeLabel={badgeLabel} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopCompetitorsPanel data={topCompetitors} />
          <SourcePowerRanking data={topSources} />
        </div>

        <LlmComparisonTable
          rows={llmComparison}
          workspaceSlug={slug}
          range={days}
          activeLlmKey={llm}
        />

        {/* ── Visibility Trends ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Visibility Trends
          </p>
          <BrandVisibilityTrendChart data={brandVisibilityTrendMetrics} />
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
      </div>
    </div>
  );
}
