"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshDashboardAction } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";

interface Props {
  workspaceId: string;
  slug: string;
  llmKey: string;
}

export function DashboardRefreshButton({ workspaceId, slug, llmKey }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function handleRefresh() {
    setLoading(true);
    await refreshDashboardAction(workspaceId, slug, llmKey);
    router.refresh();
    setLastRefresh(new Date());
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      {lastRefresh && (
        <span className="text-xs text-slate-400">
          Actualizado a las{" "}
          {lastRefresh.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
        className="gap-1.5"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        {loading ? "Actualizando…" : "Actualizar"}
      </Button>
    </div>
  );
}
