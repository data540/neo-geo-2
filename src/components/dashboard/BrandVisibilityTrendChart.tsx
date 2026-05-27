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
};

type ChartRow = {
  date: string;
  label: string;
  completedRuns: number;
} & Record<string, number | string | null>;

function formatPercent(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}%` : "-";
}

function formatDelta(value: number | null) {
  if (value === null || value === 0) {
    return {
      label: "-",
      className: "text-slate-400",
    };
  }

  const isUp = value > 0;
  return {
    label: `${isUp ? "+" : "-"}${Math.abs(value).toFixed(1)}%`,
    className: isUp ? "text-emerald-600" : "text-red-500",
  };
}

// biome-ignore lint/suspicious/noExplicitAny: recharts tooltip payload is runtime-shaped.
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const completedRuns = payload[0]?.payload?.completedRuns ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[220px]">
      <div className="mb-2">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className="text-[11px] text-slate-400">{completedRuns} queries completadas</p>
      </div>
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

export function BrandVisibilityTrendChart({ data }: Props) {
  const metricKeys = data.brands.map((brand, index) => ({
    ...brand,
    dataKey: `brand_${index}`,
  }));
  const chartData: ChartRow[] = data.series.map((point) => {
    const row: ChartRow = {
      date: point.date,
      label: point.label,
      completedRuns: point.completedRuns,
    };

    for (const brand of metricKeys) {
      row[brand.dataKey] = point.values[brand.key] ?? null;
    }

    return row;
  });
  const latestDelta = formatDelta(data.latestDeltaPct);
  const hasData = chartData.some((point) => point.completedRuns > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Brand Visibility</h2>
          <p className="text-xs text-slate-500 mt-0.5">AI mentions over time</p>
        </div>
        <div className="text-left lg:text-right">
          <div className="flex items-baseline gap-2 lg:justify-end">
            <p className="text-3xl font-bold text-slate-900">
              {formatPercent(data.latestOwnVisibilityPct)}
            </p>
            <span className={`text-sm font-medium ${latestDelta.className}`}>
              {latestDelta.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{data.latestLabel}</p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {!hasData ? (
          <div className="flex items-center justify-center h-72 rounded-2xl bg-slate-50 text-sm text-slate-400">
            No hay ejecuciones completadas en este periodo.
          </div>
        ) : (
          <div className="rounded-2xl bg-indigo-50/50 px-2 py-4 sm:px-4">
            <ResponsiveContainer width="100%" height={300}>
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
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  tickFormatter={(value) => `${value}%`}
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
                    dot={brand.brandType === "own" ? { r: 3, strokeWidth: 0 } : false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
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
