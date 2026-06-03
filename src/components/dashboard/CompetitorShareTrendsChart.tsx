"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkspaceBrandVisibilityTrendMetrics } from "@/lib/metrics/visibility";

type Props = {
  data: WorkspaceBrandVisibilityTrendMetrics;
  badgeLabel?: string;
};

type ChartRow = {
  date: string;
  label: string;
  completedRuns: number;
} & Record<string, number | string | null>;

// biome-ignore lint/suspicious/noExplicitAny: recharts tooltip payload is runtime-shaped.
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="text-xs font-semibold text-slate-600 mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map(
          // biome-ignore lint/suspicious/noExplicitAny: recharts entry type is runtime-shaped.
          (entry: any) => {
            if (entry.value == null) return null;
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-5">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-600 truncate">{entry.name}</span>
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {Number(entry.value).toFixed(1)}%
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export function CompetitorShareTrendsChart({ data, badgeLabel }: Props) {
  const metricKeys = data.brands.map((brand, index) => ({
    ...brand,
    dataKey: `brand_${index}`,
  }));

  const chartData: ChartRow[] = data.series.map((point) => {
    const rawValues = metricKeys.map((b) => point.values[b.key] ?? 0);
    const total = rawValues.reduce((sum, v) => sum + v, 0);

    const row: ChartRow = {
      date: point.date,
      label: point.label,
      completedRuns: point.completedRuns,
    };

    for (const brand of metricKeys) {
      const raw = point.values[brand.key] ?? null;
      row[brand.dataKey] =
        raw !== null && total > 0 ? Math.round((raw / total) * 1000) / 10 : null;
    }

    return row;
  });

  const hasData = chartData.some((point) => point.completedRuns > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Competitor Share Trends</h2>
          <p className="text-xs text-slate-500 mt-0.5">Share of Voice over time vs top competitors</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          {badgeLabel ?? "Last 7 days"}
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {!hasData ? (
          <div className="flex items-center justify-center h-64 rounded-2xl bg-slate-50 text-sm text-slate-400">
            No hay ejecuciones completadas en este periodo.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              {metricKeys.map((brand) => (
                <Line
                  key={brand.key}
                  type="monotone"
                  dataKey={brand.dataKey}
                  name={brand.brandName}
                  stroke={brand.color}
                  strokeWidth={brand.brandType === "own" ? 2.5 : 1.75}
                  strokeDasharray={brand.brandType === "own" ? undefined : "5 5"}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
          {metricKeys.map((brand) => (
            <div key={brand.key} className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: brand.color }} />
              <span>{brand.brandName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
