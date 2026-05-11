"use client";

import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { runPromptNowAction } from "@/actions/prompts";
import { Button } from "@/components/ui/button";

interface Props {
  promptId: string;
  workspaceId: string;
  llmKey: string;
}

export function RunPromptButton({ promptId, workspaceId, llmKey }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    const result = await runPromptNowAction({ promptId, workspaceId, llmKey });

    if (result.success) {
      toast.success("Prompt en cola de ejecución");
    } else {
      toast.error(result.error ?? "Error al ejecutar el prompt");
    }

    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRun}
      disabled={loading}
      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
      aria-label="Ejecutar prompt"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Play className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
