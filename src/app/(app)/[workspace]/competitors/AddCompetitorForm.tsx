"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createCompetitorAction } from "@/actions/competitors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  workspaceId: string;
}

export function AddCompetitorForm({ workspaceId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    fd.set("workspaceId", workspaceId);

    const result = await createCompetitorAction(fd);

    if (result.success) {
      toast.success("Competidor añadido");
      (e.currentTarget as HTMLFormElement).reset();
    } else {
      toast.error(result.error ?? "Error al añadir competidor");
    }

    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
    >
      <h2 className="text-sm font-semibold text-slate-700">Añadir competidor</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" placeholder="ej. ESCAC" required disabled={loading} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="domain">Dominio</Label>
          <Input id="domain" name="domain" placeholder="ej. escac.es" disabled={loading} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aliases">
          Aliases <span className="text-slate-400 font-normal text-xs">(separados por coma)</span>
        </Label>
        <Input
          id="aliases"
          name="aliases"
          placeholder="ej. Escuela Superior de Cinema"
          disabled={loading}
        />
      </div>

      <Button
        type="submit"
        size="sm"
        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Añadir
      </Button>
    </form>
  );
}
