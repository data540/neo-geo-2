"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  defaultValues: {
    workspaceId: string;
    brandName: string;
    domain: string;
    brandStatement: string;
    country: string;
    location?: string;
    category?: string;
    productsServices?: string;
    targetAudience?: string;
    differentiators?: string;
    competitors: string[];
  };
  onSubmit: (formData: FormData) => Promise<void>;
  onAutoAll?: (formData: FormData) => Promise<void>;
  loading: boolean;
  autoLoading?: boolean;
  showAutoButton?: boolean;
  preFilled?: boolean;
}

const COUNTRIES = [
  { code: "ES", name: "España" },
  { code: "CO", name: "Colombia" },
];

export function ResearchContextForm({
  defaultValues,
  onSubmit,
  onAutoAll,
  loading,
  autoLoading = false,
  showAutoButton = false,
  preFilled = false,
}: Props) {
  const [numPrompts, setNumPrompts] = useState(30);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("numberOfPrompts", String(numPrompts));
    await onSubmit(fd);
  }

  async function handleAutoAll() {
    if (!onAutoAll) return;
    const form = document.getElementById("geo-research-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("numberOfPrompts", String(numPrompts));
    await onAutoAll(fd);
  }

  const anyLoading = loading || autoLoading;

  return (
    <form id="geo-research-form" onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="workspaceId" value={defaultValues.workspaceId} />

      {preFilled && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <p className="text-xs text-indigo-700">
            <span className="font-semibold">Contexto pre-rellenado</span> desde Company Bio y
            Competidores. Revisa y ajusta lo que necesites antes de generar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="brandName">Nombre de la marca</Label>
          <Input
            id="brandName"
            name="brandName"
            defaultValue={defaultValues.brandName}
            maxLength={100}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="domain">Dominio web</Label>
          <Input
            id="domain"
            name="domain"
            defaultValue={defaultValues.domain}
            placeholder="ej. aerolinea.com"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brandStatement">Descripción de la marca</Label>
        <Textarea
          id="brandStatement"
          name="brandStatement"
          defaultValue={defaultValues.brandStatement}
          rows={2}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">País</Label>
          <Select name="country" defaultValue={defaultValues.country} disabled={loading}>
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

        <div className="space-y-1.5">
          <Label htmlFor="location">Ciudad o mercado principal</Label>
          <Input
            id="location"
            name="location"
            defaultValue={defaultValues.location ?? ""}
            maxLength={100}
            placeholder="ej. Madrid, Barcelona, Bogota"
            disabled={anyLoading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Segmento de operaciones</Label>
        <Input
          id="category"
          name="category"
          defaultValue={defaultValues.category ?? ""}
          maxLength={100}
          placeholder="ej. Software B2B, e-commerce, servicios profesionales, retail"
          required
          disabled={anyLoading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="productsServices">Productos y servicios principales</Label>
        <Textarea
          id="productsServices"
          name="productsServices"
          defaultValue={defaultValues.productsServices ?? ""}
          rows={2}
          placeholder="ej. Suscripción mensual, soporte premium, integración API, formación"
          disabled={anyLoading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetAudience">Audiencia objetivo</Label>
        <Input
          id="targetAudience"
          name="targetAudience"
          defaultValue={defaultValues.targetAudience ?? ""}
          placeholder="ej. PYMEs, directores de marketing, usuarios técnicos, consumidores finales"
          disabled={anyLoading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="differentiators">Diferenciadores de la marca</Label>
        <Textarea
          id="differentiators"
          name="differentiators"
          defaultValue={defaultValues.differentiators ?? ""}
          rows={2}
          placeholder="ej. Precio competitivo, atención al cliente 24/7, tecnología propia, certificaciones"
          disabled={anyLoading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="competitors">
          Competidores{" "}
          <span className="text-slate-400 font-normal text-xs">(separados por coma)</span>
        </Label>
        <Input
          id="competitors"
          name="competitors"
          defaultValue={defaultValues.competitors.join(", ")}
          placeholder="ej. Iberia, Vueling, Avianca, LATAM"
          disabled={anyLoading}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Número de prompts a generar</Label>
          <span className="text-sm font-semibold text-indigo-600">{numPrompts}</span>
        </div>
        <Slider
          value={[numPrompts]}
          onValueChange={(vals) => {
            const v = Array.isArray(vals) ? vals[0] : vals;
            setNumPrompts(v ?? 30);
          }}
          min={15}
          max={60}
          step={5}
          disabled={anyLoading}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>15</span>
          <span>30</span>
          <span>60</span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={anyLoading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generando prompts con IA…
            </>
          ) : (
            "Generar prompts candidatos"
          )}
        </Button>

        {loading && (
          <p className="text-xs text-slate-400 text-center mt-2">
            Esto puede tardar hasta 30 segundos — estamos consultando varios modelos de IA…
          </p>
        )}

        {showAutoButton && onAutoAll && (
          <Button
            type="button"
            onClick={handleAutoAll}
            variant="outline"
            className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            disabled={anyLoading}
          >
            {autoLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando, auditando y priorizando…
              </>
            ) : (
              "🪄 Auto-generar todo (incluye RAG + cobertura + priorización)"
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
