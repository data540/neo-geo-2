"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  acceptPromptsAction,
  auditCoverageAction,
  generatePromptsAction,
  prioritizePromptsAction,
} from "@/actions/geo-research";
import type { CoverageAuditResult, PrioritizedPrompt, PromptCandidate } from "@/types";
import { CoverageAuditPanel } from "./CoverageAuditPanel";
import { PromptCandidateGrid } from "./PromptCandidateGrid";
import { PromptPrioritizerPanel } from "./PromptPrioritizerPanel";
import { ResearchContextForm } from "./ResearchContextForm";
import { WizardStepIndicator } from "./WizardStepIndicator";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  brandName: string;
  domain: string;
  brandStatement: string;
  country: string;
  competitors: string[];
}

export function GeoResearchWizard({
  workspaceId,
  workspaceSlug,
  brandName,
  domain,
  brandStatement,
  country,
  competitors,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Paso 2
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PromptCandidate[]>([]);

  // Paso 3
  const [coverageResult, setCoverageResult] = useState<CoverageAuditResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [category, setCategory] = useState("");

  // Paso 4
  const [prioritized, setPrioritized] = useState<PrioritizedPrompt[]>([]);

  // Mapa de promptText → candidateId para poder activar
  const candidateIdMap: Record<string, string> = {};
  for (const c of candidates) {
    candidateIdMap[c.prompt] = c.id;
  }

  async function handleGeneratePrompts(formData: FormData) {
    setLoading(true);
    setCategory((formData.get("category") as string) || "");

    const result = await generatePromptsAction(formData);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Error al generar prompts");
      return;
    }

    setSessionId(result.data?.sessionId ?? null);
    setCandidates(result.data?.candidates ?? []);
    setStep(2);
  }

  async function handleAuditCoverage(ids: string[]) {
    if (!sessionId) return;
    setLoading(true);
    setSelectedIds(ids);

    const result = await auditCoverageAction(workspaceId, sessionId, brandName, category);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Error al auditar cobertura");
      return;
    }

    setCoverageResult(result.data ?? null);
    setStep(3);
  }

  async function handlePrioritize() {
    if (!sessionId) return;
    setLoading(true);

    const result = await prioritizePromptsAction(workspaceId, sessionId, selectedIds.length);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Error al priorizar prompts");
      return;
    }

    setPrioritized(result.data ?? []);
    setStep(4);
  }

  async function handleActivate(_selectedTexts: string[], candidateIds: string[]) {
    if (!sessionId) return;
    setLoading(true);

    const result = await acceptPromptsAction({
      workspaceId,
      sessionId,
      selectedIds: candidateIds,
    });

    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Error al activar prompts");
      return;
    }

    toast.success("¡Prompts activados correctamente!");
    router.push(`/${workspaceSlug}/prompts`);
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <WizardStepIndicator currentStep={step} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {step === 1 && (
          <>
            <h2 className="text-base font-semibold text-slate-900 mb-6">Contexto de la marca</h2>
            <ResearchContextForm
              defaultValues={{
                workspaceId,
                brandName,
                domain,
                brandStatement,
                country,
                competitors,
              }}
              onSubmit={handleGeneratePrompts}
              loading={loading}
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-slate-900">
                Prompts candidatos generados
              </h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-indigo-600 hover:underline"
              >
                ← Volver
              </button>
            </div>
            <PromptCandidateGrid
              candidates={candidates}
              onContinue={handleAuditCoverage}
              loading={loading}
            />
          </>
        )}

        {step === 3 && coverageResult && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-slate-900">Auditoría de cobertura</h2>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-indigo-600 hover:underline"
              >
                ← Volver
              </button>
            </div>
            <CoverageAuditPanel
              result={coverageResult}
              onContinue={handlePrioritize}
              loading={loading}
            />
          </>
        )}

        {step === 4 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-slate-900">Ranking y activación</h2>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-sm text-indigo-600 hover:underline"
              >
                ← Volver
              </button>
            </div>
            <PromptPrioritizerPanel
              prompts={prioritized}
              onActivate={handleActivate}
              candidateIdMap={candidateIdMap}
              loading={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
