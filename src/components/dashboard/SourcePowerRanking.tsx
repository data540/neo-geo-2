import { Globe } from "lucide-react";
import type { SourceRankingEntry } from "@/types";

interface Props {
  data: SourceRankingEntry[];
}

function rootDomain(domain: string): string {
  return (
    domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] ?? domain
  );
}

export function SourcePowerRanking({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Source Power Ranking</h3>
          <p className="text-xs text-slate-500 mt-0.5">Dominios citados como fuente</p>
        </div>
        <p className="text-center text-xs text-slate-400 py-12">
          Sin fuentes citadas todavía. Los LLMs con búsqueda web (Perplexity, AI Overview) reportan
          dominios.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.citationsCount));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Source Power Ranking</h3>
          <p className="text-xs text-slate-500 mt-0.5">Dominios citados como fuente</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wide">
          Últimos 30D
        </span>
      </div>

      <div className="space-y-3">
        {data.map((s, idx) => {
          const cleanDomain = rootDomain(s.domain);
          return (
            <div key={s.domain} className="flex items-center gap-3">
              <span className="w-5 text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                {idx + 1}.
              </span>
              <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-slate-500" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-slate-800 truncate font-mono">{cleanDomain}</p>
                  <span className="text-sm font-semibold tabular-nums text-slate-900 shrink-0">
                    {s.citationsCount}
                  </span>
                </div>
                <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, (s.citationsCount / max) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
