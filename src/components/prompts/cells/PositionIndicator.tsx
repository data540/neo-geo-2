interface Props {
  position: number | null;
}

export function PositionIndicator({ position }: Props) {
  if (position === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const barWidth = Math.max(10, 100 - (position - 1) * 12);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-800 tabular-nums w-6">#{position}</span>
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  );
}
