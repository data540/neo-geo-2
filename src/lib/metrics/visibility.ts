import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const IN_BATCH_SIZE = 100;

/** Cliente Supabase: el de cookies (RLS) por defecto, o uno de servicio (MCP). */
export type MetricsDbClient = Awaited<ReturnType<typeof createClient>>;

/** Un prompt tiene "presencia estable" si la marca aparece en ≥70% de sus respuestas. */
export const CONSISTENCY_THRESHOLD_PCT = 70;

type CompletedRunRow = {
  id: string;
  prompt_id: string | null;
  completed_at: string | null;
};

type RunMentionRow = {
  id: string;
  prompt_run_id: string | null;
  brand_id: string | null;
  brand_type: "own" | "competitor" | null;
  position: number | null;
  position_source: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
};

type BrandMentionRow = {
  id: string;
  prompt_run_id: string | null;
  brand_id: string | null;
  brand_name_detected: string | null;
  brand_type: "own" | "competitor" | null;
};

type BrandRow = {
  id: string;
  name: string;
  type: "own" | "competitor";
};

export type VisibilityPeriodMetrics = {
  completedRuns: number;
  runsWithOwnBrand: number;
  visibilityPct: number | null;
};

export type BrandPerformancePeriodMetrics = VisibilityPeriodMetrics & {
  avgPosition: number | null;
  minPosition: number | null;
  maxPosition: number | null;
  /** Menciones de la marca propia (con brand_id) en las respuestas del periodo. */
  ownMentions: number;
  /** Menciones propias + de competidores (con brand_id). */
  totalMentions: number;
  /** SOV = menciones propias ÷ menciones totales (misma regla que el donut). */
  sovPct: number | null;
  /** Sentimiento medio de las menciones propias, de -1 a 1. */
  avgSentiment: number | null;
  sentimentMentions: number;
  /** Prompts con al menos una respuesta en el periodo. */
  promptsWithRuns: number;
  /** Prompts con al menos una respuesta que menciona la marca. */
  promptsWithOwnBrand: number;
  /** Prompts donde la marca aparece en ≥70% de sus respuestas. */
  consistentPrompts: number;
  consistencyPct: number | null;
};

export type DailyVisibilityMetric = VisibilityPeriodMetrics & {
  date: string;
};

export type DailyBrandPerformanceMetric = BrandPerformancePeriodMetrics & {
  date: string;
};

export type WorkspaceVisibilityMetrics = {
  current: VisibilityPeriodMetrics;
  previous: VisibilityPeriodMetrics;
  deltaPct: number | null;
  daily: DailyVisibilityMetric[];
};

export type WorkspaceBrandPerformanceMetrics = {
  current: BrandPerformancePeriodMetrics;
  previous: BrandPerformancePeriodMetrics;
  visibilityDeltaPct: number | null;
  avgPositionDelta: number | null;
  daily: DailyBrandPerformanceMetric[];
};

export type BrandVisibilityTrendGranularity = "day" | "week" | "month";

export type BrandVisibilityTrendBrand = {
  key: string;
  brandId: string | null;
  brandName: string;
  brandType: "own" | "competitor";
  color: string;
};

export type BrandVisibilityTrendPoint = {
  date: string;
  label: string;
  completedRuns: number;
  /** Visibilidad: % de respuestas del periodo que mencionan la marca. */
  values: Record<string, number | null>;
  /** SOV: menciones de la marca ÷ menciones totales (propias + competidores). */
  shareValues: Record<string, number | null>;
};

export type WorkspaceBrandVisibilityTrendMetrics = {
  latestOwnVisibilityPct: number | null;
  latestLabel: string;
  latestDeltaPct: number | null;
  granularity: BrandVisibilityTrendGranularity;
  series: BrandVisibilityTrendPoint[];
  brands: BrandVisibilityTrendBrand[];
};

type OwnBrandRunMentions = {
  /** Runs con al menos una mención propia (cualquier posición). */
  runIds: Set<string>;
  bestPositions: Map<string, number>;
  ownCount: Map<string, number>;
  competitorCount: Map<string, number>;
  sentimentSum: Map<string, number>;
  sentimentCount: Map<string, number>;
};

