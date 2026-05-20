import { notFound } from "next/navigation";
import { detectBrands } from "@/lib/detection/detectBrands";
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
  searchParams: Promise<{ llm?: string }>;
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
  created_at: string;
}

interface RunRow {
  id: string;
  prompt_id: string;
  raw_response: string | null;
  created_at: string;
}

interface CompetitorPerformanceRow {
  competitorId: string;
  name: string;
  avgPosition: number | null;
  sov: number | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data";
  consistency: number;
  mentions: number;
  promptsCovered: number;
  lastSeenAt: string | null;
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
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "perplexity", label: "Perplexity" },
  { key: "deepseek", label: "DeepSeek" },
] as const;

export default async function CompetitorsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm = "chatgpt" } = await searchParams;
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

  const sixtyDaysAgoIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: completedRunsData } = await supabase
    .from("prompt_runs")
    .select("id, prompt_id, raw_response, created_at")
    .eq("workspace_id", workspace.id)
    .eq("llm_provider_id", provider?.id ?? "")
    .eq("status", "completed")
    .gte("created_at", sixtyDaysAgoIso)
    .order("created_at", { ascending: false })
    .limit(2000);

  const completedRuns = (completedRunsData ?? []) as RunRow[];
  const runIds = completedRuns.map((r) => r.id);
  const runIdToPromptId = new Map(completedRuns.map((r) => [r.id, r.prompt_id]));

  let mentions: MentionRow[] = [];
  if (runIds.length > 0) {
    const { data: mentionRows } = await supabase
      .from("mentions")
      .select("prompt_run_id, brand_id, brand_type, position, sentiment, created_at")
      .in("prompt_run_id", runIds);
    mentions = (mentionRows ?? []) as MentionRow[];
  }

  if (ownBrandData && completedRuns.length > 0 && competitors.length > 0) {
    const existingMentionKeys = new Set(
      mentions.map((m) => `${m.prompt_run_id}|${m.brand_type}|${m.brand_id ?? "own"}`)
    );

    for (const run of completedRuns) {
      if (!run.raw_response) continue;

      const detection = detectBrands({
        rawResponse: run.raw_response,
        ownBrand: {
          id: ownBrandData.id as string,
          name: ownBrandData.name as string,
          aliases: (ownBrandData.aliases as string[] | null) ?? [],
        },
        competitors: competitors.map((c) => ({
          id: c.id,
          name: c.name,
          aliases: c.aliases ?? [],
        })),
      });

      if (detection.ownBrandMentioned) {
        const ownKey = `${run.id}|own|${ownBrandData.id}`;
        if (!existingMentionKeys.has(ownKey)) {
          mentions.push({
            prompt_run_id: run.id,
            brand_id: ownBrandData.id as string,
            brand_type: "own",
            position: detection.ownBrandPosition,
            sentiment: detection.sentiment,
            created_at: run.created_at,
          });
          existingMentionKeys.add(ownKey);
        }
      }

      for (const comp of detection.competitors) {
        const compKey = `${run.id}|competitor|${comp.brandId}`;
        if (existingMentionKeys.has(compKey)) continue;
        mentions.push({
          prompt_run_id: run.id,
          brand_id: comp.brandId,
          brand_type: "competitor",
          position: comp.position,
          sentiment: comp.sentiment,
          created_at: run.created_at,
        });
        existingMentionKeys.add(compKey);
      }
    }
  }

  const ownMentions = mentions.filter((m) => m.brand_type === "own").length;
  const competitorMentionsAll = mentions.filter((m) => m.brand_type === "competitor").length;
  const sovPool = ownMentions + competitorMentionsAll;
  const totalRuns = completedRuns.length;

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
      const consistency = totalRuns > 0 ? round1((runIdsSet.size / totalRuns) * 100) : 0;
      const sov = sovPool > 0 ? round1((cMentions.length / sovPool) * 100) : null;
      const sentiment = getDominantSentiment(cMentions.map((m) => m.sentiment));
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
        consistency,
        mentions: cMentions.length,
        promptsCovered: promptIdsSet.size,
        lastSeenAt,
      };
    })
    .sort((a, b) => {
      if (a.avgPosition === null && b.avgPosition === null) return b.consistency - a.consistency;
      if (a.avgPosition === null) return 1;
      if (b.avgPosition === null) return -1;
      if (a.avgPosition !== b.avgPosition) return a.avgPosition - b.avgPosition;
      return b.consistency - a.consistency;
    });

  // KPIs de la marca propia
  const ownMentionRows = mentions.filter((m) => m.brand_type === "own");
  const ownRunsWithMention = new Set(ownMentionRows.map((m) => m.prompt_run_id)).size;
  const ownVisibility = totalRuns > 0 ? round1((ownRunsWithMention / totalRuns) * 100) : 0;
  const ownPositions = ownMentionRows
    .map((m) => m.position)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  const ownAvgPosition =
    ownPositions.length > 0
      ? round1(ownPositions.reduce((a, b) => a + b, 0) / ownPositions.length)
      : null;
  const ownSov = sovPool > 0 ? round1((ownMentions / sovPool) * 100) : null;
  const highThreats = competitorPerformance.filter((c) => (c.sov ?? 0) > (ownSov ?? 0)).length;

  // === Tendencias temporales: buckets + deltas ===
  const BUCKET_DAYS = 5;
  const TOTAL_BUCKETS = 7;
  const PERIOD_DAYS = 30;
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
      const b = buckets[i]!;
      if (t >= b.start && t < b.end) return i;
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
  const bucketPositions = new Map<string, number[]>(); // key = `${bucketIdx}|${brandId}`
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

        <div className="flex flex-wrap items-center gap-2">
          {LLM_OPTIONS.map((option) => {
            const isActive = llm === option.key;
            const href = `/${slug}/competitors?llm=${option.key}`;
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

        <CompetitorTableSortable rows={competitorPerformance} totalRuns={totalRuns} llm={llm} />

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
