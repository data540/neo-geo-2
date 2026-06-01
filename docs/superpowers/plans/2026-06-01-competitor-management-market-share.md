# Competitor Management in Market Share — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir botón `×` inline en la leyenda del Market Share para eliminar competidores, y prevenir que abreviaciones geográficas (LATAM, EMEA, etc.) sean auto-detectadas como marcas.

**Architecture:** El componente `MarketShareDonut` ya es un Client Component con `brandId` disponible en sus datos. Se extiende con estado de hover + llamada a `deleteCompetitorAction` existente. Las listas de exclusión en `detectBrands.ts` y `competitors.ts` se amplían con abreviaciones geográficas.

**Tech Stack:** Next.js 15, React, TypeScript, Supabase, Biome, sonner (toasts), lucide-react

---

## File Map

| Archivo | Tipo | Responsabilidad |
|---------|------|-----------------|
| `src/lib/detection/detectBrands.ts` | Modify | Añadir abreviaciones a `GENERIC_NON_BRANDS` |
| `src/actions/competitors.ts` | Modify | Añadir abreviaciones a `GENERIC_EXCLUSIONS` |
| `src/components/dashboard/MarketShareDonut.tsx` | Modify | Prop `workspaceId`, hover state, botón `×` con delete |
| `src/app/(app)/[workspace]/dashboard/page.tsx` | Modify | Pasar `workspaceId` a `<MarketShareDonut>` |

---

## Task 1: Añadir exclusiones geográficas

**Files:**
- Modify: `src/lib/detection/detectBrands.ts`
- Modify: `src/actions/competitors.ts`

- [ ] **Step 1.1: Actualizar `GENERIC_NON_BRANDS` en `detectBrands.ts`**

Reemplazar el Set existente (línea 26) con la versión ampliada:

```typescript
const GENERIC_NON_BRANDS = new Set([
  "espana",
  "colombia",
  "europa",
  "madrid",
  "bogota",
  "medellin",
  "barcelona",
  "airline",
  "aerolinea",
  "aerolineas",
  // geographic abbreviations — not brand names
  "latam",
  "emea",
  "apac",
  "mena",
  "dach",
  "amer",
  "cee",
  "ue",
  "eeuu",
]);
```

- [ ] **Step 1.2: Actualizar `GENERIC_EXCLUSIONS` en `competitors.ts`**

Añadir al final del Set existente (línea 10) las mismas abreviaciones:

```typescript
const GENERIC_EXCLUSIONS = new Set([
  "espana",
  "colombia",
  "mexico",
  "argentina",
  "chile",
  "peru",
  "madrid",
  "bogota",
  "barcelona",
  "medellin",
  "aeropuerto",
  "ciudad",
  "pais",
  "region",
  "empresa",
  "compania",
  "servicio",
  "servicios",
  "producto",
  "productos",
  "solucion",
  "soluciones",
  "plataforma",
  "herramienta",
  // geographic abbreviations — not brand names
  "latam",
  "emea",
  "apac",
  "mena",
  "dach",
  "amer",
  "cee",
  "ue",
  "eeuu",
]);
```

- [ ] **Step 1.3: Verificar TypeScript y lint**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: sin errores.

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/detection/detectBrands.ts src/actions/competitors.ts
git commit -m "fix(detection): exclude geographic abbreviations from competitor auto-detection"
```

---

## Task 2: Añadir botón `×` en la leyenda de MarketShareDonut

**Files:**
- Modify: `src/components/dashboard/MarketShareDonut.tsx`

- [ ] **Step 2.1: Añadir imports necesarios**

Añadir al bloque de imports existente (después de `"use client"`):

```typescript
import { X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCompetitorAction } from "@/actions/competitors";
```

- [ ] **Step 2.2: Actualizar la interfaz `Props`**

```typescript
interface Props {
  data: MarketShareEntry[];
  ownBrandName: string;
  badgeLabel?: string;
  workspaceId: string;
}
```

- [ ] **Step 2.3: Añadir `brandId` al tipo local `chartData` y al mapping**

Dentro de la función `MarketShareDonut`, el mapping de `visible`:

```typescript
const chartData = visible.map((d) => ({
  name: d.brandName,
  value: d.sharePct,
  mentionsCount: d.mentionsCount,
  isOwn: d.brandType === "own",
  color: colorForBrand(d.brandName, d.brandType === "own"),
  brandId: d.brandId,
}));
```

Y el push del entry de "rest":

```typescript
if (restShare > 0) {
  chartData.push({
    name: `+${rest.length} more competitors`,
    value: restShare,
    mentionsCount: rest.reduce((acc, r) => acc + r.mentionsCount, 0),
    isOwn: false,
    color: REST_COLOR,
    brandId: "", // aggregated entry — no delete button
  });
}
```

- [ ] **Step 2.4: Añadir estado y handler de delete**

Justo antes del `return`, dentro de la función del componente:

```typescript
const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
const router = useRouter();

