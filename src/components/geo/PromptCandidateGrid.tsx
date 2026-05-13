"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PromptCandidate } from "@/types";
import { PromptCandidateCard } from "./PromptCandidateCard";

interface Props {
  candidates: PromptCandidate[];
  onContinue: (selectedIds: string[]) => Promise<void>;
  loading: boolean;
}

export function PromptCandidateGrid({ candidates, onContinue, loading }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.id))
  );

  function toggleCandidate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  const selectedCount = selectedIds.size;
  const selectedCandidates = candidates.filter((candidate) => selectedIds.has(candidate.id));
  const funnelCounts = {
    top: selectedCandidates.filter((candidate) => candidate.funnel_stage === "top").length,
    middle: selectedCandidates.filter((candidate) => candidate.funnel_stage === "middle").length,
    bottom: selectedCandidates.filter((candidate) => candidate.funnel_stage === "bottom").length,
  };
  const missingFunnelStages = [
    funnelCounts.top === 0 ? "top" : null,
    funnelCounts.middle === 0 ? "middle" : null,
    funnelCounts.bottom === 0 ? "bottom" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{selectedCount}</span> de{" "}
          {candidates.length} prompts seleccionados
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-indigo-600 hover:underline"
          >
            Seleccionar todos
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs text-slate-500 hover:underline"
          >
            Deseleccionar
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700 mb-2">
          Balance por funnel (seleccionados)
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
            Top: {funnelCounts.top}
          </span>
          <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">
            Middle: {funnelCounts.middle}
          </span>
          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
            Bottom: {funnelCounts.bottom}
          </span>
        </div>
        {missingFunnelStages.length > 0 ? (
          <p className="text-xs text-rose-600 mt-2">
            Falta cobertura en: {missingFunnelStages.join(", ")}. Debes incluir top, middle y
            bottom.
          </p>
        ) : (
          <p className="text-xs text-emerald-700 mt-2">
            Cobertura completa de funnel lista para auditar.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {candidates.map((candidate) => (
          <PromptCandidateCard
            key={candidate.id}
            candidate={candidate}
            selected={selectedIds.has(candidate.id)}
            onToggle={toggleCandidate}
          />
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => onContinue(Array.from(selectedIds))}
          disabled={loading || selectedCount === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Auditando cobertura…
            </>
          ) : (
            `Auditar cobertura (${selectedCount} prompts)`
          )}
        </Button>
      </div>
    </div>
  );
}
