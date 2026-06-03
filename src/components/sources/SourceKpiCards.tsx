import { Layers, Link2, TrendingUp } from "lucide-react";
import type { SourceKpis } from "@/types";

interface Props {
  kpis: SourceKpis;
}

export function SourceKpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Brand-Citing URLs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Brand-Citing URLs
          </p>
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">
          {kpis.brandCitingUrls.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-1">Individual URLs that cite your brand</p>
      </div>

      {/* Source Types */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Source Types
          </p>
          <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-violet-500" aria-hidden="true" />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">
          {kpis.sourceTypeCount}
        </p>
        <p className="text-xs text-slate-400 mt-1">Different source categories</p>
      </div>

      {/* Most Influential Source */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Most Influential Source
          </p>
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          </div>
        </div>
        {kpis.mostInfluentialDomain ? (
          <>
            <p className="text-xl font-bold text-slate-900 truncate">
              {kpis.mostInfluentialDomain}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {kpis.mostInfluentialCount} citations found
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-2 italic">Analysis in progress</p>
        )}
      </div>
    </div>
  );
}
