"use client";

import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoverageAuditResult } from "@/types";

interface Props {
  result: CoverageAuditResult;
  onContinue: () => Promise<void>;
  loading: boolean;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-500";
  const bgColor =
    score >= 75 ? "stroke-green-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500";

  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg aria-hidden="true" className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={bgColor}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600">Cobertura</span>
    </div>
  );
}

export function CoverageAuditPanel({ result, onContinue, loading }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <ScoreGauge score={result.coverageScore} />

        <div className="flex-1 space-y-4">
          {result.mainGaps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Huecos de cobertura
              </h3>
              <ul className="space-y-1.5">
                {result.mainGaps.map((gap) => (
                  <li key={gap} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendedNewPrompts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-500" />
                Prompts recomendados
              </h3>
              <ul className="space-y-1.5">
                {result.recommendedNewPrompts.map((p) => (
                  <li
                    key={p}
                    className="text-sm text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.duplicatedOrWeakPrompts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Prompts débiles o duplicados
              </h3>
              <ul className="space-y-1 text-sm text-slate-500">
                {result.duplicatedOrWeakPrompts.map((p) => (
                  <li key={p} className="line-through opacity-60">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {result.finalRecommendation && (
        <div
          className={`flex gap-3 p-4 rounded-xl border text-sm ${
            result.coverageScore >= 70
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {result.coverageScore >= 70 ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p>{result.finalRecommendation}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onContinue}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Priorizando…
            </>
          ) : (
            "Continuar → Priorizar prompts"
          )}
        </Button>
      </div>
    </div>
  );
}
