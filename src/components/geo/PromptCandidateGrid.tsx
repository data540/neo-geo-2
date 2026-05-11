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
