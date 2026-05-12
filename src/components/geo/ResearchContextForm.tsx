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
    competitors: string[];
  };
  onSubmit: (formData: FormData) => Promise<void>;
  loading: boolean;
}

const COUNTRIES = [
  { code: "ES", name: "España" },
  { code: "CO", name: "Colombia" },
];

export function ResearchContextForm({ defaultValues, onSubmit, loading }: Props) {
  const [numPrompts, setNumPrompts] = useState(10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("numberOfPrompts", String(numPrompts));
    await onSubmit(fd);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="workspaceId" value={defaultValues.workspaceId} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="brandName">Nombre de la marca</Label>
          <Input
            id="brandName"
            name="brandName"
            defaultValue={defaultValues.brandName}
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

      <div className="grid grid-cols-2 gap-4">
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
            placeholder="ej. Madrid, Barcelona, Bogota"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Segmento de operaciones de aerolinea</Label>
        <Input
          id="category"
          name="category"
          defaultValue="Vuelos comerciales de pasajeros"
          placeholder="ej. Vuelos nacionales, vuelos internacionales, soporte posventa"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="productsServices">Servicios principales de la aerolinea</Label>
        <Textarea
          id="productsServices"
          name="productsServices"
          rows={2}
          placeholder="ej. Check-in online, equipaje facturado, cambios y reembolsos, asistencia en aeropuerto"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetAudience">Audiencia objetivo de pasajeros</Label>
        <Input
          id="targetAudience"
          name="targetAudience"
          placeholder="ej. Viajeros frecuentes, familias, pasajeros de negocios, rutas Espana-Colombia"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="differentiators">Diferenciadores operativos de la marca</Label>
        <Textarea
          id="differentiators"
          name="differentiators"
          rows={2}
          placeholder="ej. Mejor puntualidad, politicas flexibles de cambio, soporte rapido en incidencias"
          disabled={loading}
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
          disabled={loading}
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
            setNumPrompts(v ?? 10);
          }}
          min={10}
          max={50}
          step={5}
          disabled={loading}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>10</span>
          <span>25</span>
          <span>50</span>
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
            Generando prompts con IA…
          </>
        ) : (
          "Generar prompts candidatos"
        )}
      </Button>
    </form>
  );
}
