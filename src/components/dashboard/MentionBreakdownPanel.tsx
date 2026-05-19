import type { MentionBreakdownEntry, MentionType } from "@/types";

interface Props {
  data: MentionBreakdownEntry[];
}

const TYPE_META: Record<
  MentionType,
  { label: string; description: string; color: string; bar: string }
> = {
  primary_recommendation: {
    label: "Recomendación principal",
    description: "La IA te recomienda como mejor opción",
    color: "text-emerald-600",
    bar: "bg-emerald-500",
  },
  list_option: {
    label: "Opción en lista",
    description: "Apareces dentro de una enumeración",
    color: "text-indigo-600",
    bar: "bg-indigo-500",
  },
  comparison: {
    label: "Comparación",
    description: "Mencionado en contexto comparativo",
    color: "text-orange-600",
    bar: "bg-orange-500",
  },
  general_mention: {
    label: "Mención general",
    description: "Sin contexto particular",
    color: "text-slate-500",
    bar: "bg-slate-400",
  },
  warning: {
    label: "Advertencia",
    description: "Mencionado con tono crítico o de cuidado",
    color: "text-red-600",
    bar: "bg-red-500",
  },
};

const ORDER: MentionType[] = [
  "list_option",
  "primary_recommendation",
  "general_mention",
  "comparison",
  "warning",
];

export function MentionBreakdownPanel({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">¿Cómo te están mencionando?</h3>
          <p className="text-xs text-slate-500 mt-0.5">Desglose por tipo de mención</p>
        </div>
        <p className="text-center text-xs text-slate-400 py-12">Sin menciones todavía.</p>
      </div>
    );
  }

  // Indexar y ordenar según ORDER
  const byType = new Map(data.map((d) => [d.mentionType, d]));
  const ordered = ORDER.map((t) => ({
    type: t,
    entry: byType.get(t),
  })).filter((row) => row.entry !== undefined);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">¿Cómo te están mencionando?</h3>
          <p className="text-xs text-slate-500 mt-0.5">Desglose por tipo de mención</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          Últimos 30D
        </span>
      </div>

      <div className="space-y-3">
        {ordered.map(({ type, entry }) => {
          const meta = TYPE_META[type];
          const pct = entry?.pct ?? 0;
          const count = entry?.count ?? 0;
          return (
            <div key={type}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                  {type === "primary_recommendation" && (
                    <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-900 shrink-0">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${meta.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="sr-only">
                {count} menciones · {meta.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
