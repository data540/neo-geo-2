"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { SourceCitationRow } from "@/types";

interface Props {
  rows: SourceCitationRow[];
}

const PAGE_SIZE = 50;

const LLM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanUrlLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

function llmLabel(row: SourceCitationRow): string {
  if (!row.llmKey) return "-";
  return LLM_LABELS[row.llmKey] ?? row.llmName ?? row.llmKey;
}

const EXPORT_HEADERS = [
  "Dominio",
  "URL",
  "Título",
  "Prompt",
  "LLM",
  "País",
  "Estado",
  "Fecha cita",
  "Fecha run",
] as const;

function rowToExportRecord(row: SourceCitationRow): Record<string, string> {
  return {
    Dominio: row.domain ?? "",
    URL: row.url ?? "",
    Título: row.title ?? "",
    Prompt: row.promptText ?? "",
    LLM: llmLabel(row),
    País: row.promptCountry ?? "",
    Estado: row.citedByLlm ? "Citada" : "Detectada",
    "Fecha cita": formatDate(row.sourceCreatedAt),
    "Fecha run": formatDate(row.runCreatedAt),
  };
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SourceCitationsTable({ rows }: Props) {
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * PAGE_SIZE;
  const pageRows = useMemo(() => rows.slice(start, start + PAGE_SIZE), [rows, start]);

  function handleExportCsv() {
    if (rows.length === 0) return;
    const lines = [
      EXPORT_HEADERS.join(","),
      ...rows.map((row) => {
        const record = rowToExportRecord(row);
        return EXPORT_HEADERS.map((h) => escapeCsvField(record[h] ?? "")).join(",");
      }),
    ];
    // BOM para que Excel interprete UTF-8 correctamente
    const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `citas_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function handleExportExcel() {
    if (rows.length === 0 || exporting) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = rows.map(rowToExportRecord);
      const ws = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Citas");
      const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerDownload(blob, `citas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("No se pudo generar el archivo Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Todas las citas detectadas</h2>
          <p className="text-xs text-slate-500 mt-1">
            Filas individuales guardadas en la base de datos. El ranking superior agrupa estas citas
            por dominio.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={rows.length === 0 || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            {exporting ? "Generando…" : "Descargar Excel"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-100">
            <tr>
              <Th>Dominio</Th>
              <Th>URL / título</Th>
              <Th>Prompt</Th>
              <Th>LLM</Th>
              <Th>País</Th>
              <Th>Estado</Th>
              <Th>Fecha</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay citas guardadas para los filtros actuales.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    {row.domain ?? "-"}
                  </td>
                  <td className="px-4 py-3 min-w-72 max-w-md">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block text-slate-700 hover:text-indigo-600"
                      >
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="truncate">
                            {row.title?.trim() || cleanUrlLabel(row.url)}
                          </span>
                          <ExternalLink
                            className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 shrink-0"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="block text-xs text-slate-400 truncate mt-0.5">
                          {cleanUrlLabel(row.url)}
                        </span>
                      </a>
                    ) : (
                      <span className="text-slate-400">Sin URL</span>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-80 max-w-md">
                    <span
                      className="block text-xs text-slate-700 truncate"
                      title={row.promptText ?? ""}
                    >
                      {row.promptText ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{llmLabel(row)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {row.promptCountry ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.citedByLlm ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Citada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                        Detectada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    <div>{formatDate(row.sourceCreatedAt)}</div>
                    {row.runCreatedAt && row.runCreatedAt !== row.sourceCreatedAt && (
                      <div className="text-slate-400">Run: {formatDate(row.runCreatedAt)}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 tabular-nums">
            {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} de {rows.length} citas
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Anterior
            </button>
            <span className="text-xs text-slate-500 tabular-nums">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  );
}
