"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { MarketShareEntry } from "@/types";

interface Props {
  data: MarketShareEntry[];
  ownBrandName: string;
  badgeLabel?: string;
}

const PALETTE = [
  "#4f46e5", // indigo (own)
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#ec4899", // pink
  "#0ea5e9", // sky
  "#22c55e", // green
  "#eab308", // amber
  "#64748b", // slate
  "#dc2626", // red
  "#06b6d4", // cyan
  "#8b5cf6", // violet
];

function colorForIndex(idx: number, isOwn: boolean): string {
  if (isOwn) return PALETTE[0]!;
  // Reservar índice 0 para own brand
  const offset = idx + 1;
  return PALETTE[offset % PALETTE.length]!;
}

export function MarketShareDonut({ data, ownBrandName, badgeLabel }: Props) {
  const top = data.slice(0, 10);
  const rest = data.slice(10);
  const restShare = rest.reduce((acc, r) => acc + r.sharePct, 0);
  const chartData = top.map((d, idx) => ({
    name: d.brandName,
    value: d.sharePct,
    isOwn: d.brandType === "own",
    color: colorForIndex(idx, d.brandType === "own"),
  }));
  if (restShare > 0) {
    chartData.push({
      name: `+${rest.length} más`,
      value: Math.round(restShare * 10) / 10,
      isOwn: false,
      color: "#cbd5e1",
    });
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Market Share</h3>
          <p className="text-xs text-slate-500 mt-0.5">Share of Voice normalizado</p>
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
          <p className="text-xs text-slate-500 mt-0.5">Share of Voice normalizado</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          {badgeLabel ?? "Últimos 7D"}
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

      <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
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
                <span className="ml-1.5 text-xs text-indigo-600 font-medium">(Tú)</span>
              )}
            </span>
            <div className="w-20 h-1 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, entry.value)}%`, backgroundColor: entry.color }}
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
