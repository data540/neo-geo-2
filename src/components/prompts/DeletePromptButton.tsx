"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deletePromptAction } from "@/actions/prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  promptId: string;
  workspaceId: string;
  promptText: string;
}

export function DeletePromptButton({ promptId, workspaceId, promptText }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deletePromptAction(promptId, workspaceId);

    if (result.success) {
      toast.success("Prompt eliminado");
      setOpen(false);
    } else {
      toast.error(result.error ?? "Error al eliminar el prompt");
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
        aria-label="Eliminar prompt"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este prompt?</DialogTitle>
          <DialogDescription className="mt-2">
            <span className="block font-medium text-slate-700 mb-2">
              &ldquo;{promptText}&rdquo;
            </span>
            Esta acción no se puede deshacer. Se eliminarán también todos los datos de ejecución
            asociados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando…
              </>
            ) : (
              "Eliminar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
