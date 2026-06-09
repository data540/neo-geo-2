"use client";

import { useState, useTransition } from "react";
import { deleteWorkspaceAction } from "@/actions/workspace";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

export function DeleteWorkspacePanel({ workspaceId, workspaceSlug, workspaceName }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim().toLowerCase() === workspaceSlug.toLowerCase();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteWorkspaceAction({
        workspaceId,
        workspaceSlug,
        confirmationText: confirmText,
      });
      if (!result.success) {
        setError(result.error ?? "Error al eliminar el workspace");
        return;
      }
      window.location.href = "/";
    });
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-red-800">Eliminar workspace</h3>
        <p className="text-sm text-red-700 mt-1 leading-relaxed">
          Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los
          datos del workspace <strong>{workspaceName}</strong>: prompts, ejecuciones, menciones,
          métricas, fuentes y configuración.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-red-800">
          Escribe{" "}
          <code className="bg-red-100 border border-red-200 px-1 py-0.5 rounded text-xs font-mono">
            {workspaceSlug}
          </code>{" "}
          para confirmar
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={workspaceSlug}
          disabled={isPending}
          className="w-full max-w-xs px-3 py-2 text-sm border border-red-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-60"
        />
      </div>

      {error && <p className="text-xs text-red-700 font-medium">{error}</p>}

      <button
        type="button"
        onClick={handleDelete}
        disabled={!isConfirmed || isPending}
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Eliminando…" : "Eliminar workspace definitivamente"}
      </button>
    </div>
  );
}
