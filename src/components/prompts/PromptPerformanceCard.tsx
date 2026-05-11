import type { PromptPerformanceRow } from "@/types";
import { PromptPerformanceTable } from "./PromptPerformanceTable";
import { PromptVisibilityLegend } from "./PromptVisibilityLegend";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  rows: PromptPerformanceRow[];
  workspaceId: string;
  llmKey: string;
  availableTags: Tag[];
  promptTags: Record<string, Tag[]>;
}

export function PromptPerformanceCard({
  rows,
  workspaceId,
  llmKey,
  availableTags,
  promptTags,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Leyenda de visibilidad</h2>
        <PromptVisibilityLegend />
      </div>

      <PromptPerformanceTable
        rows={rows}
        workspaceId={workspaceId}
        llmKey={llmKey}
        availableTags={availableTags}
        promptTags={promptTags}
      />
    </div>
  );
}
