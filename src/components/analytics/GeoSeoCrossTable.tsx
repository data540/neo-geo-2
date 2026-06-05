import type { GeoSeoCrossRow } from "@/types";

interface Props {
  rows: GeoSeoCrossRow[];
}

export function GeoSeoCrossTable({ rows }: Props) {
  const tracked = rows.filter((r) => r.status === "tracked").length;
  const opportunities = rows.filter((r) => r.status === "opportunity").length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Cruce GEO ↔ SEO</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tus prompts monitorizados frente a las búsquedas reales de Google.{" "}
          <span className="text-emerald-600 font-medium">{tracked} con tráfico</span> ·{" "}
          <span className="text-amber-600 font-medium">{opportunities} oportunidades</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-12">
          Sin prompts activos o sin datos de Search Console.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Prompt monitorizado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Búsqueda real
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Clics
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Impresiones
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Pos.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.promptText} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-700 max-w-sm truncate" title={r.promptText}>
                    {r.promptText}
                  </td>
                  <td className="px-4 py-3">
                    {r.matchedQuery ? (
                      <span className="text-slate-700">{r.matchedQuery}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        Sin tráfico real
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.matchedQuery ? r.clicks : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.matchedQuery ? r.impressions.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.position !== null ? r.position.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
