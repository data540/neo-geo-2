"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface CompetitorPerformanceRow {
  competitorId: string;
  name: string;
  avgPosition: number | null;
  sov: number | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data";
  consistency: number;
  mentions: number;
  promptsCovered: number;
  lastSeenAt: string | null;
}

interface Props {
  rows: CompetitorPerformanceRow[];
  totalRuns: number;
  llm: string;
}

type SortKey =
  | "name"
  | "avgPosition"
  | "sov"
  | "sentiment"
  | "consistency"
  | "mentions"
  | "promptsCovered"
  | "lastSeenAt";

const SENTIMENT_ORDER = { positive: 0, neutral: 1, negative: 2, no_data: 3 };

function sentimentClass(sentiment: CompetitorPerformanceRow["sentiment"]): string {
  const map = {
    positive: "bg-green-50 text-green-700 border-green-200",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
    negative: "bg-red-50 text-red-700 border-red-200",
    no_data: "bg-slate-50 text-slate-400 border-slate-200",
  };
  return map[sentiment];
}

function sentimentLabel(sentiment: CompetitorPerformanceRow["sentiment"]): string {
  const map = {
    positive: "positivo",
    neutral: "neutral",
    negative: "negativo",
    no_data: "sin datos",
  };
  return map[sentiment];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  activeSortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  tooltip?: string;
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  activeSortDir,
  onSort,
  align = "right",
  tooltip,
}: SortableHeaderProps) {
  const isActive = activeSortKey === sortKey;
  return (
    <th className={`px-4 py-3 text-slate-500 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-800 transition-colors ${align === "right" ? "flex-row-reverse" : ""} ${isActive ? "text-slate-800" : ""}`}
      >
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
        {isActive ? (
          activeSortDir === "asc" ? (
            <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
          )
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </button>
    </th>
  );
}

export function CompetitorTableSortable({ rows, totalRuns, llm }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("consistency");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "avgPosition" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name, "es");
        case "avgPosition": {
          if (a.avgPosition === null && b.avgPosition === null) return 0;
          if (a.avgPosition === null) return 1;
          if (b.avgPosition === null) return -1;
          return dir * (a.avgPosition - b.avgPosition);
        }
        case "sov": {
          if (a.sov === null && b.sov === null) return 0;
          if (a.sov === null) return 1;
          if (b.sov === null) return -1;
          return dir * (a.sov - b.sov);
        }
        case "sentiment":
          return dir * (SENTIMENT_ORDER[a.sentiment] - SENTIMENT_ORDER[b.sentiment]);
        case "consistency":
          return dir * (a.consistency - b.consistency);
        case "mentions":
          return dir * (a.mentions - b.mentions);
        case "promptsCovered":
          return dir * (a.promptsCovered - b.promptsCovered);
        case "lastSeenAt": {
          const aT = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const bT = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          return dir * (aT - bT);
        }
        default:
          return 0;
      }
    });
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-400">No hay competidores para analizar.</p>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">Rendimiento de competidores</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Métricas para <span className="font-medium">{llm}</span> sobre {totalRuns} runs
          completados. Haz clic en las cabeceras para ordenar.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <SortableHeader
                label="Competidor"
                sortKey="name"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                align="left"
                tooltip="Marca detectada en las respuestas de la IA."
              />
              <SortableHeader
                label="Consistencia"
                sortKey="consistency"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="% de respuestas en las que aparece la marca."
              />
              <SortableHeader
                label="SOV"
                sortKey="sov"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Cuota de voz: % de menciones de esta marca sobre el total."
              />
              <SortableHeader
                label="Posición media"
                sortKey="avgPosition"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Posición promedio (1 es la mejor)."
              />
              <SortableHeader
                label="Sentimiento"
                sortKey="sentiment"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                align="left"
                tooltip="Tono predominante detectado en las menciones."
              />
              <SortableHeader
                label="Menciones"
                sortKey="mentions"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Número total de veces que se ha detectado la marca."
              />
              <SortableHeader
                label="Prompts"
                sortKey="promptsCovered"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Prompts únicos donde aparece la marca."
              />
              <SortableHeader
                label="Última mención"
                sortKey="lastSeenAt"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                align="left"
                tooltip="Fecha y hora de la detección más reciente."
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={row.competitorId} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{row.name}</p>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.consistency.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.sov !== null ? `${row.sov.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.avgPosition !== null ? row.avgPosition.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sentimentClass(row.sentiment)}`}
                  >
                    {sentimentLabel(row.sentiment)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{row.mentions}</td>
                <td className="px-4 py-3 text-right text-slate-700">{row.promptsCovered}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(row.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
