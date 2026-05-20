"use server";

import {
  getKnowledgeBaseStats,
  listKnowledgeFiles,
  reindexKnowledgeBase,
} from "@/lib/knowledge-base/indexer";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, KnowledgeBaseStats, KnowledgeFile } from "@/types";

async function requireManage(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  return data === true;
}

export async function getKnowledgeBaseStatsAction(
  workspaceId: string
): Promise<ActionResult<KnowledgeBaseStats>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  try {
    const stats = await getKnowledgeBaseStats();
    return { success: true, data: stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al obtener estadísticas: ${message}` };
  }
}

export async function listKnowledgeFilesAction(
  workspaceId: string
): Promise<ActionResult<KnowledgeFile[]>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  try {
    const files = await listKnowledgeFiles();
    return { success: true, data: files };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al listar archivos: ${message}` };
  }
}

export async function reindexAllAction(
  workspaceId: string
): Promise<ActionResult<{ totalChunks: number; totalTokens: number; filesProcessed: number }>> {
  const canManage = await requireManage(workspaceId);
  if (!canManage) return { success: false, error: "Sin permisos" };

  try {
    const result = await reindexKnowledgeBase();
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: `Error al reindexar: ${message}` };
  }
}
