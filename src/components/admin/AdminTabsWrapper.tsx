"use client";

import { useState } from "react";
import { AdminLogsTable } from "./AdminLogsTable";
import { DeleteWorkspacePanel } from "./DeleteWorkspacePanel";
import { KnowledgeBasePanel } from "./KnowledgeBasePanel";

interface AdminLogsRow {
  id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: "queued" | "running" | "completed" | "failed";
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error_message: string | null;
  raw_response: string | null;
  prompt_text: string;
  provider_name: string;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  userRole: string;
  logsRows: AdminLogsRow[];
  initialTab?: string;
}

export function AdminTabsWrapper({
  workspaceId,
  workspaceSlug,
  workspaceName,
  userRole,
  logsRows,
  initialTab = "logs",
}: Props) {
  const [activeTab, setActiveTab] = useState<"logs" | "knowledge-base" | "danger-zone">(
    (initialTab as "logs" | "knowledge-base" | "danger-zone") || "logs"
  );

  const tabs = [
    { id: "logs", label: "Logs de ejecución", icon: "📊" },
    { id: "knowledge-base", label: "Knowledge Base", icon: "📚" },
    { id: "danger-zone", label: "Zona peligrosa", icon: "⚠️" },
  ] as const;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === "logs"
              ? "Últimas 200 ejecuciones de prompts con consumo de tokens y coste estimado."
              : activeTab === "knowledge-base"
                ? "Gestión de la base de conocimiento experta para GEO Research y Recomendaciones."
                : "Acciones destructivas e irreversibles sobre el workspace."}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "logs" | "knowledge-base")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "logs" && <AdminLogsTable rows={logsRows} />}
        {activeTab === "knowledge-base" && <KnowledgeBasePanel workspaceId={workspaceId} />}
        {activeTab === "danger-zone" && (
          userRole === "owner" ? (
            <DeleteWorkspacePanel
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
              workspaceName={workspaceName}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Solo el owner del workspace puede eliminar el workspace.
            </p>
          )
        )}
      </div>
    </div>
  );
}
