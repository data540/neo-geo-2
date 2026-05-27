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
};

export type VisibilityPeriodMetrics = {
  completedRuns: number;
  runsWithOwnBrand: number;
  visibilityPct: number | null;
};

export type DailyVisibilityMetric = VisibilityPeriodMetrics & {
  date: string;
};

export type WorkspaceVisibilityMetrics = {
  current: VisibilityPeriodMetrics;
  previous: VisibilityPeriodMetrics;
  deltaPct: number | null;
  daily: DailyVisibilityMetric[];
};

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

function summarizeRuns(
  runs: CompletedRunRow[],
  ownMentionRunIds: Set<string>
): VisibilityPeriodMetrics {
  const completedRuns = runs.length;
  const runsWithOwnBrand = runs.filter((run) => ownMentionRunIds.has(run.id)).length;

  return {
    completedRuns,
    runsWithOwnBrand,
    visibilityPct: pct(runsWithOwnBrand, completedRuns),
  };
}

function buildDailyMetrics(
  runs: CompletedRunRow[],
  ownMentionRunIds: Set<string>,
  days: number,
  currentStart: Date,
  currentEnd: Date,
  timeZone: string
): DailyVisibilityMetric[] {
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

  const byDate = new Map<string, { completedRuns: number; runsWithOwnBrand: number }>();

  for (const run of runs) {
    if (!run.completed_at) continue;
    const date = formatDateKey(run.completed_at, timeZone);
    keys.add(date);
    const current = byDate.get(date) ?? { completedRuns: 0, runsWithOwnBrand: 0 };
    current.completedRuns += 1;
    if (ownMentionRunIds.has(run.id)) current.runsWithOwnBrand += 1;
    byDate.set(date, current);
  }

  return [...keys].sort().map((date) => {
    const row = byDate.get(date) ?? { completedRuns: 0, runsWithOwnBrand: 0 };
    return {
      date,
      completedRuns: row.completedRuns,
      runsWithOwnBrand: row.runsWithOwnBrand,
      visibilityPct: pct(row.runsWithOwnBrand, row.completedRuns),
    };
  });
}

async function fetchCompletedRuns(params: {
  workspaceId: string;
  llmProviderId?: string | null;
  sinceIso: string;
  untilIso: string;
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
      .gte("completed_at", params.sinceIso)
      .lt("completed_at", params.untilIso)
      .order("completed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

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

async function fetchOwnMentionRunIds(params: {
  workspaceId: string;
  runIds: string[];
}): Promise<Set<string>> {
  const supabase = await createClient();
  const ownMentionRunIds = new Set<string>();

  for (let start = 0; start < params.runIds.length; start += IN_BATCH_SIZE) {
    const batch = params.runIds.slice(start, start + IN_BATCH_SIZE);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("mentions")
        .select("id, prompt_run_id")
        .eq("workspace_id", params.workspaceId)
        .eq("brand_type", "own")
        .in("prompt_run_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as OwnMentionRow[];
      for (const row of page) {
        if (row.prompt_run_id) ownMentionRunIds.add(row.prompt_run_id);
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  return ownMentionRunIds;
}

export async function getWorkspaceVisibilityMetrics(params: {
  workspaceId: string;
  country?: string | null;
  days: number;
  llmProviderId?: string | null;
}): Promise<WorkspaceVisibilityMetrics> {
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

  const ownMentionRunIds = await fetchOwnMentionRunIds({
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

  const current = summarizeRuns(currentRuns, ownMentionRunIds);
  const previous = summarizeRuns(previousRuns, ownMentionRunIds);
  const deltaPct =
    current.visibilityPct !== null && previous.visibilityPct !== null
      ? round1(current.visibilityPct - previous.visibilityPct)
      : null;

  return {
    current,
    previous,
    deltaPct,
    daily: buildDailyMetrics(
      currentRuns,
      ownMentionRunIds,
      params.days,
      currentStart,
      now,
      getWorkspaceTimeZone(params.country)
    ),
  };
}
