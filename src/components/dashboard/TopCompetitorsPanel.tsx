import { TrendingDown, TrendingUp } from "lucide-react";
import type { TopCompetitorEntry } from "@/types";

interface Props {
  data: TopCompetitorEntry[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 92%)`;
}

function fgFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 35%)`;
}

export function TopCompetitorsPanel({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Top Competidores</h3>
          <p className="text-xs text-slate-500 mt-0.5">Por menciones en LLMs</p>
        </div>
        <p className="text-center text-xs text-slate-400 py-12">Aún sin datos.</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.sharePct));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Top Competidores</h3>
          <p className="text-xs text-slate-500 mt-0.5">Por menciones en LLMs</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          Últimos 30D
        </span>
      </div>

      <div className="space-y-3">
        {data.map((c, idx) => {
          const trend = c.trendPct;
          const trendIsUp = trend !== null && trend > 0;
          const trendIsDown = trend !== null && trend < 0;
          return (
            <div key={c.competitorId} className="flex items-center gap-3">
              <span className="w-5 text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                {idx + 1}.
              </span>
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{
                  backgroundColor: colorFromName(c.competitorName),
                  color: fgFromName(c.competitorName),
                }}
                aria-hidden="true"
              >
                {initials(c.competitorName)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-slate-800 truncate">{c.competitorName}</p>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {c.sharePct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full"
                    style={{ width: `${Math.min(100, (c.sharePct / max) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 w-12 flex items-center justify-end text-xs">
                {trend === null ? (
                  <span className="text-slate-300">—</span>
                ) : trendIsUp ? (
                  <span className="text-emerald-600 inline-flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    {Math.abs(trend).toFixed(0)}%
                  </span>
                ) : trendIsDown ? (
                  <span className="text-red-500 inline-flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    {Math.abs(trend).toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-slate-400">0%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
