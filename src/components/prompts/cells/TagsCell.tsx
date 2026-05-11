"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { assignTagToPromptAction, removeTagFromPromptAction } from "@/actions/tags";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  promptId: string;
  workspaceId: string;
  tags: Tag[];
  availableTags: Tag[];
}

export function TagsCell({ promptId, workspaceId, tags, availableTags }: Props) {
  const [open, setOpen] = useState(false);
  const [localTags, setLocalTags] = useState(tags);

  async function assign(tagId: string) {
    const result = await assignTagToPromptAction({ promptId, tagId, workspaceId });
    if (result.success) {
      const tag = availableTags.find((t) => t.id === tagId);
      if (tag && !localTags.find((t) => t.id === tagId)) {
        setLocalTags((prev) => [...prev, tag]);
      }
    } else {
      toast.error(result.error ?? "Error al añadir etiqueta");
    }
    setOpen(false);
  }

  async function remove(tagId: string) {
    const result = await removeTagFromPromptAction(promptId, tagId, workspaceId);
    if (result.success) {
      setLocalTags((prev) => prev.filter((t) => t.id !== tagId));
    } else {
      toast.error(result.error ?? "Error al eliminar etiqueta");
    }
  }

  const unassigned = availableTags.filter((t) => !localTags.find((lt) => lt.id === t.id));

  return (
    <div className="flex items-center flex-wrap gap-1">
      {localTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          {tag.name}
          <button
            type="button"
            onClick={() => remove(tag.id)}
            className="hover:opacity-70 ml-0.5"
            aria-label="Eliminar etiqueta"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-dashed border-slate-300"
        >
          <Plus className="w-3 h-3" />
        </button>

        {open && unassigned.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[120px]">
            {unassigned.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => assign(tag.id)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {open && unassigned.length === 0 && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
            Sin etiquetas disponibles
          </div>
        )}
      </div>
    </div>
  );
}
