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
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "US", name: "Estados Unidos" },
  { code: "GB", name: "Reino Unido" },
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
            placeholder="ej. escuela-ces.es"
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
          <Input id="location" name="location" placeholder="ej. Madrid" disabled={loading} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Categoría de negocio</Label>
        <Input
          id="category"
          name="category"
          placeholder="ej. Escuelas audiovisuales, FP Imagen y Sonido"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="productsServices">Productos o servicios principales</Label>
        <Textarea
          id="productsServices"
          name="productsServices"
          rows={2}
          placeholder="ej. FP Imagen y Sonido, Curso de realización, Máster en postproducción"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetAudience">Audiencia objetivo</Label>
        <Input
          id="targetAudience"
          name="targetAudience"
          placeholder="ej. Jóvenes de 18-25 años interesados en audiovisual, padres que buscan FP"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="differentiators">Diferenciadores de la marca</Label>
        <Textarea
          id="differentiators"
          name="differentiators"
          rows={2}
          placeholder="ej. Titulación oficial del Ministerio, 30 años de historia, 95% inserción laboral"
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
          placeholder="ej. ESCAC, EFTI, TAI"
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
