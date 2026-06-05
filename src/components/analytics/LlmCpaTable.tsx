import type { LlmCpaRow } from "@/types";

interface Props {
  rows: LlmCpaRow[];
}

function fmtUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

export function LlmCpaTable({ rows }: Props) {
  const visibleRows = [...rows].sort((a, b) => b.conversions - a.conversions);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Conversiones y CPA por LLM</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Conversiones (GA4) frente al coste de monitorización GEO de cada proveedor.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                LLM
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Conversiones
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Sesiones
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Tasa conv.
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Coste GEO
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                CPA
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((r) => (
              <tr key={r.llmKey} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{r.llmName}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {r.conversions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {r.sessions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {r.conversionRatePct !== null ? `${r.conversionRatePct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {fmtUsd(r.geoCostUsd)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                  {r.cpaUsd !== null ? fmtUsd(r.cpaUsd) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-400">
          CPA = coste de monitorización GEO ÷ conversiones atribuidas. AI Overviews tiene atribución
          limitada en GA4 (su tráfico se mezcla con la búsqueda orgánica de Google).
        </p>
      </div>
    </div>
  );
}
