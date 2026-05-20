import { TrendingUp } from "lucide-react";
import { CompetitorRankChart, type RankPoint } from "./CompetitorRankChart";
import { type CompetitorDynamic, MarketDynamicsCards } from "./MarketDynamicsCards";

interface Props {
  chartData: RankPoint[];
  brandNames: string[];
  ownBrandName: string;
  dynamics: CompetitorDynamic[];
  periodDays: number;
}

export function CompetitorTrendsPanel({
  chartData,
  brandNames,
  ownBrandName,
  dynamics,
  periodDays,
}: Props) {
  const hasChart = chartData.length > 0 && brandNames.length > 0;
  const hasDynamics = dynamics.length > 0;

  if (!hasChart && !hasDynamics) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Tendencias de competidores</h2>
      </div>

      <div className="p-5 space-y-6">
        {hasChart && (
          <CompetitorRankChart
            data={chartData}
            brandNames={brandNames}
            ownBrandName={ownBrandName}
          />
        )}

        {hasDynamics && <MarketDynamicsCards competitors={dynamics} periodDays={periodDays} />}
      </div>
    </div>
  );
}
