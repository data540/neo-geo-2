"use client";

import { Check, Loader2, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  approveCompetitorSuggestionAction,
  rejectCompetitorSuggestionAction,
} from "@/actions/competitors";
import { Button } from "@/components/ui/button";

interface Props {
  suggestionId: string;
  workspaceId: string;
  name: string;
}

export function CompetitorSuggestionActions({ suggestionId, workspaceId, name }: Props) {
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveCompetitorSuggestionAction(suggestionId, workspaceId);
      if (result.success) {
        toast.success(`Competidor anadido: ${name}`);
      } else {
        toast.error(result.error ?? "No se pudo aprobar la sugerencia");
      }
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectCompetitorSuggestionAction(suggestionId, workspaceId);
      if (result.success) {
        toast.success(`Sugerencia descartada: ${name}`);
      } else {
        toast.error(result.error ?? "No se pudo rechazar la sugerencia");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={approve} disabled={pending}>
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Aprobar
      </Button>
      <Button size="sm" variant="outline" onClick={reject} disabled={pending}>
        <X className="w-3.5 h-3.5" />
        Rechazar
      </Button>
    </div>
  );
}
