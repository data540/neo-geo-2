import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const IN_BATCH_SIZE = 500;

type CompletedRunRow = {
  id: string;
  completed_at: string | null;
};

type OwnMentionRow = {
  id: string;
  prompt_run_id: string | null;
  position: number | null;
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
  values: Record<string, number | null>;
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
  runIds: Set<string>;
  bestPositions: Map<string, number>;
};

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

function pct(part: number, total: number): number | null {
  return total > 0 ? round1((part / total) * 100) : null;
}

function getWorkspaceTimeZone(country?: string | null): string {
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
  ownMentions: OwnBrandRunMentions
): BrandPerformancePeriodMetrics {
  const completedRuns = runs.length;
  const runsWithOwnBrand = runs.filter((run) => ownMentions.runIds.has(run.id)).length;
  const positions = runs
    .map((run) => ownMentions.bestPositions.get(run.id))
    .filter((position): position is number => typeof position === "number");

  return {
    completedRuns,
    runsWithOwnBrand,
    visibilityPct: pct(runsWithOwnBrand, completedRuns),
    avgPosition:
      positions.length > 0
        ? round1(positions.reduce((sum, position) => sum + position, 0) / positions.length)
        : null,
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

    while (cursor <= currentEnd) {
      keys.add(formatDateKey(cursor, timeZone));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    keys.add(formatDateKey(currentEnd, timeZone));
  }

  const byDate = new Map<
    string,
    { completedRuns: number; runsWithOwnBrand: number; positions: number[] }
  >();

  for (const run of runs) {
    if (!run.completed_at) continue;
    const date = formatDateKey(run.completed_at, timeZone);
    keys.add(date);
    const current = byDate.get(date) ?? {
      completedRuns: 0,
      runsWithOwnBrand: 0,
      positions: [],
    };
    current.completedRuns += 1;
    if (ownMentions.runIds.has(run.id)) current.runsWithOwnBrand += 1;
    const position = ownMentions.bestPositions.get(run.id);
    if (typeof position === "number") current.positions.push(position);
    byDate.set(date, current);
  }

  return [...keys].sort().map((date) => {
    const row = byDate.get(date) ?? { completedRuns: 0, runsWithOwnBrand: 0, positions: [] };
    return {
      date,
      completedRuns: row.completedRuns,
      runsWithOwnBrand: row.runsWithOwnBrand,
      visibilityPct: pct(row.runsWithOwnBrand, row.completedRuns),
      avgPosition:
        row.positions.length > 0
          ? round1(
              row.positions.reduce((sum, position) => sum + position, 0) / row.positions.length
            )
          : null,
    };
  });
}

async function fetchCompletedRuns(params: {
  workspaceId: string;
  llmProviderId?: string | null;
  sinceIso?: string | null;
  untilIso?: string | null;
}): Promise<CompletedRunRow[]> {
  const supabase = await createClient();
  const rows: CompletedRunRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("prompt_runs")
      .select("id, completed_at")
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
}): Promise<OwnBrandRunMentions> {
  const supabase = await createClient();
  const ownMentionRunIds = new Set<string>();
  const bestPositions = new Map<string, number>();

  for (let start = 0; start < params.runIds.length; start += IN_BATCH_SIZE) {
    const batch = params.runIds.slice(start, start + IN_BATCH_SIZE);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("mentions")
        .select("id, prompt_run_id, position")
        .eq("workspace_id", params.workspaceId)
        .eq("brand_type", "own")
        .in("prompt_run_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as OwnMentionRow[];
      for (const row of page) {
        if (!row.prompt_run_id) continue;
        ownMentionRunIds.add(row.prompt_run_id);

        if (typeof row.position === "number" && Number.isFinite(row.position)) {
          const current = bestPositions.get(row.prompt_run_id);
          if (current === undefined || row.position < current) {
            bestPositions.set(row.prompt_run_id, row.position);
          }
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  return { runIds: ownMentionRunIds, bestPositions };
}

export async function getWorkspaceBrandPerformanceMetrics(params: {
  workspaceId: string;
  country?: string | null;
  days: number;
  llmProviderId?: string | null;
}): Promise<WorkspaceBrandPerformanceMetrics> {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - params.days);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - params.days);

  const runs = await fetchCompletedRuns({
    workspaceId: params.workspaceId,
    llmProviderId: params.llmProviderId,
    sinceIso: previousStart.toISOString(),
    untilIso: now.toISOString(),
  });

  const ownMentions = await fetchOwnMentionRunIds({
    workspaceId: params.workspaceId,
    runIds: runs.map((run) => run.id),
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

  for (const mention of mentions) {
    if (!mention.prompt_run_id || !mention.brand_type) continue;
    const bucketKey = runBucket.get(mention.prompt_run_id);
    if (!bucketKey) continue;

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

    return {
      date: bucket.key,
      label: bucket.label,
      completedRuns,
      values,
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
