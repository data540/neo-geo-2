import { AlertTriangle, BarChart3, Eye, Target, Users } from "lucide-react";

interface OwnKpis {
  visibility: number;
  avgPosition: number | null;
  sov: number | null;
  totalCompetitors: number;
  highThreats: number;
}

interface Props {
  kpis: OwnKpis;
}

export function CompetitorKpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Tu visibilidad
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1.5">
              {kpis.visibility.toFixed(1)}
              <span className="text-base font-normal text-slate-400">%</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">prompts que mencionan tu marca</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Eye className="w-4.5 h-4.5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Tu posición
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1.5">
              {kpis.avgPosition !== null ? (
                <>#<span>{kpis.avgPosition.toFixed(1)}</span></>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">posición media en respuestas IA</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Target className="w-4.5 h-4.5 text-indigo-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tu SOV</p>
            <p className="text-3xl font-bold text-slate-900 mt-1.5">
              {kpis.sov !== null ? (
                <>
                  {kpis.sov.toFixed(1)}
                  <span className="text-base font-normal text-slate-400">%</span>
                </>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">cuota de menciones vs competidores</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-4.5 h-4.5 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Competidores
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1.5">{kpis.totalCompetitors}</p>
            <p className="text-xs text-slate-400 mt-1">marcas detectadas en respuestas IA</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-4.5 h-4.5 text-slate-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Amenazas altas
            </p>
            <p
              className={`text-3xl font-bold mt-1.5 ${kpis.highThreats > 0 ? "text-red-600" : "text-slate-900"}`}
            >
              {kpis.highThreats}
            </p>
            <p className="text-xs text-slate-400 mt-1">competidores con mayor SOV</p>
          </div>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${kpis.highThreats > 0 ? "bg-red-50" : "bg-slate-50"}`}
          >
            <AlertTriangle
              className={`w-4.5 h-4.5 ${kpis.highThreats > 0 ? "text-red-600" : "text-slate-400"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
