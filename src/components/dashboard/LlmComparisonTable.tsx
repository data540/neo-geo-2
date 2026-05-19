import Link from "next/link";
import type { LlmComparisonRow } from "@/types";

interface Props {
  rows: LlmComparisonRow[];
  workspaceSlug: string;
  range: number;
  activeLlmKey: string;
}

function sentimentBadge(value: number | null): { label: string; color: string } {
  if (value === null) return { label: "—", color: "text-slate-400" };
  const formatted = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  if (value > 0.3) return { label: formatted, color: "text-emerald-600" };
  if (value < -0.1) return { label: formatted, color: "text-red-500" };
  return { label: formatted, color: "text-amber-600" };
}

function bgForExtreme(value: number, max: number, min: number, isPosition = false): string {
  // Para posición, "mejor" es menor; invertir lógica
  if (isPosition) {
    if (value === min) return "bg-emerald-50";
    if (value === max && max !== min) return "bg-amber-50";
    return "";
  }
  if (value === max && max > 0) return "bg-emerald-50";
  if (value === min && min !== max) return "bg-amber-50";
  return "";
}

export function LlmComparisonTable({ rows, workspaceSlug, range, activeLlmKey }: Props) {
  const visibleRows = rows.filter((r) => r.totalRuns > 0);
  if (visibleRows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Comparación entre LLMs</h3>
          <p className="text-xs text-slate-500 mt-0.5">Rendimiento de tu marca por canal de IA</p>
        </div>
        <p className="text-center text-xs text-slate-400 py-12">
          Aún no hay ejecuciones completadas en otros LLMs.
        </p>
      </div>
    );
  }

  const visMax = Math.max(...visibleRows.map((r) => r.visibilityPct));
  const visMin = Math.min(...visibleRows.map((r) => r.visibilityPct));
  const sovMax = Math.max(...visibleRows.map((r) => r.sovPct));
  const sovMin = Math.min(...visibleRows.map((r) => r.sovPct));
  const posValues = visibleRows.map((r) => r.avgRank).filter((v): v is number => v !== null);
  const posMin = posValues.length > 0 ? Math.min(...posValues) : 0;
  const posMax = posValues.length > 0 ? Math.max(...posValues) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Comparación entre LLMs</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rendimiento de tu marca por canal de IA. Haz clic en una fila para enfocar el dashboard.
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          Últimos {range}D
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                LLM
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Visibilidad
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                SOV
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Pos. media
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Top competidor
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Sentimiento
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((r) => {
              const sent = sentimentBadge(r.avgSentiment);
              const isActive = r.llmKey === activeLlmKey;
              return (
                <tr
                  key={r.llmKey}
                  className={
                    isActive ? "bg-indigo-50/40 hover:bg-indigo-50" : "hover:bg-slate-50/60"
                  }
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${workspaceSlug}/dashboard?llm=${r.llmKey}&range=${range}`}
                      className="flex items-center gap-2 group"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${isActive ? "bg-indigo-600" : "bg-slate-300"}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`text-sm font-medium ${
                          isActive
                            ? "text-indigo-700"
                            : "text-slate-700 group-hover:text-indigo-600"
                        }`}
                      >
                        {r.llmName}
                      </span>
                    </Link>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-slate-700 ${bgForExtreme(r.visibilityPct, visMax, visMin)}`}
                  >
                    {r.visibilityPct.toFixed(1)}%
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-slate-700 ${bgForExtreme(r.sovPct, sovMax, sovMin)}`}
                  >
                    {r.sovPct.toFixed(1)}%
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-slate-700 ${
                      r.avgRank !== null ? bgForExtreme(r.avgRank, posMax, posMin, true) : ""
                    }`}
                  >
                    {r.avgRank !== null ? `#${r.avgRank.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.topCompetitorName ? (
                      <span>
                        {r.topCompetitorName}{" "}
                        <span className="text-xs text-slate-400">
                          {r.topCompetitorSov.toFixed(1)}%
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${sent.color}`}>
                    {sent.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
