"use client";

import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateRecommendationsAction } from "@/actions/recommendations";
import { Button } from "@/components/ui/button";
import type { GeoRecommendation, RecommendationGuide } from "@/types";

const CATEGORY_LABELS: Record<GeoRecommendation["category"], string> = {
  visibility: "Visibilidad",
  content: "Contenido web",
  prompts: "Prompts",
  consistency: "Consistencia",
  sources: "Fuentes",
};

const CATEGORY_COLORS: Record<GeoRecommendation["category"], string> = {
  visibility: "bg-indigo-100 text-indigo-700",
  content: "bg-emerald-100 text-emerald-700",
  prompts: "bg-violet-100 text-violet-700",
  consistency: "bg-sky-100 text-sky-700",
  sources: "bg-orange-100 text-orange-700",
};

const PRIORITY_STYLES: Record<GeoRecommendation["priority"], { bar: string; label: string }> = {
  high: { bar: "border-l-red-400", label: "Alta prioridad" },
  medium: { bar: "border-l-amber-400", label: "Prioridad media" },
  low: { bar: "border-l-green-400", label: "Prioridad baja" },
};

interface Props {
  workspaceId: string;
  initialRecommendations: GeoRecommendation[];
  guides: RecommendationGuide[];
  hasApiKey: boolean;
}

function RecommendationCard({ rec }: { rec: GeoRecommendation }) {
  const [open, setOpen] = useState(false);
  const styles = PRIORITY_STYLES[rec.priority];

  return (
    <div className={`bg-white border border-slate-200 rounded-xl border-l-4 ${styles.bar} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[rec.category]}`}>
              {CATEGORY_LABELS[rec.category]}
            </span>
            <span className="text-xs text-slate-400">{styles.label}</span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{rec.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{rec.description}</p>
        </div>
        <div className="shrink-0 mt-1 text-slate-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-slate-100">
          <p className="text-sm text-slate-700 mt-3 mb-3">{rec.description}</p>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Acciones</p>
          <ul className="space-y-1.5">
            {rec.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RecommendationsPanel({ workspaceId, initialRecommendations, guides, hasApiKey }: Props) {
  const [recommendations, setRecommendations] = useState<GeoRecommendation[]>(initialRecommendations);
  const [pending, startTransition] = useTransition();

  const highCount = recommendations.filter((r) => r.priority === "high").length;
  const mediumCount = recommendations.filter((r) => r.priority === "medium").length;
  const lowCount = recommendations.filter((r) => r.priority === "low").length;

  function handleRegenerate() {
    startTransition(async () => {
      const result = await generateRecommendationsAction(workspaceId);
      if (result.success && result.data) {
        setRecommendations(result.data);
        toast.success("Recomendaciones actualizadas");
      } else {
        toast.error(result.error ?? "No se pudieron generar las recomendaciones");
      }
    });
  }

  const sortedRecs = [...recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <div className="space-y-6">
      {!hasApiKey && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Sin clave de Anthropic</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Las recomendaciones son estimaciones basadas en tus métricas. Para recomendaciones personalizadas con IA, añade{" "}
              <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> a tus variables de entorno.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {recommendations.length} recomendaciones activas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {highCount > 0 && <span className="text-red-500 font-medium">{highCount} alta prioridad</span>}
              {highCount > 0 && mediumCount > 0 && <span className="text-slate-300 mx-1">·</span>}
              {mediumCount > 0 && <span className="text-amber-500 font-medium">{mediumCount} media</span>}
              {(highCount > 0 || mediumCount > 0) && lowCount > 0 && <span className="text-slate-300 mx-1">·</span>}
              {lowCount > 0 && <span className="text-green-500 font-medium">{lowCount} baja</span>}
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRegenerate}
            disabled={pending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Regenerar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {sortedRecs.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}
      </div>

      {guides.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Guías de referencia</h2>
          </div>
          <div className="space-y-3">
            {guides.map((guide) => (
              <div key={guide.slug} className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-slate-800">{guide.title}</p>
                {guide.description && (
                  <p className="text-xs text-slate-500">{guide.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
