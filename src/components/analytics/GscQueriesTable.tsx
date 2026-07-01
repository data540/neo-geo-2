import type { GscQueryRow } from "@/types";

interface Props {
  rows: GscQueryRow[];
}

export function GscQueriesTable({ rows }: Props) {
  const visibleRows = [...rows].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Búsquedas en Google</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Queries por las que apareces en Search Console (período seleccionado).
        </p>
      </div>
      {visibleRows.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-12">
          Sin datos de Search Console todavía.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Query
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Clics
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Impresiones
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  CTR
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.slice(0, 50).map((r) => (
                <tr key={r.query} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-700 max-w-md truncate" title={r.query}>
                    {r.query}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.clicks}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {(r.ctr * 100).toFixed(1)}%
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
