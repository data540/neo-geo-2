"use client";

import type { PromptDetailCompetitor } from "@/types";

interface Props {
  items: PromptDetailCompetitor[];
}

export function CompetitorsList({ items }: Props) {
  if (items.length === 0) {
    return (
      <span className="text-xs text-slate-400 italic">
        Ningún competidor mencionado en la última ejecución
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span
          key={item.name}
          title={`Mencionado en ${item.llm_count} LLM${item.llm_count !== 1 ? "s" : ""}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
        >
          {item.name}
        </span>
      ))}
    </div>
  );
}
