"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getKnowledgeBaseStatsAction,
  listKnowledgeFilesAction,
  reindexAllAction,
} from "@/actions/knowledge-base";
import { Button } from "@/components/ui/button";
import type { KnowledgeBaseStats, KnowledgeFile } from "@/types";
import { KnowledgeBaseFilesTable } from "./KnowledgeBaseFilesTable";
import { KnowledgeBaseStatsCards } from "./KnowledgeBaseStatsCards";

interface Props {
  workspaceId: string;
}

export function KnowledgeBasePanel({ workspaceId }: Props) {
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [statsResult, filesResult] = await Promise.all([
        getKnowledgeBaseStatsAction(workspaceId),
        listKnowledgeFilesAction(workspaceId),
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
      if (filesResult.success && filesResult.data) {
        setFiles(filesResult.data);
      }
    } catch (err) {
      console.error("Error loading knowledge base data:", err);
      toast.error("Error al cargar datos de Knowledge Base");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  async function handleReindex() {
    const confirmReindex = confirm(
      "¿Reindexar toda la Knowledge Base? Esto puede tomar algunos minutos."
    );
    if (!confirmReindex) return;

    setIndexing(true);
    try {
      const result = await reindexAllAction(workspaceId);

      if (result.success && result.data) {
        toast.success(
          `✅ Knowledge Base indexado: ${result.data.totalChunks} chunks, ${(result.data.totalTokens / 1000).toFixed(1)}K tokens`
        );
        await loadData();
      } else {
        toast.error(result.error ?? "Error al reindexar");
      }
    } catch (err) {
      console.error("Error reindexing:", err);
      toast.error("Error al reindexar Knowledge Base");
    } finally {
      setIndexing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <KnowledgeBaseStatsCards stats={stats} loading={loading} />

      {/* Reindex Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleReindex}
          disabled={indexing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <RotateCw className={`w-4 h-4 ${indexing ? "animate-spin" : ""}`} />
          {indexing ? "Reindexando..." : "🔄 Reindexar Knowledge Base"}
        </Button>
      </div>

      {/* Files Table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Archivos indexados</h3>
        <KnowledgeBaseFilesTable files={files} loading={loading} />
      </div>
    </div>
  );
}
