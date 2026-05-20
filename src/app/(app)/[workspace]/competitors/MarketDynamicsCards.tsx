import { TrendingDown, TrendingUp } from "lucide-react";

export interface CompetitorDynamic {
  competitorId: string;
  name: string;
  trend: "rising" | "declining" | "stable";
  sovDelta: number | null;
  visDelta: number | null;
  posDelta: number | null;
}

interface Props {
  competitors: CompetitorDynamic[];
  periodDays: number;
}

function formatDelta(value: number | null, unit: "%" | ""): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}

function deltaColor(value: number | null, inverted = false): string {
  if (value === null || value === 0) return "text-slate-500";
  const positive = inverted ? value < 0 : value > 0;
  return positive ? "text-emerald-600" : "text-rose-600";
}

function avatarColor(name: string): { bg: string; text: string } {
  const palette = [
    { bg: "bg-rose-100", text: "text-rose-700" },
    { bg: "bg-red-100", text: "text-red-700" },
    { bg: "bg-sky-100", text: "text-sky-700" },
    { bg: "bg-orange-100", text: "text-orange-700" },
    { bg: "bg-blue-100", text: "text-blue-700" },
    { bg: "bg-purple-100", text: "text-purple-700" },
    { bg: "bg-emerald-100", text: "text-emerald-700" },
    { bg: "bg-amber-100", text: "text-amber-700" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % palette.length;
  return palette[hash]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
}

export function MarketDynamicsCards({ competitors, periodDays }: Props) {
  if (competitors.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">
        No hay datos suficientes para calcular dinámicas de mercado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
          Dinámica de mercado
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Cambio en los últimos {periodDays} días</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {competitors.map((c) => {
          const avatar = avatarColor(c.name);
          return (
            <div
              key={c.competitorId}
              className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold ${avatar.bg} ${avatar.text}`}
                  >
                    {initials(c.name)}
                  </div>
                  <p className="font-medium text-slate-800 text-sm truncate">{c.name}</p>
                </div>
                {c.trend === "rising" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-semibold flex-shrink-0">
                    <TrendingUp className="w-3 h-3" />
                    Subiendo
                  </span>
                ) : c.trend === "declining" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold flex-shrink-0">
                    <TrendingDown className="w-3 h-3" />
                    Bajando
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[10px] font-semibold flex-shrink-0">
                    Estable
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div>
                  <span className="text-slate-400">SOV</span>{" "}
                  <span className={`font-semibold ${deltaColor(c.sovDelta)}`}>
                    {formatDelta(c.sovDelta, "%")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Vis</span>{" "}
                  <span className={`font-semibold ${deltaColor(c.visDelta)}`}>
                    {formatDelta(c.visDelta, "%")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Pos</span>{" "}
                  <span className={`font-semibold ${deltaColor(c.posDelta, true)}`}>
                    {formatDelta(c.posDelta, "")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
