import { BarChart3, Eye, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkspaceKpis } from "@/types";

interface Props {
  kpis: WorkspaceKpis;
}

export function PromptKpiCards({ kpis }: Props) {
  const consistencyPct = Math.round(kpis.brandConsistency);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Menciones de marca
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-1.5">
                {kpis.brandMentionsCount}
                <span className="text-base font-normal text-slate-400 ml-1">
                  / {kpis.activePromptsCount}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-1">prompts activos</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Eye className="w-4.5 h-4.5 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Posición media
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-1.5">
                {kpis.avgPosition !== null ? (
                  <>#{Math.round(kpis.avgPosition)}</>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">en respuestas de IA</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Target className="w-4.5 h-4.5 text-indigo-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Consistencia de marca
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-1.5">
                {consistencyPct}
                <span className="text-base font-normal text-slate-400">%</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">prompts con presencia estable</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-4.5 h-4.5 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
