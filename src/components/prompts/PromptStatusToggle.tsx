"use client";

import { useState } from "react";
import { toast } from "sonner";
import { togglePromptStatusAction } from "@/actions/prompts";
import { Switch } from "@/components/ui/switch";
import type { PromptStatus } from "@/types";

interface Props {
  promptId: string;
  workspaceId: string;
  status: PromptStatus;
}

export function PromptStatusToggle({ promptId, workspaceId, status }: Props) {
  const [active, setActive] = useState(status === "active");
  const [loading, setLoading] = useState(false);

  async function handleToggle(checked: boolean) {
    setLoading(true);
    setActive(checked);

    const result = await togglePromptStatusAction({
      promptId,
      workspaceId,
      status: checked ? "active" : "paused",
    });

    if (!result.success) {
      setActive(!checked);
      toast.error(result.error ?? "Error al cambiar el estado");
    }

    setLoading(false);
  }

  return (
    <Switch
      checked={active}
      onCheckedChange={handleToggle}
      disabled={loading}
      aria-label={active ? "Pausar prompt" : "Activar prompt"}
    />
  );
}
