"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCompetitorAction } from "@/actions/competitors";
import { Button } from "@/components/ui/button";

interface Props {
  competitorId: string;
  workspaceId: string;
  name: string;
}

export function DeleteCompetitorButton({ competitorId, workspaceId, name }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar competidor "${name}"?`)) return;
    setLoading(true);

    const result = await deleteCompetitorAction(competitorId, workspaceId);

    if (result.success) {
      toast.success("Competidor eliminado");
    } else {
      toast.error(result.error ?? "Error al eliminar");
    }

    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
      aria-label="Eliminar competidor"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </Button>
  );
}
