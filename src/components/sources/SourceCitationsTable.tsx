import { ExternalLink } from "lucide-react";
import type { SourceCitationRow } from "@/types";

interface Props {
  rows: SourceCitationRow[];
}

const LLM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "AI Overview",
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

export function SourceCitationsTable({ rows }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">Todas las citas detectadas</h2>
        <p className="text-xs text-slate-500 mt-1">
          Filas individuales guardadas en la base de datos. El ranking superior agrupa estas citas
          por dominio.
        </p>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay citas guardadas para los filtros actuales.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {row.llmKey ? (LLM_LABELS[row.llmKey] ?? row.llmName ?? row.llmKey) : "-"}
                  </td>
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
