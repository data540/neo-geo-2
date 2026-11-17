"use client";

import { Loader2, Package } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

interface ProductOption {
  key: string;
  label: string;
}

interface Props {
  products: ProductOption[];
  selectedKey: string | null;
  /** Nº de prompts de cada producto (clave "all" = todos). */
  counts?: Record<string, number>;
}

/**
 * Selector de producto (?product=). Marca la opción al instante y muestra un
 * indicador mientras el servidor recalcula las métricas. Conserva el resto de
 * parámetros de la URL (LLM, rango, país).
 */
export function ProductSelector({ products, selectedKey, counts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [optimisticKey, setOptimisticKey] = useState<string | null | undefined>(undefined);

  const activeKey = pending && optimisticKey !== undefined ? optimisticKey : selectedKey;
  const options: { key: string | null; label: string }[] = [
    { key: null, label: "Todos los prompts" },
    ...products,
  ];

  function select(key: string | null) {
    if (key === activeKey) return;
    const params = new URLSearchParams(searchParams.toString());
    if (key) params.set("product", key);
    else params.delete("product");
    setOptimisticKey(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const activeLabel = options.find((o) => o.key === activeKey)?.label ?? "Todos los prompts";

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Package className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          Producto
        </span>
        <div role="tablist" aria-label="Producto" className="flex flex-wrap items-center gap-1.5">
          {options.map((o) => {
            const active = o.key === activeKey;
            const count = counts?.[o.key ?? "all"];
            return (
              <button
                key={o.key ?? "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => select(o.key)}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700",
                ].join(" ")}
              >
                {o.label}
                {count !== undefined && (
                  <span
                    className={[
                      "rounded-full px-1.5 text-xs tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
          {pending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" aria-hidden="true" />
              Cargando métricas de {activeLabel.toLowerCase()}…
            </>
          ) : activeKey ? (
            <>Métricas solo de los prompts de {activeLabel.toLowerCase()}</>
          ) : null}
        </span>
      </div>
    </div>
  );
}
