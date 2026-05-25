"use client";

import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createTagAction,
  deleteTagAction,
  updateTagAction,
  type WorkspaceTagWithUsage,
} from "@/actions/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  workspaceId: string;
  initialTags: WorkspaceTagWithUsage[];
  canManage: boolean;
}

const COLOR_PRESETS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
];

export function TagsManagementPanel({ workspaceId, initialTags, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0] ?? "#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Escribe un nombre");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("name", trimmed);
      fd.set("color", color);

      const result = await createTagAction(fd);
      if (result.success) {
        toast.success(`Etiqueta "${trimmed}" creada`);
        setName("");
        setColor(COLOR_PRESETS[0] ?? "#6366f1");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo crear la etiqueta");
      }
    });
  }

  function startEdit(tag: WorkspaceTagWithUsage) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function handleSaveEdit(tagId: string) {
    if (!canManage) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("El nombre no puede estar vacío");
      return;
    }

    startTransition(async () => {
      const result = await updateTagAction({
        tagId,
        workspaceId,
        name: trimmed,
        color: editColor,
      });
      if (result.success) {
        toast.success("Etiqueta actualizada");
        cancelEdit();
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo actualizar");
      }
    });
  }

  function handleDelete(tag: WorkspaceTagWithUsage) {
    if (!canManage) return;
    const msg =
      tag.prompt_count > 0
        ? `Eliminar "${tag.name}" la quitará de ${tag.prompt_count} prompt${tag.prompt_count === 1 ? "" : "s"}. ¿Continuar?`
        : `¿Eliminar la etiqueta "${tag.name}"?`;
    if (!window.confirm(msg)) return;

    setDeletingId(tag.id);
    startTransition(async () => {
      const result = await deleteTagAction({ tagId: tag.id, workspaceId });
      setDeletingId(null);
      if (result.success) {
        toast.success(`"${tag.name}" eliminada`);
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo eliminar");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Crear etiqueta */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Crear etiqueta</h2>

        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
          <div className="space-y-1">
            <Label htmlFor="tag-name">Nombre</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: alta prioridad"
              maxLength={50}
              disabled={!canManage || pending}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex items-center gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  disabled={!canManage || pending}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c
                      ? "border-slate-900 scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={!canManage || pending}
                className="w-6 h-6 rounded-full border border-slate-200 cursor-pointer ml-1"
                aria-label="Color personalizado"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!canManage || pending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {pending && !editingId && !deletingId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Crear
          </Button>
        </form>
      </section>

      {/* Lista de etiquetas */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Etiquetas del workspace ({initialTags.length})
          </h2>
        </div>

        {initialTags.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-6 text-center">
            Aún no hay etiquetas. Crea la primera arriba.
          </p>
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-slate-500">
                    Etiqueta
                  </th>
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-slate-500 w-32">
                    Prompts
                  </th>
                  <th className="text-right px-3 py-2 text-xs uppercase tracking-wide text-slate-500 w-32">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {initialTags.map((tag) => {
                  const isEditing = editingId === tag.id;
                  const isDeleting = deletingId === tag.id;

                  return (
                    <tr key={tag.id} className="border-b border-slate-50 last:border-b-0">
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="w-7 h-7 rounded border border-slate-200 cursor-pointer shrink-0"
                              aria-label="Color"
                            />
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={50}
                              className="h-8 text-sm"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                            style={{
                              background: `${tag.color}20`,
                              color: tag.color,
                              border: `1px solid ${tag.color}40`,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: tag.color }}
                              aria-hidden="true"
                            />
                            {tag.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">
                        {tag.prompt_count === 0
                          ? "Sin asignar"
                          : `${tag.prompt_count} prompt${tag.prompt_count === 1 ? "" : "s"}`}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveEdit(tag.id)}
                                disabled={pending}
                                className="h-7 px-2 text-emerald-700 hover:bg-emerald-50"
                              >
                                {pending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={pending}
                                className="h-7 px-2 text-slate-500 hover:bg-slate-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(tag)}
                                disabled={!canManage || pending}
                                className="h-7 px-2 text-slate-600 hover:bg-slate-100"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(tag)}
                                disabled={!canManage || pending}
                                className="h-7 px-2 text-red-600 hover:bg-red-50"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!canManage && (
          <p className="text-xs text-slate-500 italic">
            Necesitas rol owner, admin o member para gestionar etiquetas.
          </p>
        )}
      </section>
    </div>
  );
}
