import type { SourceRating } from "@/lib/sources/classify";

const LABELS: Record<SourceRating, string> = {
  low: "Low",
  mid: "Mid",
  high: "High",
};

const STYLES: Record<SourceRating, string> = {
  low: "bg-rose-50 text-rose-700 border-rose-100",
  mid: "bg-amber-50 text-amber-700 border-amber-100",
  high: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export function SourceRatingBadge({ rating }: { rating: SourceRating }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[rating]}`}
    >
      {LABELS[rating]}
    </span>
  );
}
