"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createPromptAction } from "@/actions/prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const COUNTRIES = [
  { code: "ES", name: "🇪🇸 España" },
  { code: "MX", name: "🇲🇽 México" },
  { code: "AR", name: "🇦🇷 Argentina" },
  { code: "CO", name: "🇨🇴 Colombia" },
  { code: "US", name: "🇺🇸 Estados Unidos" },
  { code: "GB", name: "🇬🇧 Reino Unido" },
];

interface Props {
  workspaceId: string;
  workspaceCountry: string;
}

export function AddPromptButton({ workspaceId, workspaceCountry }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("workspaceId", workspaceId);

    const result = await createPromptAction(formData);

    if (result.success) {
      toast.success("Prompt añadido correctamente");
      setOpen(false);
    } else {
      toast.error(result.error ?? "Error al crear el prompt");
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
        <Plus className="w-4 h-4" />
        Añadir prompt
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir nuevo prompt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="text">Pregunta conversacional</Label>
            <Textarea
              id="text"
              name="text"
              placeholder="ej. ¿Cuál es la mejor escuela audiovisual en Madrid para estudiar imagen y sonido?"
              rows={4}
              required
              disabled={loading}
            />
            <p className="text-xs text-slate-400">
              Escribe la pregunta tal como un usuario la haría a ChatGPT, Gemini o Claude.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">País de referencia</Label>
            <Select name="country" defaultValue={workspaceCountry} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Añadir prompt"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
