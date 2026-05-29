import type { SourceType } from "@/lib/sources/classify";

const LABELS: Record<SourceType, string> = {
  search_engine: "Search Engine",
  social_media: "Social Media",
  other: "Other",
};

const STYLES: Record<SourceType, string> = {
  search_engine: "bg-blue-50 text-blue-700 border-blue-100",
  social_media: "bg-purple-50 text-purple-700 border-purple-100",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

export function SourceTypeBadge({ type }: { type: SourceType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[type]}`}
    >
      {LABELS[type]}
    </span>
  );
}
