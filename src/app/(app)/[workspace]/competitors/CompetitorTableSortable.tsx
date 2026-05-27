"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface CompetitorPerformanceRow {
  competitorId: string;
  name: string;
  avgPosition: number | null;
  sov: number | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data";
  sentimentScore: number | null;
  visibility: number;
  mentions: number;
  promptsCovered: number;
  lastSeenAt: string | null;
  mentionBreakdown: {
    primary_recommendation: number;
    list_option: number;
    comparison: number;
    general_mention: number;
    warning: number;
  };
  recScore: number | null;
  threatLevel: "high" | "medium" | "low";
}

interface Props {
  rows: CompetitorPerformanceRow[];
  totalRuns: number;
  llm: string;
  rangeLabel: string;
}

type SortKey =
  | "name"
  | "avgPosition"
  | "sov"
  | "sentiment"
  | "visibility"
  | "mentions"
  | "recScore"
  | "threatLevel";

const SENTIMENT_ORDER = { positive: 0, neutral: 1, negative: 2, no_data: 3 };
const THREAT_ORDER = { high: 0, medium: 1, low: 2 };

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
    positive: "Positivo",
    neutral: "Neutral",
    negative: "Negativo",
    no_data: "Sin datos",
  };
  return map[sentiment];
}

const MENTION_TYPE_COLORS: Record<string, string> = {
  primary_recommendation: "bg-green-500",
  list_option: "bg-blue-500",
  comparison: "bg-purple-500",
  general_mention: "bg-slate-300",
  warning: "bg-red-500",
};

const MENTION_TYPE_LABELS: Record<string, string> = {
  primary_recommendation: "Recomendación",
  list_option: "Lista",
  comparison: "Comparación",
  general_mention: "Mención",
  warning: "Advertencia",
};

const MENTION_TYPE_ORDER = [
  "primary_recommendation",
  "list_option",
  "comparison",
  "general_mention",
  "warning",
] as const;

function MentionProfileBar({
  breakdown,
  total,
}: {
  breakdown: CompetitorPerformanceRow["mentionBreakdown"];
  total: number;
}) {
  if (total === 0) return <span className="text-slate-400 text-xs">—</span>;

  const dominant = MENTION_TYPE_ORDER.reduce((a, b) => (breakdown[a] >= breakdown[b] ? a : b));

  return (
    <div className="space-y-1">
      <div className="flex h-2 w-28 rounded-full overflow-hidden gap-px">
        {MENTION_TYPE_ORDER.map((t) => {
          const pct = (breakdown[t] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={t}
              className={`${MENTION_TYPE_COLORS[t]} h-full`}
              style={{ width: `${pct}%` }}
              title={`${MENTION_TYPE_LABELS[t]}: ${breakdown[t]}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-slate-400">{MENTION_TYPE_LABELS[dominant]}</p>
    </div>
  );
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
    <th
      className={`px-4 py-3 text-slate-500 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <div
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={`inline-flex items-center gap-0.5 hover:text-slate-800 transition-colors ${isActive ? "text-slate-800" : ""}`}
        >
          {label}
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
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
    </th>
  );
}

export function CompetitorTableSortable({ rows, totalRuns, llm, rangeLabel }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("visibility");
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
        case "visibility":
          return dir * (a.visibility - b.visibility);
        case "mentions":
          return dir * (a.mentions - b.mentions);
        case "recScore": {
          if (a.recScore === null && b.recScore === null) return 0;
          if (a.recScore === null) return 1;
          if (b.recScore === null) return -1;
          return dir * (a.recScore - b.recScore);
        }
        case "threatLevel":
          return dir * (THREAT_ORDER[a.threatLevel] - THREAT_ORDER[b.threatLevel]);
        default:
          return 0;
      }
    });
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-slate-400">No hay competidores para analizar.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">Rendimiento de competidores</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Métricas para <span className="font-medium">{llm}</span> ·{" "}
          <span className="font-medium">{rangeLabel}</span> · {totalRuns} ejecuciones. Haz clic en
          las cabeceras para ordenar.
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
                label="Visibilidad"
                sortKey="visibility"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="% de prompts únicos donde aparece la marca."
              />
              <SortableHeader
                label="AVG POS"
                sortKey="avgPosition"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Posición promedio cuando es mencionado (1 = primero)."
              />
              <SortableHeader
                label="SOV"
                sortKey="sov"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Raw Share of Voice: % absoluto de menciones sobre el total (own + competidores)."
              />
              <th className="px-4 py-3 text-left text-slate-500 font-medium">
                <div className="inline-flex items-center gap-1">
                  Perfil
                  <InfoTooltip content="Distribución de cómo es mencionado: recomendado, comparado, listado, advertido o mención general." />
                </div>
              </th>
              <SortableHeader
                label="REC."
                sortKey="recScore"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Recommendation Strength: % de menciones donde la IA recomienda esta marca directamente (0-100)."
              />
              <SortableHeader
                label="Sentimiento"
                sortKey="sentiment"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                align="left"
                tooltip="Tono emocional en escala −1 (negativo) a +1 (positivo)."
              />
              <SortableHeader
                label="Amenaza"
                sortKey="threatLevel"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                align="left"
                tooltip="Nivel de amenaza relativo al SOV de tu propia marca."
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={row.competitorId} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{row.mentions} menciones</p>
                </td>

                <td className="px-4 py-3 text-right text-slate-700">
                  {row.visibility.toFixed(1)}%
                </td>

                <td className="px-4 py-3 text-right">
                  {row.avgPosition !== null ? (
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                        row.avgPosition <= 2
                          ? "bg-green-50 text-green-700 border-green-200"
                          : row.avgPosition <= 4
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200",
                      ].join(" ")}
                    >
                      #{row.avgPosition.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-right text-slate-700">
                  {row.sov !== null ? `${row.sov.toFixed(1)}%` : "—"}
                </td>

                <td className="px-4 py-3">
                  <MentionProfileBar breakdown={row.mentionBreakdown} total={row.mentions} />
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-sm font-semibold ${row.recScore !== null && row.recScore > 50 ? "text-green-600" : "text-slate-600"}`}
                    >
                      {row.recScore !== null ? row.recScore.toFixed(1) : "—"}
                    </span>
                    {row.recScore !== null && (
                      <div className="w-12 h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${row.recScore}%` }}
                        />
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sentimentClass(row.sentiment)}`}
                  >
                    {sentimentLabel(row.sentiment)}
                    {row.sentimentScore !== null && (
                      <span className="ml-1 opacity-70">
                        ({row.sentimentScore >= 0 ? "+" : ""}
                        {row.sentimentScore.toFixed(1)})
                      </span>
                    )}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      row.threatLevel === "high"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : row.threatLevel === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-500 border-slate-200",
                    ].join(" ")}
                  >
                    {row.threatLevel === "high"
                      ? "Alta"
                      : row.threatLevel === "medium"
                        ? "Media"
                        : "Baja"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
