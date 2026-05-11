"use client";

import { Globe, Loader2, MapPin, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
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
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
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

export default function OnboardingPage() {
  const router = useRouter();
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
      router.push(`/${result.data.slug}/prompts`);
    } catch (error) {
      toast.error("Error inesperado al crear el workspace");
      setLoading(false);
      console.error("Workspace creation error:", error);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Configura tu marca</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Cuéntanos sobre tu marca para empezar a monitorizar tu visibilidad en IA.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="brandName">Nombre de la marca</Label>
              <Input
                id="brandName"
                name="brandName"
                placeholder="ej. Escuela CES"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain">
                Dominio web <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="domain"
                  name="domain"
                  placeholder="ej. escuela-ces.es"
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brandStatement">
                Descripción de la marca{" "}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="brandStatement"
                name="brandStatement"
                placeholder="ej. Escuela de cine y artes audiovisuales en Madrid con más de 30 años de historia y titulaciones oficiales del Ministerio de Educación."
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-slate-400">
                Ayuda a la IA a generar prompts más precisos.
              </p>
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
                  Creando workspace…
                </>
              ) : (
                "Crear workspace y empezar"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Podrás añadir competidores y ajustar la configuración después.
        </p>
      </div>
    </div>
  );
}
