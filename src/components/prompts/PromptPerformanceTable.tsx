"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { PromptPerformanceRow, RunStatus, Sentiment } from "@/types";
import { getVisibilityStatus } from "@/types";
import { ConsistencyIndicator } from "./cells/ConsistencyIndicator";
import { CountryBadge } from "./cells/CountryBadge";
import { PositionIndicator } from "./cells/PositionIndicator";
import { SentimentBadge } from "./cells/SentimentBadge";
import { SovBar } from "./cells/SovBar";
import { TagsCell } from "./cells/TagsCell";
import { DeletePromptButton } from "./DeletePromptButton";
import { PromptStatusCell } from "./PromptStatusCell";
import { PromptStatusToggle } from "./PromptStatusToggle";
import { RunPromptButton } from "./RunPromptButton";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  rows: PromptPerformanceRow[];
  workspaceId: string;
  llmKey: string;
  availableTags: Tag[];
  promptTags: Record<string, Tag[]>;
  latestStatusByPrompt: Record<string, RunStatus>;
}

const BORDER_CLASS: Record<string, string> = {
  top: "border-l-4 border-green-500",
  mentioned: "border-l-4 border-green-300",
  competitors_only: "border-l-4 border-orange-400",
  no_data: "border-l-4 border-slate-200",
};

export function PromptPerformanceTable({
  rows,
  workspaceId,
  llmKey,
  availableTags,
  promptTags,
  latestStatusByPrompt,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => rows.filter((r) => r.prompt_text.toLowerCase().includes(query.toLowerCase())),
    [rows, query]
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar prompt…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Prompt
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-28">
                Estado
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-24">
                País
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-28">
                Posición
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-32">
                SOV
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-28">
                Sentiment
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-28">
                Consistencia
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Etiquetas
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide w-20">
                Activo
              </th>
              <th className="px-3 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                  {query
                    ? "No hay prompts que coincidan con la búsqueda."
                    : "No hay prompts todavía."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const visibility = getVisibilityStatus(row);
                const borderClass = BORDER_CLASS[visibility] ?? BORDER_CLASS.no_data;
                const tags = promptTags[row.prompt_id] ?? [];

                return (
                  <tr key={row.prompt_id} className={`hover:bg-slate-50/50 ${borderClass}`}>
                    <td className="px-4 py-3">
                      <p className="text-slate-800 leading-snug line-clamp-2">{row.prompt_text}</p>
                    </td>
                    <td className="px-3 py-3">
                      <PromptStatusCell status={latestStatusByPrompt[row.prompt_id] ?? null} />
                    </td>
                    <td className="px-3 py-3">
                      <CountryBadge country={row.prompt_country} />
                    </td>
                    <td className="px-3 py-3">
                      <PositionIndicator position={row.brand_position} />
                    </td>
                    <td className="px-3 py-3">
                      <SovBar
                        sov={row.sov !== undefined ? row.sov : null}
                        competitorCount={row.competitor_count}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <SentimentBadge sentiment={(row.sentiment as Sentiment) ?? "no_data"} />
                    </td>
                    <td className="px-3 py-3">
                      <ConsistencyIndicator consistency={row.consistency_score} />
                    </td>
                    <td className="px-3 py-3">
                      <TagsCell
                        promptId={row.prompt_id}
                        workspaceId={workspaceId}
                        tags={tags}
                        availableTags={availableTags}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PromptStatusToggle
                        promptId={row.prompt_id}
                        workspaceId={workspaceId}
                        status={row.prompt_status as "active" | "paused"}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5">
                        <RunPromptButton
                          promptId={row.prompt_id}
                          workspaceId={workspaceId}
                          llmKey={llmKey}
                        />
                        <DeletePromptButton
                          promptId={row.prompt_id}
                          workspaceId={workspaceId}
                          promptText={row.prompt_text}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
