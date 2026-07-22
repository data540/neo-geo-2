"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  acceptPromptsAction,
  auditCoverageAction,
  cancelAutoResearchAction,
  generatePromptsAction,
  prioritizePromptsAction,
  runFullAutoResearchAction,
} from "@/actions/geo-research";
import type { CoverageAuditResult, PrioritizedPrompt, PromptCandidate } from "@/types";
import { CoverageAuditPanel } from "./CoverageAuditPanel";
import { PipelineProgressPanel } from "./PipelineProgressPanel";
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
  location?: string;
  category?: string;
  productsServices?: string;
  targetAudience?: string;
  differentiators?: string;
  competitors: string[];
  hasKnowledgeBase: boolean;
  preFilled: boolean;
}

function getStorageKey(workspaceId: string) {
  return `neo-geo:active-research-session:${workspaceId}`;
}

export function GeoResearchWizard({
  workspaceId,
  workspaceSlug,
  brandName,
  domain,
  brandStatement,
  country,
  location,
  category: initialCategory,
  productsServices,
  targetAudience,
  differentiators,
  competitors,
  hasKnowledgeBase,
  preFilled,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Pipeline asíncrono (se hidrata desde localStorage solo en el useEffect de montaje,
  // para que el render inicial coincida entre servidor y cliente)
  const [pipelineSessionId, setPipelineSessionId] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  // Paso 2
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PromptCandidate[]>([]);

  // Paso 3
  const [coverageResult, setCoverageResult] = useState<CoverageAuditResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [category, setCategory] = useState(initialCategory ?? "");

  // Paso 4
  const [prioritized, setPrioritized] = useState<PrioritizedPrompt[]>([]);

  const candidateIdMap: Record<string, string> = {};
  for (const c of candidates) {
    candidateIdMap[c.prompt] = c.id;
  }

  const startPipeline = (sid: string) => {
    setPipelineSessionId(sid);
    setPipelineRunning(true);
    localStorage.setItem(getStorageKey(workspaceId), sid);
  };

  const clearPipeline = useCallback(() => {
    setPipelineSessionId(null);
    setPipelineRunning(false);
    localStorage.removeItem(getStorageKey(workspaceId));
  }, [workspaceId]);

  // Si al montar hay una sesión activa, mostrar el panel de progreso
  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    if (stored) {
      setPipelineSessionId(stored);
      setPipelineRunning(true);
    }
  }, [workspaceId]);

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

  async function handleAutoAll(formData: FormData) {
    setCategory((formData.get("category") as string) || "");

    const result = await runFullAutoResearchAction(formData);

    if (!result.success) {
      toast.error(result.error ?? "Error al ejecutar auto-generación");
      return;
    }

    // El pipeline corre en background — mostramos el panel de progreso
    startPipeline(result.data!.sessionId);
  }

  async function handleCancelPipeline() {
    if (!pipelineSessionId) return;
    await cancelAutoResearchAction(workspaceId, pipelineSessionId);
    clearPipeline();
    toast.info("Generación cancelada");
  }

  function handlePipelineCompleted() {
    clearPipeline();
    toast.success("Pipeline completado. Puedes ver los candidatos en la pestaña GEO Research.");
    router.push(`/${workspaceSlug}/prompt-research`);
  }

  function handlePipelineCancelled() {
    clearPipeline();
    toast.info("La sesión de generación anterior ya no está activa. Puedes generar de nuevo.");
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

    const skipped = result.data?.skipped ?? 0;
    if (skipped > 0) {
      toast.success(
        `Prompts activados. Se omitieron ${skipped} que mencionaban otras marcas (este workspace solo permite tu propia marca).`
      );
    } else {
      toast.success("¡Prompts activados correctamente!");
    }
    router.push(`/${workspaceSlug}/prompts`);
  }

  // Panel de progreso del pipeline asíncrono
  if (pipelineRunning && pipelineSessionId) {
    return (
      <div className="space-y-8">
        <div className="flex justify-center">
          <WizardStepIndicator currentStep={1} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-6">
            Generando prompts con IA
          </h2>
          <PipelineProgressPanel
            sessionId={pipelineSessionId}
            workspaceId={workspaceId}
            onCompleted={handlePipelineCompleted}
            onCancelled={handlePipelineCancelled}
            onCancel={handleCancelPipeline}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <WizardStepIndicator currentStep={step} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
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
                location,
                category: initialCategory,
                productsServices,
                targetAudience,
                differentiators,
                competitors,
              }}
              onSubmit={handleGeneratePrompts}
              onAutoAll={hasKnowledgeBase ? handleAutoAll : undefined}
              loading={loading}
              autoLoading={false}
              showAutoButton={hasKnowledgeBase}
              preFilled={preFilled}
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
