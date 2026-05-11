import type { PromptCandidate } from "@/types";

interface Props {
  candidate: PromptCandidate;
  selected: boolean;
  onToggle: (id: string) => void;
}

const INTENT_LABEL: Record<string, string> = {
  discovery: "Descubrimiento",
  comparison: "Comparación",
  reputation: "Reputación",
  branded: "Marca",
  decision: "Decisión",
  local: "Local",
  price: "Precio",
  employability: "Empleabilidad",
  product_specific: "Producto",
};

const FUNNEL_LABEL: Record<string, { label: string; color: string }> = {
  top: { label: "Top", color: "bg-blue-50 text-blue-700" },
  middle: { label: "Middle", color: "bg-amber-50 text-amber-700" },
  bottom: { label: "Bottom", color: "bg-green-50 text-green-700" },
};

export function PromptCandidateCard({ candidate, selected, onToggle }: Props) {
  const funnelCfg = candidate.funnel_stage
    ? (FUNNEL_LABEL[candidate.funnel_stage] ?? {
        label: candidate.funnel_stage,
        color: "bg-slate-50 text-slate-600",
      })
    : null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: tarjeta con patrón checkbox visual personalizado
    <div
      onClick={() => onToggle(candidate.id)}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => e.key === " " && onToggle(candidate.id)}
      className={`cursor-pointer rounded-xl border p-4 transition-all select-none ${
        selected
          ? "border-indigo-500 bg-indigo-50/50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
            selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
          }`}
        >
          {selected && (
            <svg
              aria-hidden="true"
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">{candidate.prompt}</p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {candidate.intent && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                {INTENT_LABEL[candidate.intent] ?? candidate.intent}
              </span>
            )}
            {funnelCfg && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${funnelCfg.color}`}>
                {funnelCfg.label}
              </span>
            )}
            {candidate.includes_brand && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                Con marca
              </span>
            )}
            {candidate.includes_competitor && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-700">
                Con competidor
              </span>
            )}
          </div>

          {candidate.persona && (
            <p className="text-xs text-slate-400 mt-1.5 italic">{candidate.persona}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {candidate.priority_score !== null && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">Prioridad</span>
                <span className="text-xs font-semibold text-indigo-600">
                  {candidate.priority_score}
                </span>
              </div>
            )}
            {candidate.ai_search_likelihood !== null && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">IA</span>
                <span className="text-xs font-semibold text-slate-600">
                  {candidate.ai_search_likelihood}/10
                </span>
              </div>
            )}
            {candidate.strategic_value !== null && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">Estratégico</span>
                <span className="text-xs font-semibold text-slate-600">
                  {candidate.strategic_value}/10
                </span>
              </div>
            )}
          </div>

          {candidate.reason && (
            <p className="text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">
              {candidate.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