function addTo(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function sentimentValue(row: { sentiment: string | null; sentiment_score: number | null }): number {
  if (row.sentiment_score !== null) return Number(row.sentiment_score);
  if (row.sentiment === "positive") return 1;
  if (row.sentiment === "negative") return -1;
  return 0;
}

type TrendBucket = {
  key: string;
  label: string;
  dateKeys: Set<string>;
};

type TrendBrandAccumulator = {
  brandId: string | null;
  brandName: string;
  brandType: "own" | "competitor";
  runIds: Set<string>;
  byBucket: Map<string, Set<string>>;
};

const OWN_BRAND_KEY = "own";
const OWN_BRAND_COLOR = "#1237e8";
const COMPETITOR_COLORS = [
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#64748b",
  "#dc2626",
  "#06b6d4",
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ── Reglas compartidas de métricas de marca ──────────────────────────────────
// Dashboard y Competitors deben usar exactamente estas reglas para que sus
// KPIs coincidan: misma ventana temporal y misma definición de posición.

/** Solo cuenta como posición la de un ranking real dentro de la respuesta. */
const RANKED_POSITION_SOURCES = new Set(["numbered_list", "bullet_list", "llm"]);

export function isRankedPosition(
  positionSource: string | null | undefined,
  position: number | null | undefined
): position is number {
  return (
    !!positionSource &&
    RANKED_POSITION_SOURCES.has(positionSource) &&
    typeof position === "number" &&
    Number.isFinite(position)
  );
}

/** Mejor posición rankeada de la marca en cada respuesta (una por run). */
export function bestRankedPositionsByRun(
  rows: Iterable<{
    prompt_run_id: string | null;
    position: number | null;
    position_source: string | null;
  }>
): Map<string, number> {
  const best = new Map<string, number>();
  for (const row of rows) {
    if (!row.prompt_run_id || !isRankedPosition(row.position_source, row.position)) continue;
    const current = best.get(row.prompt_run_id);
    if (current === undefined || row.position < current) best.set(row.prompt_run_id, row.position);
  }
  return best;
}

/** Media de la mejor posición por respuesta, redondeada a 1 decimal. */
export function averagePosition(bestByRun: Map<string, number>): number | null {
  if (bestByRun.size === 0) return null;
  let sum = 0;
  for (const position of bestByRun.values()) sum += position;
  return round1(sum / bestByRun.size);
}

/** Desfase en minutos de una zona horaria respecto a UTC en un instante dado. */
function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Instante UTC de la medianoche local de `dateKey` (YYYY-MM-DD) en `timeZone`. */
function zonedMidnight(dateKey: string, timeZone: string): Date {
  const utcMidnight = new Date(`${dateKey}T00:00:00.000Z`);
  const offset = timeZoneOffsetMinutes(utcMidnight, timeZone);
  const guess = new Date(utcMidnight.getTime() - offset * 60000);
  // Reajuste por si el cambio de hora cae entre medias.
  const offset2 = timeZoneOffsetMinutes(guess, timeZone);
  return offset2 === offset ? guess : new Date(utcMidnight.getTime() - offset2 * 60000);
}

/**
 * Ventana de días naturales cerrados en la zona horaria del workspace:
 * actual [currentStart, now) y anterior [previousStart, currentStart), donde
 * `now` es la medianoche de hoy. Así "7D" son los 7 últimos días completos y
 * "Ayer" es exactamente el día de ayer, igual que el gráfico de tendencia.
 * Las RPCs SQL usan la misma regla (metrics_window).
 */
export function getPeriodWindow(
  days: number,
  reference: Date = new Date(),
  timeZone: string = getWorkspaceTimeZone(null)
): { now: Date; currentStart: Date; previousStart: Date } {
  const todayKey = formatDateKey(reference, timeZone);
  return {
    now: zonedMidnight(todayKey, timeZone),
    currentStart: zonedMidnight(shiftDateKey(todayKey, -days), timeZone),
    previousStart: zonedMidnight(shiftDateKey(todayKey, -2 * days), timeZone),
  };
}

function pct(part: number, total: number): number | null {
  return total > 0 ? round1((part / total) * 100) : null;
}

export function getWorkspaceTimeZone(country?: string | null): string {
  return country === "CO" ? "America/Bogota" : "Europe/Madrid";
}

function formatDateKey(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function enumerateDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;

  while (cursor <= endKey) {
    keys.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }

  return keys;
}

function shortDateLabel(dateKey: string): string {
  return dateFromKey(dateKey).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function monthLabel(dateKey: string): string {
  return dateFromKey(dateKey).toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}

function trendGranularityForDays(days: number): BrandVisibilityTrendGranularity {
  if (days <= 90) return "day";
  if (days >= 3650) return "month";
  return "week";
}

function buildTrendBuckets(params: {
  days: number;
  runDateKeys: string[];
  timeZone: string;
}): TrendBucket[] {
  const todayKey = formatDateKey(new Date(), params.timeZone);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const granularity = trendGranularityForDays(params.days);

  if (granularity === "day") {
    const startKey = shiftDateKey(todayKey, -Math.max(params.days, 1));
    return enumerateDateKeys(startKey, yesterdayKey).map((dateKey) => ({
      key: dateKey,
      label: shortDateLabel(dateKey),
      dateKeys: new Set([dateKey]),
    }));
  }

  if (granularity === "month") {
    const eligibleRunKeys = params.runDateKeys.filter((dateKey) => dateKey < todayKey);
    const firstKey = eligibleRunKeys[0] ?? shiftDateKey(todayKey, -30);
    const monthKeys = new Set<string>();
    const buckets: TrendBucket[] = [];

    for (const dateKey of enumerateDateKeys(firstKey, yesterdayKey)) {
      const monthKey = dateKey.slice(0, 7);
      monthKeys.add(monthKey);
    }

    for (const monthKey of [...monthKeys].sort()) {
      const dateKeys = new Set(
        enumerateDateKeys(`${monthKey}-01`, `${monthKey}-31`).filter(
          (dateKey) =>
            dateKey >= firstKey && dateKey <= yesterdayKey && dateKey.slice(0, 7) === monthKey
        )
      );
      buckets.push({
        key: monthKey,
        label: monthLabel(`${monthKey}-01`),
        dateKeys,
      });
    }

    return buckets;
  }

  const startKey = shiftDateKey(todayKey, -params.days);
  const keys = enumerateDateKeys(startKey, yesterdayKey);
  const buckets: TrendBucket[] = [];

  for (let index = 0; index < keys.length; index += 7) {
    const dateKeys = keys.slice(index, index + 7);
    const first = dateKeys[0];
    const last = dateKeys.at(-1);
    if (!first || !last) continue;
    buckets.push({
      key: `${first}_${last}`,
      label:
        first === last
          ? shortDateLabel(first)
          : `${shortDateLabel(first)} - ${shortDateLabel(last)}`,
      dateKeys: new Set(dateKeys),
    });
  }

  return buckets;
}

function colorForCompetitor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }

  return COMPETITOR_COLORS[Math.abs(hash) % COMPETITOR_COLORS.length] ?? "#64748b";
}

function normalizeBrandName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function fallbackBrandKey(name: string): string {
  return `competitor-name:${normalizeBrandName(name).toLowerCase()}`;
}

function trendLatestLabel(days: number): string {
  if (days === 1) return "Yesterday";
  if (days <= 90) return "Most recent complete day";
  return "Most recent complete period";
}

function summarizeRuns(
  runs: CompletedRunRow[],
  stats: OwnBrandRunMentions
): BrandPerformancePeriodMetrics {
  let runsWithOwnBrand = 0;
  let ownMentions = 0;
  let totalMentions = 0;
  let sentimentSum = 0;
  let sentimentMentions = 0;
  let positionSum = 0;
  let positionCount = 0;
  let minPosition: number | null = null;
  let maxPosition: number | null = null;
  const byPrompt = new Map<string, { runs: number; withBrand: number }>();

  for (const run of runs) {
    const hasOwn = stats.runIds.has(run.id);
    if (hasOwn) runsWithOwnBrand += 1;

    const position = stats.bestPositions.get(run.id);
    if (position !== undefined) {
      positionSum += position;
      positionCount += 1;
      minPosition = minPosition === null ? position : Math.min(minPosition, position);
      maxPosition = maxPosition === null ? position : Math.max(maxPosition, position);
    }

    const own = stats.ownCount.get(run.id) ?? 0;
    ownMentions += own;
    totalMentions += own + (stats.competitorCount.get(run.id) ?? 0);
    sentimentSum += stats.sentimentSum.get(run.id) ?? 0;
    sentimentMentions += stats.sentimentCount.get(run.id) ?? 0;

    if (run.prompt_id) {
      const prompt = byPrompt.get(run.prompt_id) ?? { runs: 0, withBrand: 0 };
      prompt.runs += 1;
      if (hasOwn) prompt.withBrand += 1;
      byPrompt.set(run.prompt_id, prompt);
    }
  }

  let promptsWithOwnBrand = 0;
  let consistentPrompts = 0;
  for (const prompt of byPrompt.values()) {
    if (prompt.withBrand > 0) promptsWithOwnBrand += 1;
    if ((prompt.withBrand / prompt.runs) * 100 >= CONSISTENCY_THRESHOLD_PCT) consistentPrompts += 1;
  }

  return {
    completedRuns: runs.length,
    runsWithOwnBrand,
    visibilityPct: pct(runsWithOwnBrand, runs.length),
    avgPosition: positionCount > 0 ? round1(positionSum / positionCount) : null,
    minPosition,
    maxPosition,
    ownMentions,
    totalMentions,
    sovPct: pct(ownMentions, totalMentions),
    avgSentiment:
      sentimentMentions > 0 ? Math.round((sentimentSum / sentimentMentions) * 100) / 100 : null,
    sentimentMentions,
    promptsWithRuns: byPrompt.size,
    promptsWithOwnBrand,
    consistentPrompts,
    consistencyPct: pct(consistentPrompts, byPrompt.size),
  };
}

function buildDailyMetrics(
  runs: CompletedRunRow[],
  ownMentions: OwnBrandRunMentions,
  days: number,
  currentStart: Date,
  currentEnd: Date,
  timeZone: string
): DailyBrandPerformanceMetric[] {
  const keys = new Set<string>();

  if (days <= 90) {
    const cursor = new Date(currentStart);
    cursor.setUTCHours(12, 0, 0, 0);

    // currentEnd es exclusivo (medianoche de hoy): el último día es ayer.
    const lastKey = formatDateKey(new Date(currentEnd.getTime() - 1), timeZone);
    while (cursor < currentEnd) {
      const key = formatDateKey(cursor, timeZone);
      if (key <= lastKey) keys.add(key);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    keys.add(lastKey);
  }

  const runsByDate = new Map<string, CompletedRunRow[]>();

  for (const run of runs) {
    if (!run.completed_at) continue;
    const date = formatDateKey(run.completed_at, timeZone);
    keys.add(date);
    const bucket = runsByDate.get(date);
    if (bucket) bucket.push(run);
    else runsByDate.set(date, [run]);
  }

  return [...keys].sort().map((date) => ({
    date,
    ...summarizeRuns(runsByDate.get(date) ?? [], ownMentions),
  }));
}

async function fetchCompletedRuns(params: {
  workspaceId: string;
  llmProviderId?: string | null;
  sinceIso?: string | null;
  untilIso?: string | null;
  country?: string | null;
  client?: MetricsDbClient;
}): Promise<CompletedRunRow[]> {
  const supabase = params.client ?? (await createClient());
  const rows: CompletedRunRow[] = [];

  // Filtro de país: obtener prompt_ids del país indicado
  let countryPromptIds: string[] | null = null;
  if (params.country) {
    const { data: countryPrompts } = await supabase
      .from("prompts")
      .select("id")
      .eq("workspace_id", params.workspaceId)
      .eq("country", params.country);
    countryPromptIds = (countryPrompts ?? []).map((p) => p.id as string);
    if (countryPromptIds.length === 0) return [];
  }

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("prompt_runs")
      .select("id, prompt_id, completed_at")
      .eq("workspace_id", params.workspaceId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (params.sinceIso) {
      query = query.gte("completed_at", params.sinceIso);
    }

    if (params.untilIso) {
      query = query.lt("completed_at", params.untilIso);
    }

    if (params.llmProviderId) {
      query = query.eq("llm_provider_id", params.llmProviderId);
    }

    if (countryPromptIds) {
      query = query.in("prompt_id", countryPromptIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as CompletedRunRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchBrandMentions(params: {
  workspaceId: string;
  runIds: string[];
}): Promise<BrandMentionRow[]> {
  if (params.runIds.length === 0) return [];

  const supabase = await createClient();
  const rows: BrandMentionRow[] = [];

  for (let start = 0; start < params.runIds.length; start += IN_BATCH_SIZE) {
    const batch = params.runIds.slice(start, start + IN_BATCH_SIZE);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("mentions")
        .select("id, prompt_run_id, brand_id, brand_name_detected, brand_type")
        .eq("workspace_id", params.workspaceId)
        .in("prompt_run_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as BrandMentionRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

async function fetchBrandsById(params: {
  workspaceId: string;
  brandIds: string[];
}): Promise<Map<string, BrandRow>> {
  if (params.brandIds.length === 0) return new Map();

  const supabase = await createClient();
  const byId = new Map<string, BrandRow>();

  for (let start = 0; start < params.brandIds.length; start += IN_BATCH_SIZE) {
    const batch = params.brandIds.slice(start, start + IN_BATCH_SIZE);
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, type")
      .eq("workspace_id", params.workspaceId)
      .in("id", batch);

    if (error) throw error;

    for (const row of (data ?? []) as BrandRow[]) {
      byId.set(row.id, row);
    }
  }

  return byId;
}

async function fetchOwnMentionRunIds(params: {
  workspaceId: string;
  runIds: string[];
  client?: MetricsDbClient;
}): Promise<OwnBrandRunMentions> {
  const supabase = params.client ?? (await createClient());
  const stats: OwnBrandRunMentions = {
    runIds: new Set<string>(),
    bestPositions: new Map<string, number>(),
    ownCount: new Map<string, number>(),
    competitorCount: new Map<string, number>(),
    sentimentSum: new Map<string, number>(),
    sentimentCount: new Map<string, number>(),
  };

  for (let start = 0; start < params.runIds.length; start += IN_BATCH_SIZE) {
    const batch = params.runIds.slice(start, start + IN_BATCH_SIZE);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("mentions")
        .select(
          "id, prompt_run_id, brand_id, brand_type, position, position_source, sentiment, sentiment_score"
        )
        .eq("workspace_id", params.workspaceId)
        .in("brand_type", ["own", "competitor"])
        .in("prompt_run_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as RunMentionRow[];
      for (const row of page) {
        const runId = row.prompt_run_id;
        if (!runId) continue;

        if (row.brand_type === "competitor") {
          // SOV: solo menciones atribuidas a una marca registrada (igual que el donut)
          if (row.brand_id) addTo(stats.competitorCount, runId, 1);
          continue;
        }

        stats.runIds.add(runId); // visibilidad % cuenta cualquier mención propia
        if (row.brand_id) addTo(stats.ownCount, runId, 1);
        addTo(stats.sentimentSum, runId, sentimentValue(row));
        addTo(stats.sentimentCount, runId, 1);

        // AVG POSITION solo cuenta posiciones de listas reales o LLM — no orden textual
        if (isRankedPosition(row.position_source, row.position)) {
          const current = stats.bestPositions.get(runId);
          if (current === undefined || row.position < current) {
            stats.bestPositions.set(runId, row.position);
          }
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  return stats;
}

export async function getWorkspaceBrandPerformanceMetrics(params: {
  workspaceId: string;
  country?: string | null;
  days: number;
  llmProviderId?: string | null;
  /** Cliente alternativo (p. ej. service role en el MCP). Por defecto, cookies. */
  client?: MetricsDbClient;
}): Promise<WorkspaceBrandPerformanceMetrics> {
  const { now, currentStart, previousStart } = getPeriodWindow(
    params.days,
    new Date(),
    getWorkspaceTimeZone(params.country)
  );

  const runs = await fetchCompletedRuns({
    workspaceId: params.workspaceId,
    llmProviderId: params.llmProviderId,
    sinceIso: previousStart.toISOString(),
    untilIso: now.toISOString(),
    country: params.country ?? null,
    client: params.client,
  });

  const ownMentions = await fetchOwnMentionRunIds({
    workspaceId: params.workspaceId,
    runIds: runs.map((run) => run.id),
    client: params.client,
  });

  const currentRuns = runs.filter((run) => {
    if (!run.completed_at) return false;
    return new Date(run.completed_at) >= currentStart;
  });
  const previousRuns = runs.filter((run) => {
    if (!run.completed_at) return false;
    const completedAt = new Date(run.completed_at);
    return completedAt >= previousStart && completedAt < currentStart;
  });

  const current = summarizeRuns(currentRuns, ownMentions);
  const previous = summarizeRuns(previousRuns, ownMentions);
  const visibilityDeltaPct =
    current.visibilityPct !== null && previous.visibilityPct !== null
      ? round1(current.visibilityPct - previous.visibilityPct)
      : null;
  const avgPositionDelta =
    current.avgPosition !== null && previous.avgPosition !== null
      ? round1(current.avgPosition - previous.avgPosition)
      : null;

  return {
    current,
    previous,
    visibilityDeltaPct,
    avgPositionDelta,
    daily: buildDailyMetrics(
      currentRuns,
      ownMentions,
      params.days,
      currentStart,
      now,
      getWorkspaceTimeZone(params.country)
    ),
  };
}

export async function getWorkspaceBrandVisibilityTrendMetrics(params: {
  workspaceId: string;
  country?: string | null;
  days: number;
  llmProviderId?: string | null;
  ownBrandName?: string | null;
}): Promise<WorkspaceBrandVisibilityTrendMetrics> {
  const timeZone = getWorkspaceTimeZone(params.country);
  const todayKey = formatDateKey(new Date(), timeZone);
  const granularity = trendGranularityForDays(params.days);
  const paddedSince =
    params.days >= 3650
      ? null
      : shiftDateKey(todayKey, -(params.days + (granularity === "day" ? 2 : 14)));

  const runs = await fetchCompletedRuns({
    workspaceId: params.workspaceId,
    llmProviderId: params.llmProviderId,
    sinceIso: paddedSince ? dateFromKey(paddedSince).toISOString() : null,
    untilIso: new Date().toISOString(),
    country: params.country ?? null,
  });

  const runDateKeys = runs
    .map((run) => (run.completed_at ? formatDateKey(run.completed_at, timeZone) : null))
    .filter((dateKey): dateKey is string => dateKey !== null && dateKey < todayKey)
    .sort();
  const buckets = buildTrendBuckets({
    days: params.days,
    runDateKeys,
    timeZone,
  });
  const bucketByDateKey = new Map<string, string>();

  for (const bucket of buckets) {
    for (const dateKey of bucket.dateKeys) {
      bucketByDateKey.set(dateKey, bucket.key);
    }
  }

  const runBucket = new Map<string, string>();
  const completedRunsByBucket = new Map<string, number>();

  for (const run of runs) {
    if (!run.completed_at) continue;
    const dateKey = formatDateKey(run.completed_at, timeZone);
    const bucketKey = bucketByDateKey.get(dateKey);
    if (!bucketKey) continue;

    runBucket.set(run.id, bucketKey);
    completedRunsByBucket.set(bucketKey, (completedRunsByBucket.get(bucketKey) ?? 0) + 1);
  }

  const scopedRunIds = [...runBucket.keys()];
  const mentions = await fetchBrandMentions({
    workspaceId: params.workspaceId,
    runIds: scopedRunIds,
  });
  const brandIds = [
    ...new Set(
      mentions
        .map((mention) => mention.brand_id)
        .filter((brandId): brandId is string => typeof brandId === "string" && brandId.length > 0)
    ),
  ];
  const brandsById = await fetchBrandsById({
    workspaceId: params.workspaceId,
    brandIds,
  });
  const accumulators = new Map<string, TrendBrandAccumulator>();
  const seenRunBrandPairs = new Set<string>();
  // SOV por bucket: misma regla que el donut (solo menciones con brand_id).
  const mentionsByBucketBrand = new Map<string, number>();
  const totalMentionsByBucket = new Map<string, number>();

  for (const mention of mentions) {
    if (!mention.prompt_run_id || !mention.brand_type) continue;
    const bucketKey = runBucket.get(mention.prompt_run_id);
    if (!bucketKey) continue;

    if (mention.brand_id) {
      const sovKey =
        mention.brand_type === "own" ? OWN_BRAND_KEY : `competitor:${mention.brand_id}`;
      addTo(totalMentionsByBucket, bucketKey, 1);
      addTo(mentionsByBucketBrand, `${bucketKey}|${sovKey}`, 1);
    }

    const catalogBrand = mention.brand_id ? brandsById.get(mention.brand_id) : undefined;
    const brandType = mention.brand_type === "own" ? "own" : "competitor";
    const detectedName = mention.brand_name_detected
      ? normalizeBrandName(mention.brand_name_detected)
      : "";
    const brandName =
      brandType === "own"
        ? (params.ownBrandName ?? catalogBrand?.name ?? detectedName ?? "Your Brand")
        : (catalogBrand?.name ?? detectedName);
    if (!brandName) continue;

    const brandKey =
      brandType === "own"
        ? OWN_BRAND_KEY
        : mention.brand_id
          ? `competitor:${mention.brand_id}`
          : fallbackBrandKey(brandName);
    const seenKey = `${mention.prompt_run_id}:${brandKey}`;
    if (seenRunBrandPairs.has(seenKey)) continue;
    seenRunBrandPairs.add(seenKey);

    const current = accumulators.get(brandKey) ?? {
      brandId: mention.brand_id,
      brandName,
      brandType,
      runIds: new Set<string>(),
      byBucket: new Map<string, Set<string>>(),
    };
    current.runIds.add(mention.prompt_run_id);

    const bucketRunIds = current.byBucket.get(bucketKey) ?? new Set<string>();
    bucketRunIds.add(mention.prompt_run_id);
    current.byBucket.set(bucketKey, bucketRunIds);
    accumulators.set(brandKey, current);
  }

  if (!accumulators.has(OWN_BRAND_KEY)) {
    accumulators.set(OWN_BRAND_KEY, {
      brandId: null,
      brandName: params.ownBrandName ?? "Your Brand",
      brandType: "own",
      runIds: new Set<string>(),
      byBucket: new Map<string, Set<string>>(),
    });
  }

  const competitorBrands = [...accumulators.entries()]
    .filter(([, brand]) => brand.brandType === "competitor")
    .sort(
      (a, b) => b[1].runIds.size - a[1].runIds.size || a[1].brandName.localeCompare(b[1].brandName)
    )
    .slice(0, 4);
  const ownBrandAccumulator = accumulators.get(OWN_BRAND_KEY);
  if (!ownBrandAccumulator) {
    throw new Error("Own brand visibility accumulator was not initialized.");
  }

  const selectedBrands = [
    [OWN_BRAND_KEY, ownBrandAccumulator] satisfies [string, TrendBrandAccumulator],
    ...competitorBrands,
  ];
  const brands: BrandVisibilityTrendBrand[] = selectedBrands.map(([key, brand]) => ({
    key,
    brandId: brand.brandId,
    brandName: brand.brandType === "own" ? "Your Brand" : brand.brandName,
    brandType: brand.brandType,
    color: brand.brandType === "own" ? OWN_BRAND_COLOR : colorForCompetitor(brand.brandName),
  }));
  const series: BrandVisibilityTrendPoint[] = buckets.map((bucket) => {
    const completedRuns = completedRunsByBucket.get(bucket.key) ?? 0;
    const values = Object.fromEntries(
      selectedBrands.map(([key, brand]) => {
        const runsWithBrand = brand.byBucket.get(bucket.key)?.size ?? 0;
        return [key, pct(runsWithBrand, completedRuns)];
      })
    );

    const totalMentions = totalMentionsByBucket.get(bucket.key) ?? 0;
    const shareValues = Object.fromEntries(
      selectedBrands.map(([key]) => [
        key,
        pct(mentionsByBucketBrand.get(`${bucket.key}|${key}`) ?? 0, totalMentions),
      ])
    );

    return {
      date: bucket.key,
      label: bucket.label,
      completedRuns,
      values,
      shareValues,
    };
  });
  const latestPoint =
    [...series].reverse().find((point) => point.completedRuns > 0) ?? series.at(-1);
  const previousPoint =
    latestPoint != null
      ? [...series]
          .slice(0, series.indexOf(latestPoint))
          .reverse()
          .find((point) => point.completedRuns > 0)
      : undefined;
  const latestOwnVisibilityPct = latestPoint?.values[OWN_BRAND_KEY] ?? null;
  const previousOwnVisibilityPct = previousPoint?.values[OWN_BRAND_KEY] ?? null;
  const latestDeltaPct =
    latestOwnVisibilityPct !== null && previousOwnVisibilityPct !== null
      ? round1(latestOwnVisibilityPct - previousOwnVisibilityPct)
      : null;

  return {
    latestOwnVisibilityPct,
    latestLabel: trendLatestLabel(params.days),
    latestDeltaPct,
    granularity,
    series,
    brands,
  };
}

export async function getWorkspaceVisibilityMetrics(params: {
  workspaceId: string;
  country?: string | null;
  days: number;
  llmProviderId?: string | null;
}): Promise<WorkspaceVisibilityMetrics> {
  const metrics = await getWorkspaceBrandPerformanceMetrics(params);

  return {
    current: metrics.current,
    previous: metrics.previous,
    deltaPct: metrics.visibilityDeltaPct,
    daily: metrics.daily,
  };
}
