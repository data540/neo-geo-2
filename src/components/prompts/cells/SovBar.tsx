interface Props {
  sov: number | null;
  competitorCount: number;
}

export function SovBar({ sov, competitorCount }: Props) {
  if (sov === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const pct = Math.round(sov);

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-700 tabular-nums whitespace-nowrap">
        {pct}%
        {competitorCount > 0 && <span className="text-slate-400 ml-1">{competitorCount}c</span>}
      </span>
    </div>
  );
}
