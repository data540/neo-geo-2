interface Props {
  consistency: number;
}

export function ConsistencyIndicator({ consistency }: Props) {
  const pct = Math.round(consistency);

  let dotColor = "bg-slate-300";
  if (pct >= 70) dotColor = "bg-green-500";
  else if (pct >= 40) dotColor = "bg-orange-400";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-xs tabular-nums text-slate-700">{pct}%</span>
    </div>
  );
}
