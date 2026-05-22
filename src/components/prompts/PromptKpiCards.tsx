import { BarChart3, Eye, Target, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkspaceKpis } from "@/types";

interface EnabledLlm {
  key: string;
  name: string;
}

const LLM_COLORS: Record<string, string> = {
  chatgpt: "bg-green-100 text-green-800",
  claude: "bg-orange-100 text-orange-800",
  gemini: "bg-blue-100 text-blue-800",
  perplexity: "bg-purple-100 text-purple-800",
  deepseek: "bg-slate-100 text-slate-800",
};

interface Props {
  kpis: WorkspaceKpis;
  enabledLlms?: EnabledLlm[];
  usagePct?: number;
}

export function PromptKpiCards({ kpis, enabledLlms = [], usagePct = 100 }: Props) {
  const consistencyPct = Math.round(kpis.brandConsistency);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Eye className="w-4 h-4 text-green-600" aria-hidden="true" />
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
              <Target className="w-4 h-4 text-indigo-600" aria-hidden="true" />
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
              <BarChart3 className="w-4 h-4 text-purple-600" aria-hidden="true" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Cobertura de LLMs
              </p>
              {enabledLlms.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {enabledLlms.map((llm) => (
                      <span
                        key={llm.key}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${LLM_COLORS[llm.key] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {llm.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {usagePct}% por LLM · reparto uniforme
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 mt-2">Sin LLMs configurados</p>
              )}
            </div>
            <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0 ml-2">
              <Layers className="w-4 h-4 text-cyan-600" aria-hidden="true" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
