"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp, Loader2, ScanSearch, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  auditExistingCompetitorsAction,
  deleteCompetitorsBulkAction,
} from "@/actions/competitors";
import { Button } from "@/components/ui/button";
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
  workspaceId: string;
  rows: CompetitorPerformanceRow[];
  totalRuns: number;
  llm: string;
  rangeLabel: string;
  inactiveCount?: number;
  showInactive?: boolean;
  toggleHref?: string;
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

const MENTION_TYPE_COLORS: Record<string, string> = {
  primary_recommendation: "bg-green-500",
  list_option: "bg-blue-500",
  comparison: "bg-purple-500",
  general_mention: "bg-slate-300",
  warning: "bg-red-500",
};

const MENTION_TYPE_LABELS: Record<string, string> = {
  primary_recommendation: "Recomendacion",
  list_option: "Lista",
  comparison: "Comparacion",
  general_mention: "Mencion",
  warning: "Advertencia",
};

const MENTION_TYPE_ORDER = [
  "primary_recommendation",
  "list_option",
  "comparison",
  "general_mention",
  "warning",
] as const;

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

function MentionProfileBar({
  breakdown,
  total,
}: {
  breakdown: CompetitorPerformanceRow["mentionBreakdown"];
  total: number;
}) {
  if (total === 0) return <span className="text-slate-400 text-xs">-</span>;

  const dominant = MENTION_TYPE_ORDER.reduce((a, b) => (breakdown[a] >= breakdown[b] ? a : b));

  return (
    <div className="space-y-1">
      <div className="flex h-2 w-28 rounded-full overflow-hidden gap-px">
        {MENTION_TYPE_ORDER.map((type) => {
          const pct = (breakdown[type] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={type}
              className={`${MENTION_TYPE_COLORS[type]} h-full`}
              style={{ width: `${pct}%` }}
              title={`${MENTION_TYPE_LABELS[type]}: ${breakdown[type]}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-slate-400">{MENTION_TYPE_LABELS[dominant]}</p>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  activeSortDir,
  onSort,
  align = "right",
  tooltip,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  activeSortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  tooltip?: string;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`px-4 py-3 text-slate-500 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <div
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={`inline-flex items-center gap-0.5 hover:text-slate-800 transition-colors ${
            isActive ? "text-slate-800" : ""
          }`}
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

export function CompetitorTableSortable({
  workspaceId,
  rows,
  totalRuns,
  llm,
  rangeLabel,
  inactiveCount = 0,
  showInactive = false,
  toggleHref,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("visibility");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [auditReasons, setAuditReasons] = useState<Record<string, string>>({});
  const [auditPending, startAudit] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "avgPosition" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name, "es");
        case "avgPosition":
          if (a.avgPosition === null && b.avgPosition === null) return 0;
          if (a.avgPosition === null) return 1;
          if (b.avgPosition === null) return -1;
          return dir * (a.avgPosition - b.avgPosition);
        case "sov":
          if (a.sov === null && b.sov === null) return 0;
          if (a.sov === null) return 1;
          if (b.sov === null) return -1;
          return dir * (a.sov - b.sov);
        case "sentiment":
          return dir * (SENTIMENT_ORDER[a.sentiment] - SENTIMENT_ORDER[b.sentiment]);
        case "visibility":
          return dir * (a.visibility - b.visibility);
        case "mentions":
          return dir * (a.mentions - b.mentions);
        case "recScore":
          if (a.recScore === null && b.recScore === null) return 0;
          if (a.recScore === null) return 1;
          if (b.recScore === null) return -1;
          return dir * (a.recScore - b.recScore);
        case "threatLevel":
          return dir * (THREAT_ORDER[a.threatLevel] - THREAT_ORDER[b.threatLevel]);
        default:
          return 0;
      }
    });
  }, [rows, sortKey, sortDir]);

  const allSortedIds = sorted.map((row) => row.competitorId);
  const selectedCount = selectedIds.size;
  const allSelected = allSortedIds.length > 0 && allSortedIds.every((id) => selectedIds.has(id));

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) return new Set();
      return new Set([...current, ...allSortedIds]);
    });
  }

  function handleAudit() {
    startAudit(async () => {
      const result = await auditExistingCompetitorsAction(workspaceId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "No se pudo auditar competidores");
        return;
      }
      const invalidIds = result.data.invalidCompetitors.map((item) => item.brandId);
      setSelectedIds(new Set(invalidIds));
      setAuditReasons(
        Object.fromEntries(result.data.invalidCompetitors.map((item) => [item.brandId, item.reason]))
      );
      toast.success(
        `Auditados ${result.data.checked}. Detectados ${invalidIds.length} invalidos.`
      );
    });
  }

  function handleBulkDelete() {
    if (selectedCount === 0) return;
    if (!confirm(`Eliminar ${selectedCount} competidores seleccionados y sus menciones?`)) return;
    startDelete(async () => {
      const result = await deleteCompetitorsBulkAction({
        workspaceId,
        brandIds: Array.from(selectedIds),
      });
      if (!result.success || !result.data) {
        toast.error(result.error ?? "No se pudieron eliminar competidores");
        return;
      }
      setSelectedIds(new Set());
      setAuditReasons({});
      toast.success(
        `Eliminados ${result.data.deletedCompetitors} competidores y ${result.data.deletedMentions} menciones`
      );
    });
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-6 text-center">
        <p className="text-sm text-slate-400">
          {!showInactive && inactiveCount > 0
            ? `Ningún competidor con actividad en este período.`
            : "No hay competidores para analizar."}
        </p>
        {!showInactive && inactiveCount > 0 && toggleHref && (
          <a
            href={toggleHref}
            className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
          >
            Mostrar {inactiveCount} {inactiveCount === 1 ? "competidor sin actividad" : "competidores sin actividad"}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Rendimiento de competidores</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Metricas para <span className="font-medium">{llm}</span> ·{" "}
              <span className="font-medium">{rangeLabel}</span> · {totalRuns} ejecuciones.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                placeholder="Buscar competidor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-md border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-44"
              />
            </div>
            {inactiveCount > 0 && toggleHref && (
              <a
                href={toggleHref}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                {showInactive ? (
                  <>Ocultar inactivos</>
                ) : (
                  <>{inactiveCount} sin actividad · Mostrar</>
                )}
              </a>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAudit}
              disabled={auditPending}
            >
              {auditPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ScanSearch className="w-4 h-4" />
              )}
              Auditar con LLM
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleBulkDelete}
              disabled={deletePending || selectedCount === 0}
              className="text-red-600 hover:text-red-700"
            >
              {deletePending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Eliminar seleccionados{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-slate-500 font-medium w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todos los competidores"
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
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
                tooltip="% de prompts unicos donde aparece la marca."
              />
              <SortableHeader
                label="AVG POS"
                sortKey="avgPosition"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Posicion promedio cuando es mencionado (1 = primero)."
              />
              <SortableHeader
                label="SOV"
                sortKey="sov"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="Share of Voice: cuota de menciones de la marca sobre el total de menciones de marcas (propia + competidores)."
              />
              <th className="px-4 py-3 text-left text-slate-500 font-medium">
                <div className="inline-flex items-center gap-1">
                  Perfil
                  <InfoTooltip content="Distribucion de como es mencionado." />
                </div>
              </th>
              <SortableHeader
                label="REC."
                sortKey="recScore"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                tooltip="% de menciones donde la IA recomienda esta marca directamente."
              />
              <SortableHeader
                label="Sentimiento"
                sortKey="sentiment"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                align="left"
                tooltip="Tono emocional de las menciones."
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
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.competitorId)}
                    onChange={() => toggleOne(row.competitorId)}
                    aria-label={`Seleccionar ${row.name}`}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{row.mentions} menciones</p>
                  {auditReasons[row.competitorId] && (
                    <p className="text-xs text-red-500 mt-1">{auditReasons[row.competitorId]}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.visibility.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right">
                  {row.avgPosition !== null ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      #{row.avgPosition.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.sov !== null ? `${row.sov.toFixed(1)}%` : "-"}
                </td>
                <td className="px-4 py-3">
                  <MentionProfileBar breakdown={row.mentionBreakdown} total={row.mentions} />
                </td>
                <td className="px-4 py-3 text-right">
                  {row.recScore !== null ? row.recScore.toFixed(1) : "-"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sentimentClass(
                      row.sentiment
                    )}`}
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
                  <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
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
