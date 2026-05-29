"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  date: string;
  menciones: number | null;
  visibilidad: number | null;
  posicion: number | null;
  consistencia: number | null;
}

interface Props {
  data: DataPoint[];
}

type MetricKey = "menciones" | "visibilidad" | "posicion" | "consistencia";

const METRICS: {
  key: MetricKey;
  label: string;
  color: string;
  unit: string;
  yAxisId: string;
}[] = [
  { key: "menciones", label: "Menciones de marca", color: "#22c55e", unit: "", yAxisId: "left" },
  {
    key: "visibilidad",
    label: "Visibilidad (%)",
    color: "#6366f1",
    unit: "%",
    yAxisId: "right",
  },
  { key: "posicion", label: "Posición media", color: "#f59e0b", unit: "", yAxisId: "right" },
  { key: "consistencia", label: "Consistencia (%)", color: "#a855f7", unit: "%", yAxisId: "right" },
];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

// biome-ignore lint/suspicious/noExplicitAny: recharts payload type
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[170px]">
      <p className="text-xs font-semibold text-slate-500 mb-2">{formatDate(label)}</p>
      {payload.map(
        // biome-ignore lint/suspicious/noExplicitAny: recharts entry type
        (entry: any) => {
          const metric = METRICS.find((m) => m.key === entry.dataKey);
          if (entry.value == null) return null;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-600">{metric?.label ?? entry.dataKey}</span>
              </span>
              <span className="font-semibold text-slate-900">
                {entry.value}
                {metric?.unit}
              </span>
            </div>
          );
        }
      )}
    </div>
  );
}

export function TrendChart({ data }: Props) {
  const [active, setActive] = useState<Set<MetricKey>>(
    new Set(["menciones", "visibilidad", "posicion"])
  );

  function toggle(key: MetricKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const hasData = data.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Evolución temporal</h2>
          <p className="text-xs text-slate-400 mt-0.5">Métricas diarias acumuladas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => {
            const on = active.has(m.key);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggle(m.key)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                  on
                    ? "border-transparent text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-400 hover:text-slate-600",
                ].join(" ")}
                style={on ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: on ? "white" : m.color }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            No hay datos en este rango de fechas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {METRICS.map((m) =>
                active.has(m.key) ? (
                  <Line
                    key={m.key}
                    yAxisId={m.yAxisId}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
