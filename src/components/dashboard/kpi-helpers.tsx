// Helpers de presentación compartidos por las KPI cards del Dashboard
// (vista estándar y vista "AI Overviews").

// ── Sparkline with filled area ─────────────────────────────────────────────────
export function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height * 0.85);
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  strokeColor,
  fillColor,
}: {
  values: number[];
  strokeColor: string;
  fillColor: string;
}) {
  const width = 220;
  const height = 42;
  const linePath = buildSparklinePath(values, width, height);
  const areaPath = linePath ? `${linePath} L ${width} ${height} L 0 ${height} Z` : "";

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-10"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        {areaPath && <path d={areaPath} fill={fillColor} fillOpacity="0.15" stroke="none" />}
        {linePath ? (
          <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" />
        ) : (
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={strokeColor}
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
}

// ── Delta badge ────────────────────────────────────────────────────────────────
export function Delta({
  value,
  invertColors = false,
  suffix = "",
}: {
  value: number | null;
  invertColors?: boolean;
  suffix?: string;
}) {
  if (value === null || value === 0) return <span className="text-xs text-slate-400">—</span>;
  const isUp = value > 0;
  const isGood = invertColors ? !isUp : isUp;
  const abs = Math.abs(value);
  const formatted = abs % 1 === 0 ? `${abs}` : `${abs.toFixed(1)}`;
  return (
    <span className={`text-sm font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
      {isUp ? "↑" : "↓"}
      {formatted}
      {suffix}
    </span>
  );
}

// ── Sentiment helpers ──────────────────────────────────────────────────────────
export function sentimentLabel(score: number | null): { text: string; color: string } {
  if (score === null) return { text: "—", color: "text-slate-400" };
  if (score >= 0.2) return { text: "Positive", color: "text-emerald-600" };
  if (score <= -0.2) return { text: "Negative", color: "text-red-500" };
  return { text: "Mixed", color: "text-amber-500" };
}

export function fmtScore(score: number | null): string {
  if (score === null) return "";
  return `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
}
