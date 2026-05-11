import { Info } from "lucide-react";

interface PlanBannerProps {
  activePromptsCount: number;
  maxPrompts?: number;
  trialDaysLeft?: number;
}

export function PlanBanner({
  activePromptsCount,
  maxPrompts = 10,
  trialDaysLeft = 6,
}: PlanBannerProps) {
  const isAtLimit = activePromptsCount >= maxPrompts;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-medium">Prueba gratuita activa</span>
        <span className="text-blue-500">·</span>
        <span className="text-blue-500">{trialDaysLeft} días restantes</span>
        <span className="text-blue-500">·</span>
        <span className={isAtLimit ? "font-medium text-orange-600" : ""}>
          Hasta {maxPrompts} prompts por workspace{" "}
          <span className="font-medium">
            | {activePromptsCount} activos
            {isAtLimit && " — Límite alcanzado"}
          </span>
        </span>
      </div>
    </div>
  );
}
