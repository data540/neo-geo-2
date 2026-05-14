"use client";

import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deletePromptsBulkAction } from "@/actions/prompts";
import { Button } from "@/components/ui/button";
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
  llmsByPrompt: Record<string, string[]>;
}

type SortDirection = "asc" | "desc";
type SortKey =
  | "prompt_text"
  | "status"
  | "country"
  | "position"
  | "sov"
  | "sentiment"
  | "consistency"
  | "llms";

type ColumnKey =
  | "select"
  | "prompt"
  | "status"
  | "country"
  | "position"
  | "sov"
  | "sentiment"
  | "consistency"
  | "llms"
  | "tags"
  | "active"
  | "actions";

const BORDER_CLASS: Record<string, string> = {
  top: "border-l-4 border-green-500",
  mentioned: "border-l-4 border-green-300",
  competitors_only: "border-l-4 border-orange-400",
  no_data: "border-l-4 border-slate-200",
};

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  select: 48,
  prompt: 440,
  status: 130,
  country: 90,
  position: 120,
  sov: 120,
  sentiment: 130,
  consistency: 130,
  llms: 180,
  tags: 180,
  active: 90,
  actions: 90,
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
  if (!active) return null;
  return dir === "asc" ? (
    <ArrowUpAZ className="w-3.5 h-3.5" />
  ) : (
    <ArrowDownAZ className="w-3.5 h-3.5" />
  );
}

