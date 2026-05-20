"use client";

import { Clock, Database, FileText, Zap } from "lucide-react";
import type { KnowledgeBaseStats } from "@/types";

interface Props {
  stats: KnowledgeBaseStats | null;
  loading?: boolean;
}

export function KnowledgeBaseStatsCards({ stats, loading = false }: Props) {
  const skeleton = loading ? "animate-pulse bg-slate-200" : "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Chunks */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Total Chunks
            </p>
            <p className={`text-2xl font-bold text-slate-900 mt-2 ${skeleton}`}>
              {stats?.totalChunks ?? 0}
            </p>
          </div>
          <Database className="w-8 h-8 text-indigo-600 opacity-20" />
        </div>
      </div>

      {/* Total Tokens */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Total Tokens
            </p>
            <p className={`text-2xl font-bold text-slate-900 mt-2 ${skeleton}`}>
              {stats?.totalTokens ? (stats.totalTokens / 1000).toFixed(1) : 0}
              <span className="text-xs font-normal text-slate-500 ml-1">K</span>
            </p>
          </div>
          <Zap className="w-8 h-8 text-amber-500 opacity-20" />
        </div>
      </div>

      {/* Files Count */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Archivos</p>
            <p className={`text-2xl font-bold text-slate-900 mt-2 ${skeleton}`}>
              {stats?.filesCount ?? 0}
            </p>
          </div>
          <FileText className="w-8 h-8 text-blue-600 opacity-20" />
        </div>
      </div>

      {/* Last Updated */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Última actualización
            </p>
            <p className={`text-sm font-semibold text-slate-900 mt-2 ${skeleton}`}>
              {stats?.lastUpdated
                ? new Date(stats.lastUpdated).toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Nunca"}
            </p>
          </div>
          <Clock className="w-8 h-8 text-slate-400 opacity-20" />
        </div>
      </div>
    </div>
  );
}
