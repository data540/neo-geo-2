import { ShieldCheck } from "lucide-react";

export interface BrandConsistencyStats {
  total: number;
  passing: number;
  failing: number;
  score: number;
  failingPrompts: Array<{ text: string; rate: number }>;
}

interface Props {
  stats: BrandConsistencyStats;
}

export function BrandConsistencySummary({ stats }: Props) {
  const { total, passing, failing, score, failingPrompts } = stats;

  let iconBg = "bg-red-50";
  let iconColor = "text-red-500";
  let scoreColor = "text-red-600";
  if (score >= 70) {
    iconBg = "bg-green-50";
    iconColor = "text-green-600";
    scoreColor = "text-slate-900";
  } else if (score >= 40) {
    iconBg = "bg-orange-50";
    iconColor = "text-orange-500";
    scoreColor = "text-slate-900";
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Brand Consistency
          </p>
          <p className={`text-3xl font-bold mt-1.5 ${scoreColor}`}>
            {score}
            <span className="text-base font-normal text-slate-400">%</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {passing} of {total} prompts show consistent brand presence (70%+ appearance rate)
          </p>
        </div>
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <ShieldCheck className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>

      {failingPrompts.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="text-slate-300">▶</span>
            {failing} prompt{failing !== 1 ? "s" : ""} below threshold
          </summary>

          <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-medium">
                  <th className="text-left px-3 py-2">Prompt</th>
                  <th className="text-right px-3 py-2 w-28">Appearance rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {failingPrompts.map((p) => (
                  <tr key={p.text} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700 truncate max-w-0 w-full">
                      <span className="block truncate" title={p.text}>
                        {p.text}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      <span className={p.rate >= 40 ? "text-orange-500" : "text-red-500"}>
                        {Math.round(p.rate)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
