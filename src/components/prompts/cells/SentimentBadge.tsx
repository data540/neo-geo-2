import type { Sentiment } from "@/types";

interface Props {
  sentiment: Sentiment;
}

const CONFIG: Record<Sentiment, { label: string; className: string }> = {
  positive: {
    label: "Positivo",
    className: "bg-green-50 text-green-700 border border-green-200",
  },
  neutral: {
    label: "Neutral",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  negative: {
    label: "Negativo",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  no_data: {
    label: "Sin datos",
    className: "bg-slate-50 text-slate-400 border border-slate-100",
  },
};

export function SentimentBadge({ sentiment }: Props) {
  const { label, className } = CONFIG[sentiment];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
