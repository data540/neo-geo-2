"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { MarketShareEntry } from "@/types";

interface Props {
  data: MarketShareEntry[];
  ownBrandName: string;
  badgeLabel?: string;
}

const OWN_COLOR = "#1237e8";
const REST_COLOR = "#cbd5e1";
const PALETTE = [
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
  "#8b5cf6",
];

function colorForBrand(name: string, isOwn: boolean): string {
  if (isOwn) return OWN_COLOR;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }

  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function MarketShareDonut({ data, ownBrandName, badgeLabel }: Props) {
  const sortedData = [...data].sort((a, b) => b.mentionsCount - a.mentionsCount);
  const visible = sortedData.slice(0, 10);
  const rest = sortedData.slice(10);
  const restShare = Math.round(rest.reduce((acc, r) => acc + r.sharePct, 0) * 10) / 10;
  const maxVisibleShare = Math.max(...visible.map((d) => d.sharePct), 1);
  const chartData = visible.map((d) => ({
    name: d.brandName,
    value: d.sharePct,
    mentionsCount: d.mentionsCount,
    isOwn: d.brandType === "own",
    color: colorForBrand(d.brandName, d.brandType === "own"),
  }));

  if (restShare > 0) {
    chartData.push({
      name: `+${rest.length} more competitors`,
      value: restShare,
      mentionsCount: rest.reduce((acc, r) => acc + r.mentionsCount, 0),
      isOwn: false,
      color: REST_COLOR,
    });
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Market Share</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            SOV normalizado sobre marcas detectadas
          </p>
        </div>
        <p className="text-center text-xs text-slate-400 py-12">Sin menciones en este rango.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Market Share</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            SOV normalizado sobre marcas detectadas
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          {badgeLabel ?? "Ultimos 7D"}
        </span>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
        Suma 100%. Incluye {ownBrandName} y competidores detectados. La tabla de competidores puede
        usar otro denominador operativo.
      </p>

      <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0 truncate text-slate-700">
              {entry.name}
              {entry.isOwn && (
                <span className="ml-1.5 text-xs text-indigo-600 font-medium">(Tu)</span>
              )}
            </span>
            <div className="w-20 h-1 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (entry.value / maxVisibleShare) * 100)}%`,
                  backgroundColor: entry.color,
                }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-900 tabular-nums w-12 text-right">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <p className="sr-only">Marca propia: {ownBrandName}</p>
    </div>
  );
}
