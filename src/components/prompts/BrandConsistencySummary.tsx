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

  let scoreColor = "text-red-600";
  let scoreBg = "bg-red-50";
  let dotColor = "bg-red-400";
  if (score >= 70) {
    scoreColor = "text-green-600";
    scoreBg = "bg-green-50";
    dotColor = "bg-green-500";
  } else if (score >= 40) {
    scoreColor = "text-orange-500";
    scoreBg = "bg-orange-50";
    dotColor = "bg-orange-400";
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Brand Consistency Score
          </p>

          <div className="flex items-baseline gap-2 mt-1.5">
            <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
            <span className={`text-base font-normal ${scoreColor}`}>%</span>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            {passing} de {total} prompts superan el umbral (≥70%)
          </p>
        </div>

        <div
          className={`shrink-0 rounded-xl px-3 py-2 ${scoreBg} flex flex-col items-center gap-1`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
            <span>{passing} pasan</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300" aria-hidden="true" />
            <span>{failing} no pasan</span>
          </div>
        </div>
      </div>

      {failingPrompts.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1.5">
            <span className="text-slate-400">▶</span>
            {failing} prompt{failing !== 1 ? "s" : ""} por debajo del umbral
          </summary>

          <ul className="mt-2 space-y-1.5 max-h-52 overflow-y-auto">
            {failingPrompts.map((p) => (
              <li
                key={p.text}
                className="flex items-center justify-between gap-3 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5"
              >
                <span className="flex-1 min-w-0 truncate">{p.text}</span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    p.rate >= 40 ? "text-orange-500" : "text-red-500"
                  }`}
                >
                  {Math.round(p.rate)}%
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