export function PromptPerformanceTable({
  rows,
  workspaceId,
  llmKey,
  availableTags,
  promptTags,
  latestStatusByPrompt,
  llmsByPrompt,
}: Props) {
  const PAGE_SIZE = 25;
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey>("prompt_text");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_WIDTHS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function getSortValue(row: PromptPerformanceRow): string | number {
    const status = latestStatusByPrompt[row.prompt_id] ?? "";
    const llms = (llmsByPrompt[row.prompt_id] ?? []).join(", ");

    switch (sortKey) {
      case "prompt_text":
        return row.prompt_text.toLowerCase();
      case "status":
        return status;
      case "country":
        return row.prompt_country.toLowerCase();
      case "position":
        return row.brand_position ?? Number.POSITIVE_INFINITY;
      case "sov":
        return row.sov ?? Number.NEGATIVE_INFINITY;
      case "sentiment":
        return (row.sentiment ?? "no_data").toLowerCase();
      case "consistency":
        return row.consistency_score ?? Number.NEGATIVE_INFINITY;
      case "llms":
        return llms.toLowerCase();
      default:
        return "";
    }
  }

  function startResize(column: ColumnKey, startClientX: number) {
    const startWidth = columnWidths[column];

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startClientX;
      const next = Math.max(70, startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [column]: next }));
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const filtered = useMemo(() => {
    const searched = rows.filter((r) => r.prompt_text.toLowerCase().includes(query.toLowerCase()));

    return [...searched].sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sortDirection === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), "es", { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [rows, query, sortKey, sortDirection, latestStatusByPrompt, llmsByPrompt]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query]);

  const displayed = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const displayedIds = displayed.map((r) => r.prompt_id);
  const selectedDisplayedCount = displayedIds.filter((id) => selectedIds.has(id)).length;
  const allDisplayedSelected = displayedIds.length > 0 && selectedDisplayedCount === displayedIds.length;

  function toggleRowSelection(promptId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(promptId);
      else next.delete(promptId);
      return next;
    });
  }

  function toggleSelectAllDisplayed(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of displayedIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Vas a eliminar ${ids.length} prompt${ids.length !== 1 ? "s" : ""}. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    const result = await deletePromptsBulkAction(ids, workspaceId);
    setBulkDeleting(false);

    if (!result.success) {
      toast.error(result.error ?? "No se pudieron eliminar los prompts");
      return;
    }

    toast.success(`Eliminados ${result.data?.deleted ?? ids.length} prompts`);
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar prompt…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={selectedIds.size === 0 || bulkDeleting}
          onClick={handleBulkDelete}
          className="shrink-0"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {bulkDeleting
            ? "Eliminando..."
            : `Eliminar seleccionados${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <p className="text-xs text-slate-500">
          {selectedIds.size} prompt{selectedIds.size !== 1 ? "s" : ""} seleccionado
          {selectedIds.size !== 1 ? "s" : ""}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="max-h-[65vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <colgroup>
              <col style={{ width: columnWidths.select }} />
              <col style={{ width: columnWidths.prompt }} />
              <col style={{ width: columnWidths.status }} />
              <col style={{ width: columnWidths.country }} />
              <col style={{ width: columnWidths.position }} />
              <col style={{ width: columnWidths.sov }} />
              <col style={{ width: columnWidths.sentiment }} />
              <col style={{ width: columnWidths.consistency }} />
              <col style={{ width: columnWidths.llms }} />
              <col style={{ width: columnWidths.tags }} />
              <col style={{ width: columnWidths.active }} />
              <col style={{ width: columnWidths.actions }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="relative px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allDisplayedSelected}
                    onChange={(e) => toggleSelectAllDisplayed(e.target.checked)}
                    aria-label="Seleccionar todos los prompts visibles"
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <div
                    onMouseDown={(e) => startResize("select", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("prompt_text")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    Prompt
                    <SortIcon active={sortKey === "prompt_text"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("prompt", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    Estado
                    <SortIcon active={sortKey === "status"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("status", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("country")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    País
                    <SortIcon active={sortKey === "country"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("country", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("position")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    Posición
                    <SortIcon active={sortKey === "position"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("position", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("sov")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    SOV
                    <SortIcon active={sortKey === "sov"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("sov", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("sentiment")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    Sentiment
                    <SortIcon active={sortKey === "sentiment"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("sentiment", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("consistency")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    Consistencia
                    <SortIcon active={sortKey === "consistency"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("consistency", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort("llms")}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                  >
                    LLMs usados
                    <SortIcon active={sortKey === "llms"} dir={sortDirection} />
                  </button>
                  <div
                    onMouseDown={(e) => startResize("llms", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Etiquetas
                  <div
                    onMouseDown={(e) => startResize("tags", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Activo
                  <div
                    onMouseDown={(e) => startResize("active", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
                <th className="relative px-3 py-3">
                  <div
                    onMouseDown={(e) => startResize("actions", e.clientX)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400 text-sm">
                    {query
                      ? "No hay prompts que coincidan con la búsqueda."
                      : "No hay prompts todavía."}
                  </td>
                </tr>
              ) : (
                displayed.map((row) => {
                  const visibility = getVisibilityStatus(row);
                  const borderClass = BORDER_CLASS[visibility] ?? BORDER_CLASS.no_data;
                  const tags = promptTags[row.prompt_id] ?? [];
                  const latestStatus = latestStatusByPrompt[row.prompt_id] ?? null;
                  const canRun = latestStatus !== "completed";

                  return (
                    <tr key={row.prompt_id} className={`hover:bg-slate-50/50 ${borderClass}`}>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.prompt_id)}
                          onChange={(e) => toggleRowSelection(row.prompt_id, e.target.checked)}
                          aria-label={`Seleccionar prompt: ${row.prompt_text}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 leading-snug whitespace-pre-wrap break-words">
                          {row.prompt_text}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <PromptStatusCell status={latestStatus} />
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
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {(llmsByPrompt[row.prompt_id] ?? []).length > 0
                            ? (llmsByPrompt[row.prompt_id] ?? []).join(", ")
                            : "Sin ejecuciones"}
                        </p>
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
                          {canRun ? (
                            <RunPromptButton
                              promptId={row.prompt_id}
                              workspaceId={workspaceId}
                              llmKey={llmKey}
                            />
                          ) : null}
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

      {hasMore && (
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            Mostrar más
            <span className="text-slate-400">
              ({displayed.length} de {filtered.length})
            </span>
          </button>
        </div>
      )}

      {!hasMore && filtered.length > PAGE_SIZE && (
        <p className="text-center text-xs text-slate-400 pt-1">
          Mostrando todos los {filtered.length} prompts
        </p>
      )}
    </div>
  );
}

