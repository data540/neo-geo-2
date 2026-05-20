"use client";

import type { KnowledgeFile } from "@/types";

interface Props {
  files: KnowledgeFile[];
  loading?: boolean;
}

export function KnowledgeBaseFilesTable({ files, loading = false }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-500">No hay archivos indexados</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Archivo</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Chunks</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Tokens</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">
                Última actualización
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {files.map((file) => (
              <tr key={file.filename} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-900 font-medium">{file.filename}</td>
                <td className="px-4 py-3 text-right text-slate-600">{file.chunkCount}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {(file.tokenCount / 1000).toFixed(1)}K
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {new Date(file.lastUpdated).toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
