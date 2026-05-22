"use client";

import { useEffect, useState } from "react";
import { getPromptDetailAction } from "@/actions/prompts";
import type { PromptDetail } from "@/types";
import { CompetitorsList } from "./CompetitorsList";
import { RawResponsesAccordion } from "./RawResponsesAccordion";
import { SourcesList } from "./SourcesList";

interface Props {
  promptId: string;
  visible: boolean;
  colSpan: number;
}

export function PromptDetailRow({ promptId, visible, colSpan }: Props) {
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || detail !== null || loading) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getPromptDetailAction(promptId)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setDetail(result.data);
        } else {
          setError(result.error ?? "Error al cargar el detalle");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Error al cargar el detalle");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, promptId, detail, loading]);

  if (!visible) return null;

  return (
    <tr className="bg-slate-50/60">
      <td colSpan={colSpan} className="px-6 py-4 border-l-4 border-indigo-200">
        {loading && !detail ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 w-1/3 bg-slate-200 rounded" />
            <div className="h-3 w-2/3 bg-slate-200 rounded" />
            <div className="h-3 w-1/2 bg-slate-200 rounded" />
          </div>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : detail ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-24 shrink-0">
                Competitors:
              </span>
              <CompetitorsList items={detail.competitors} />
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-24 shrink-0">
                Sources:
              </span>
              <SourcesList items={detail.sources} />
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-24 shrink-0">
                Respuestas:
              </span>
              <div className="flex-1 min-w-[280px]">
                <RawResponsesAccordion runs={detail.runs} />
              </div>
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
