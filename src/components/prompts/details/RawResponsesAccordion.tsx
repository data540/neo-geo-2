"use client";

import type { PromptDetailRun } from "@/types";

interface Props {
  runs: PromptDetailRun[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RawResponsesAccordion({ runs }: Props) {
  if (runs.length === 0) {
    return <p className="text-xs text-slate-400 italic">Sin ejecuciones completadas todavía</p>;
  }

  return (
    <div className="space-y-1.5">
      {runs.map((run) => (
        <details
          key={run.llm_key}
          className="group rounded-md border border-slate-200 bg-white overflow-hidden"
        >
          <summary className="flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 select-none">
            <span className="font-medium text-slate-700">
              Ver respuesta de {run.llm_label}
              {run.model ? (
                <span className="text-slate-400 font-normal"> ({run.model})</span>
              ) : null}
            </span>
            <span className="text-slate-400 font-normal">{formatDate(run.completed_at)}</span>
          </summary>
          <pre className="px-3 py-2 text-xs whitespace-pre-wrap break-words text-slate-700 bg-slate-50 border-t border-slate-200 max-h-96 overflow-y-auto">
            {run.raw_response || "(respuesta vacía)"}
          </pre>
        </details>
      ))}
    </div>
  );
}