async function handleDelete(brandId: string, index: number) {
  setDeletingIndex(index);
  const result = await deleteCompetitorAction(brandId, workspaceId);
  if (result.success) {
    toast.success("Competidor eliminado");
    router.refresh();
  } else {
    toast.error(result.error ?? "Error al eliminar competidor");
  }
  setDeletingIndex(null);
}
```

- [ ] **Step 2.5: Actualizar la leyenda con hover y botón `×`**

Reemplazar el bloque `<div className="mt-3 space-y-2 ...">` con:

```typescript
<div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
  {chartData.map((entry, index) => (
    <div
      key={entry.name}
      className="flex items-center gap-2 text-sm"
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: entry.color }}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 truncate text-slate-700">
        {entry.name}
        {entry.isOwn && (
          <span className="ml-1.5 text-xs text-indigo-600 font-medium">(Tu)</span>
        )}
      </span>
      <div className="w-20 h-1 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, (entry.value / maxVisibleShare) * 100)}%`,
            backgroundColor: entry.color,
          }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-900 tabular-nums w-12 text-right">
        {entry.value.toFixed(1)}%
      </span>
      {!entry.isOwn && entry.brandId !== "" && (
        <button
          type="button"
          aria-label={`Eliminar ${entry.name}`}
          onClick={() => handleDelete(entry.brandId, index)}
          disabled={deletingIndex === index}
          className={`ml-1 p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ${
            hoveredIndex === index || deletingIndex === index
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 2.6: Verificar TypeScript y lint**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: sin errores. Si Biome reporta `noImplicitAnyLet` en `useState`, especificar el tipo:
```typescript
const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
```

- [ ] **Step 2.7: Commit**

```bash
git add src/components/dashboard/MarketShareDonut.tsx
git commit -m "feat(dashboard): add inline delete button to Market Share legend"
```

---

## Task 3: Pasar `workspaceId` desde la página Dashboard

**Files:**
- Modify: `src/app/(app)/[workspace]/dashboard/page.tsx`

- [ ] **Step 3.1: Localizar el uso de `<MarketShareDonut>` en la página**

Buscar la línea que contiene `<MarketShareDonut` (alrededor de la línea 556). Actualmente:

```typescript
<MarketShareDonut
  data={marketShare}
  ownBrandName={workspace.brand_name}
  badgeLabel={badgeLabel}
/>
```

- [ ] **Step 3.2: Añadir la prop `workspaceId`**

```typescript
<MarketShareDonut
  data={marketShare}
  ownBrandName={workspace.brand_name}
  badgeLabel={badgeLabel}
  workspaceId={workspace.id}
/>
```

`workspace.id` ya está disponible en el scope: el Server Component carga el workspace al inicio de la página mediante Supabase.

- [ ] **Step 3.3: Verificar TypeScript y lint**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: sin errores.

- [ ] **Step 3.4: Verificar en localhost**

Abrir http://localhost:3000 en un workspace con competidores. Confirmar:
1. Al hacer hover sobre una fila de competidor → aparece icono `×`
2. Al hacer hover sobre la propia marca → no aparece `×`
3. Al hacer hover sobre "+N more competitors" → no aparece `×`
4. Al hacer clic en `×` → toast "Competidor eliminado" y el donut se actualiza sin ese competidor

- [ ] **Step 3.5: Commit final**

```bash
git add src/app/(app)/[workspace]/dashboard/page.tsx
git commit -m "feat(dashboard): wire workspaceId into MarketShareDonut for competitor deletion"
```

---

## Verificación final

- [ ] `pnpm build` sin errores de TypeScript ni de build
- [ ] `pnpm lint` sin warnings nuevos
- [ ] Flujo manual: hacer hover en el donut → `×` visible → clic → toast → donut actualizado
- [ ] LATAM no aparece como sugerencia en nuevas ejecuciones de prompts (requiere ejecutar un prompt que mencione LATAM para verificar)
