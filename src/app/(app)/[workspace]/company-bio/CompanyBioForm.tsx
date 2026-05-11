"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface InitialData {
  brandName: string;
  domain: string;
  brandStatement: string;
  country: string;
  extractedSummary: string;
  positioning: string;
  audience: string;
  productsServices: string;
  differentiators: string;
}

interface Props {
  workspaceId: string;
  initialData: InitialData;
}

export function CompanyBioForm({ workspaceId, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(initialData);

  function set(key: keyof InitialData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    // Actualizar workspace
    const { error: wsError } = await supabase
      .from("workspaces")
      .update({
        brand_name: data.brandName,
        domain: data.domain || null,
        brand_statement: data.brandStatement || null,
      })
      .eq("id", workspaceId);

    if (wsError) {
      toast.error("Error al guardar el perfil");
      setLoading(false);
      return;
    }

    // Upsert brand_profile
    const { error: bpError } = await supabase.from("brand_profiles").upsert(
      {
        workspace_id: workspaceId,
        extracted_summary: data.extractedSummary || null,
        positioning: data.positioning || null,
        audience: data.audience || null,
        products_services: data.productsServices || null,
        differentiators: data.differentiators || null,
      },
      { onConflict: "workspace_id" }
    );

    if (bpError) {
      toast.error("Error al guardar el perfil de marca");
    } else {
      toast.success("Perfil de marca guardado");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Datos básicos</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nombre de la marca</Label>
            <Input
              value={data.brandName}
              onChange={(e) => set("brandName", e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dominio web</Label>
            <Input
              value={data.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="ej. escuela-ces.es"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Descripción de la marca</Label>
          <Textarea
            value={data.brandStatement}
            onChange={(e) => set("brandStatement", e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Perfil detallado</h2>

        <div className="space-y-1.5">
          <Label>Resumen extraído</Label>
          <Textarea
            value={data.extractedSummary}
            onChange={(e) => set("extractedSummary", e.target.value)}
            rows={3}
            placeholder="Resumen generado por IA sobre tu marca…"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Posicionamiento</Label>
          <Textarea
            value={data.positioning}
            onChange={(e) => set("positioning", e.target.value)}
            rows={2}
            placeholder="Cómo se posiciona tu marca en el mercado…"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Audiencia objetivo</Label>
          <Input
            value={data.audience}
            onChange={(e) => set("audience", e.target.value)}
            placeholder="ej. Jóvenes de 18-25 interesados en audiovisual"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Productos y servicios</Label>
          <Textarea
            value={data.productsServices}
            onChange={(e) => set("productsServices", e.target.value)}
            rows={2}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Diferenciadores</Label>
          <Textarea
            value={data.differentiators}
            onChange={(e) => set("differentiators", e.target.value)}
            rows={2}
            placeholder="Lo que hace única a tu marca…"
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex justify-end">
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
            "Guardar cambios"
          )}
        </Button>
      </div>
    </form>
  );
}
