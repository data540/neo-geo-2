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

export interface RankPoint {
  date: string;
  [brandName: string]: number | string | null;
}

interface Props {
  data: RankPoint[];
  brandNames: string[];
  ownBrandName: string;
}

const PALETTE = [
  "#6366f1", // indigo (siempre reservado para own brand)
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // rose
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

function colorForBrand(name: string, ownBrandName: string, sortedBrands: string[]): string {
  if (name === ownBrandName) return PALETTE[0]!;
  const others = sortedBrands.filter((b) => b !== ownBrandName);
  const idx = others.indexOf(name);
  return PALETTE[(idx % (PALETTE.length - 1)) + 1]!;
}

interface ChartTooltipPayload {
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const items = payload
    .filter((p) => p.value !== null && p.value !== undefined)
    .sort((a, b) => Number(a.value ?? 99) - Number(b.value ?? 99));

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-700">{String(item.dataKey)}</span>
            </div>
            <span className="font-mono font-medium text-slate-900">
              #{Number(item.value).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompetitorRankChart({ data, brandNames, ownBrandName }: Props) {
  const sortedBrands = [...brandNames].sort((a, b) => {
    if (a === ownBrandName) return -1;
    if (b === ownBrandName) return 1;
    return a.localeCompare(b);
  });

  let maxPos = 1;
  for (const point of data) {
    for (const brand of brandNames) {
      const v = point[brand];
      if (typeof v === "number" && v > maxPos) maxPos = v;
    }
  }
  const yMax = Math.ceil(maxPos) + 1;

  const totalDataPoints = data.length;
  const dataPointsWithValues = data.filter((d) =>
    brandNames.some((b) => typeof d[b] === "number")
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
          Evolución de ranking
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {totalDataPoints} puntos · {dataPointsWithValues} con datos
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {sortedBrands.map((brand) => {
          const isOwn = brand === ownBrandName;
          const color = colorForBrand(brand, ownBrandName, sortedBrands);
          return (
            <div key={brand} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-sm"
                style={{
                  width: 16,
                  height: isOwn ? 3 : 2,
                  backgroundColor: color,
                }}
              />
              <span className={isOwn ? "font-semibold text-slate-800" : "text-slate-600"}>
                {brand}
                {isOwn && " (tú)"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              reversed
              domain={[1, yMax]}
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `#${v}`}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
            {sortedBrands.map((brand) => {
              const isOwn = brand === ownBrandName;
              const color = colorForBrand(brand, ownBrandName, sortedBrands);
              return (
                <Line
                  key={brand}
                  type="monotone"
                  dataKey={brand}
                  stroke={color}
                  strokeWidth={isOwn ? 3 : 2}
                  strokeDasharray={isOwn ? undefined : "4 3"}
                  dot={{ r: isOwn ? 4 : 3, fill: color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
