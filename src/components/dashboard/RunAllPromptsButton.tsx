"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { runAllPromptsNowAction } from "@/actions/prompts";
import { Button } from "@/components/ui/button";

interface Props {
  workspaceId: string;
}

export function RunAllPromptsButton({ workspaceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRunAll() {
    setLoading(true);
    setResult(null);
    const res = await runAllPromptsNowAction(workspaceId);
    if (res.success && res.data) {
      setResult(`${res.data.runs} runs lanzados (${res.data.prompts} prompts × 3 LLMs)`);
      router.refresh();
    } else {
      setResult(res.error ?? "Error desconocido");
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-slate-500 max-w-xs truncate">{result}</span>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRunAll}
        disabled={loading}
        className="gap-1.5"
      >
        <Play className={`w-3.5 h-3.5 ${loading ? "animate-pulse" : ""}`} aria-hidden="true" />
        {loading ? "Lanzando…" : "Ejecutar todos"}
      </Button>
    </div>
  );
}
