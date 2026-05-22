"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface PipelineRun {
  phase: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "cache_hit";
  created_at: string;
}

interface Props {
  sessionId: string;
  workspaceId: string;
  onCompleted: () => void;
  onCancelled?: () => void;
  onCancel?: () => void;
}

const PHASES = [
  { key: "init", label: "Iniciando sesión" },
  { key: "retrieve_knowledge", label: "Investigando contexto de marca" },
  { key: "generation_a", label: "Generando candidatos creativos" },
  { key: "normalize", label: "Refinando y normalizando" },
  { key: "audit", label: "Auditando cobertura" },
  { key: "prioritize", label: "Priorizando por impacto" },
  { key: "finalize", label: "Listo" },
];

const ACTIVITY_HINTS = [
  "Aplicando heurísticas GEO...",
  "Consultando base de conocimiento...",
  "Analizando cobertura de intents...",
  "Evaluando diversidad de personas...",
  "Calibrando scores de prioridad...",
  "Verificando balance branded/unbranded...",
];

function getCompletedCount(runs: Record<string, PipelineRun>): number {
  return PHASES.filter((p) => {
    const run = runs[p.key];
    return run?.status === "completed" || run?.status === "cache_hit";
  }).length;
}

function getActivePhaseLabel(runs: Record<string, PipelineRun>): string {
  for (const phase of PHASES) {
    const run = runs[phase.key];
    if (run?.status === "running" || run?.status === "queued") return phase.label;
  }
  const last = Object.values(runs).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  return last ? (PHASES.find((p) => p.key === last.phase)?.label ?? "Procesando...") : "Procesando...";
}

export function PipelineProgressPanel({ sessionId, workspaceId, onCompleted, onCancelled, onCancel }: Props) {
  const [runs, setRuns] = useState<Record<string, PipelineRun>>({});
  const [hintIndex, setHintIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const hintRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completedCount = getCompletedCount(runs);
  const progress = Math.round((completedCount / PHASES.length) * 100);
  const isComplete = completedCount >= PHASES.length;
  const isCancelled = Object.values(runs).some((r) => r.status === "cancelled");

  useEffect(() => {
    hintRef.current = setInterval(() => setHintIndex((i) => (i + 1) % ACTIVITY_HINTS.length), 4000);
    return () => { if (hintRef.current) clearInterval(hintRef.current); };
  }, []);

  useEffect(() => {
    if (isComplete) {
      setTimeout(onCompleted, 800);
    }
  }, [isComplete, onCompleted]);

  useEffect(() => {
    if (isCancelled && onCancelled) {
      onCancelled();
    }
  }, [isCancelled, onCancelled]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Cargar estado inicial
    supabase
      .from("pipeline_runs")
      .select("phase, status, created_at")
      .eq("session_id", sessionId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, PipelineRun> = {};
          for (const r of data) {
            map[r.phase as string] = r as PipelineRun;
          }
          setRuns(map);
          if (data.some((r) => r.status === "failed")) setFailed(true);
        }
      });

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`pipeline-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_runs",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as PipelineRun;
          if (row?.phase) {
            setRuns((prev) => ({ ...prev, [row.phase]: row }));
            if (row.status === "failed") setFailed(true);
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [sessionId]);

  return (
    <div className="space-y-6 py-4">
      {/* Barra de progreso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {failed ? "Error en el pipeline" : isComplete ? "¡Completado!" : getActivePhaseLabel(runs)}
          </span>
          <span className="text-slate-500">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              failed ? "bg-red-500" : isComplete ? "bg-green-500" : "bg-indigo-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {!isComplete && !failed && (
          <p className="text-xs text-slate-400 italic">{ACTIVITY_HINTS[hintIndex]}</p>
        )}
      </div>

      {/* Lista de fases */}
      <div className="space-y-2">
        {PHASES.map((phase, idx) => {
          const run = runs[phase.key];
          const status = run?.status;
          const isDone = status === "completed" || status === "cache_hit";
          const isRunning = status === "running" || status === "queued";
          const isFailed = status === "failed";
          const isPending = !status;

          return (
            <div key={phase.key} className="flex items-center gap-3 text-sm">
              <div className="w-5 flex-shrink-0 flex justify-center">
                {isDone && (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isRunning && (
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                )}
                {isFailed && (
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {isPending && (
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                )}
              </div>
              <span
                className={
                  isDone ? "text-slate-700" :
                  isRunning ? "text-indigo-700 font-medium" :
                  isFailed ? "text-red-600" :
                  "text-slate-400"
                }
              >
                [{idx + 1}/{PHASES.length}] {phase.label}
                {status === "cache_hit" && (
                  <span className="ml-2 text-xs text-emerald-600 font-medium">caché</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Botón cancelar */}
      {!isComplete && !failed && !isCancelled && onCancel && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            Cancelar generación
          </button>
        </div>
      )}

      {failed && (
        <p className="text-sm text-red-600">
          El pipeline encontró un error. Por favor, inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
