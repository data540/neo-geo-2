"use client";

import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/types";

interface AdminLogRow {
  id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: RunStatus;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error_message: string | null;
  prompt_text: string;
  provider_name: string;
}

interface AdminLogsTableProps {
  rows: AdminLogRow[];
}

function statusBadge(status: RunStatus) {
  const variants: Record<RunStatus, { label: string; className: string }> = {
    completed: { label: "completed", className: "bg-green-50 text-green-700 border-green-200" },
    running:   { label: "running",   className: "bg-blue-50 text-blue-700 border-blue-200" },
    queued:    { label: "queued",    className: "bg-slate-50 text-slate-600 border-slate-200" },
    failed:    { label: "failed",    className: "bg-red-50 text-red-700 border-red-200" },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

function formatDuration(started: string | null, completed: string | null): string {
  if (!started || !completed) return "—";
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminLogsTable({ rows }: AdminLogsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        No hay registros de ejecución aún.
      </div>
    );
  }

  const totalCost = rows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  const totalInputTokens = rows.reduce((sum, r) => sum + (r.input_tokens ?? 0), 0);
  const totalOutputTokens = rows.reduce((sum, r) => sum + (r.output_tokens ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 text-sm text-slate-500">
        <span><span className="font-medium text-slate-700">{rows.length}</span> ejecuciones</span>
        <span><span className="font-medium text-slate-700">{totalInputTokens.toLocaleString()}</span> tokens entrada</span>
        <span><span className="font-medium text-slate-700">{totalOutputTokens.toLocaleString()}</span> tokens salida</span>
        <span><span className="font-medium text-slate-700">${totalCost.toFixed(6)}</span> coste total</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Prompt</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Modelo</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Provider</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Input</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Output</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Coste</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Duración</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-xs">
                  <span className="line-clamp-1" title={row.prompt_text}>
                    {row.prompt_text}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">
                  {row.model ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {row.provider_name}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                  {row.input_tokens != null ? `${row.input_tokens.toLocaleString()} tok` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                  {row.output_tokens != null ? `${row.output_tokens.toLocaleString()} tok` : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 whitespace-nowrap">
                  {row.cost_usd != null ? `$${row.cost_usd.toFixed(6)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap text-xs">
                  {formatDuration(row.started_at, row.completed_at)}
                </td>
                <td className="px-4 py-3">
                  {statusBadge(row.status)}
                  {row.error_message && (
                    <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={row.error_message}>
                      {row.error_message}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
