"use client";

import { Globe, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createWorkspaceAction } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { code: "ES", name: "España" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "US", name: "Estados Unidos" },
  { code: "GB", name: "Reino Unido" },
  { code: "DE", name: "Alemania" },
  { code: "FR", name: "Francia" },
  { code: "IT", name: "Italia" },
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brasil" },
];

interface WorkspaceFormProps {
  onSuccess: (slug: string) => void;
}

export function WorkspaceForm({ onSuccess }: WorkspaceFormProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createWorkspaceAction(formData);

      if (!result.success) {
        toast.error(result.error ?? "Error al crear el workspace");
        setLoading(false);
        return;
      }

      if (!result.data?.slug) {
        toast.error("Error: No se pudo obtener el workspace");
        setLoading(false);
        return;
      }

      toast.success("Workspace creado correctamente");
      onSuccess(result.data.slug);
    } catch (error) {
      toast.error("Error inesperado al crear el workspace");
      setLoading(false);
      console.error("Workspace creation error:", error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="brandName">Nombre de la marca</Label>
        <Input
          id="brandName"
          name="brandName"
          placeholder="ej. Iberia"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="domain">
          Dominio web <span className="text-slate-400 font-normal">(opcional)</span>
        </Label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            id="domain"
            name="domain"
            placeholder="ej. iberia.com"
            className="pl-9"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brandStatement">
          Descripción de la marca <span className="text-slate-400 font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="brandStatement"
          name="brandStatement"
          placeholder="ej. Aerolínea de bandera española con vuelos a más de 130 destinos en Europa, América y África."
          rows={3}
          disabled={loading}
        />
        <p className="text-xs text-slate-400">Ayuda a la IA a generar prompts más precisos.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="country">País</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
          <Select name="country" defaultValue="ES" disabled={loading}>
            <SelectTrigger className="pl-9">
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
      </div>

      <Button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generando 50 prompts personalizados…
          </>
        ) : (
          "Crear workspace y empezar"
        )}
      </Button>
    </form>
  );
}
