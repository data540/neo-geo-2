"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PrioritizedPrompt, RiskIfBrandAbsent } from "@/types";

interface Props {
  prompts: PrioritizedPrompt[];
  onActivate: (selectedIds: string[], candidateIds: string[]) => Promise<void>;
  candidateIdMap: Record<string, string>;
  loading: boolean;
}

const RISK_BADGE: Record<RiskIfBrandAbsent, { label: string; className: string }> = {
  high: {
    label: "Riesgo alto",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  medium: {
    label: "Riesgo medio",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  low: {
    label: "Riesgo bajo",
    className: "bg-green-50 text-green-700 border border-green-200",
  },
};

export function PromptPrioritizerPanel({ prompts, onActivate, candidateIdMap, loading }: Props) {
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(
    () => new Set(prompts.map((p) => p.prompt))
  );

  function toggle(promptText: string) {
    setSelectedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(promptText)) {
        next.delete(promptText);
      } else {
        next.add(promptText);
      }
      return next;
    });
  }

  async function handleActivate() {
    const selected = prompts.filter((p) => selectedPrompts.has(p.prompt));
    const candidateIds = selected
      .map((p) => candidateIdMap[p.prompt])
      .filter((id): id is string => !!id);
    await onActivate(Array.from(selectedPrompts), candidateIds);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Selecciona los prompts que quieres activar para monitorización. Los más prioritarios
        aparecen primero.
      </p>

      <div className="space-y-2">
        {prompts.map((p) => {
          const riskCfg = RISK_BADGE[p.riskIfBrandAbsent];
          const isSelected = selectedPrompts.has(p.prompt);

          return (
            // biome-ignore lint/a11y/useSemanticElements: tarjeta con patrón checkbox visual personalizado
            <div
              key={p.prompt}
              onClick={() => toggle(p.prompt)}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => e.key === " " && toggle(p.prompt)}
              className={`flex gap-4 p-4 rounded-xl border cursor-pointer select-none transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-lg font-bold text-slate-300 w-6 text-center">
                  {p.priorityRank}
                </span>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                  }`}
                >
                  {isSelected && (
                    <svg
                      aria-hidden="true"
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{p.prompt}</p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {riskCfg && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${riskCfg.className}`}
                    >
                      {riskCfg.label}
                    </span>
                  )}
                  {p.coverageArea && (
                    <span className="text-xs text-slate-400">{p.coverageArea}</span>
                  )}
                </div>

                {p.whySelected && <p className="text-xs text-slate-500 mt-1.5">{p.whySelected}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-sm text-slate-500">
          {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? "s" : ""} seleccionado
          {selectedPrompts.size !== 1 ? "s" : ""}
        </span>
        <Button
          onClick={handleActivate}
          disabled={loading || selectedPrompts.size === 0}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Activando…
            </>
          ) : (
            `Activar ${selectedPrompts.size} prompt${selectedPrompts.size !== 1 ? "s" : ""}`
          )}
        </Button>
      </div>
    </div>
  );
}
