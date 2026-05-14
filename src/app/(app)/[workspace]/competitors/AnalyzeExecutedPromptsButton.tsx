"use client";

import { Loader2, ScanSearch } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { extractCompetitorsFromExecutedPromptsAction } from "@/actions/competitors";
import { Button } from "@/components/ui/button";

interface Props {
  workspaceId: string;
}

export function AnalyzeExecutedPromptsButton({ workspaceId }: Props) {
  const [pending, startTransition] = useTransition();

  function handleAnalyze() {
    startTransition(async () => {
      const result = await extractCompetitorsFromExecutedPromptsAction(workspaceId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "No se pudo analizar las ejecuciones");
        return;
      }

      const { analyzedRuns, detectedCandidates, createdCompetitors, createdSuggestions } = result.data;

      toast.success(
        `Analizados ${analyzedRuns} runs. Detectados ${detectedCandidates}. Nuevos competidores: ${createdCompetitors}. Sugerencias: ${createdSuggestions}.`
      );
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Extraer competidores de prompts ejecutados</h2>
        <p className="text-xs text-slate-500 mt-1">
          Analiza respuestas históricas, crea competidores detectados varias veces y deja el resto como
          sugerencias.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
        disabled={pending}
        onClick={handleAnalyze}
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
        Analizar ejecuciones
      </Button>
    </div>
  );
}
