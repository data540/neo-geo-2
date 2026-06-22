"use client";

import { useCallback, useEffect, useState } from "react";
import { getCostBreakdownAction } from "@/actions/admin-costs";
import type { CostBreakdown } from "@/actions/admin-costs";

const PERIODS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
  { label: "Todo", value: 0 },
] as const;

const PROVIDER_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  chatgpt: {
    label: "ChatGPT",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
  },
  gemini: {
    label: "Gemini",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  perplexity: {
    label: "Perplexity",
    color: "text-violet-700",
    bg: "bg-violet-50 border-violet-200",
    dot: "bg-violet-500",
  },
};

function fmt(usd: number) {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-indigo-400 transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

interface Props {
  workspaceId: string;
}

export function CostBreakdownPanel({ workspaceId }: Props) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (d: number) => {
      setLoading(true);
      setError(null);
      const res = await getCostBreakdownAction(workspaceId, d);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error);
      }
      setLoading(false);
    },
    [workspaceId]
  );

  useEffect(() => {
    load(days);
  }, [days, load]);

  const geminiRow = data?.by_provider.find((p) => p.llm_key === "gemini");
  const geminiTotal = (geminiRow?.cost_usd ?? 0) + (data?.serpapi_cost_usd ?? 0);
  const maxCost = Math.max(
    ...(data?.by_provider.map((p) => (p.llm_key === "gemini" ? geminiTotal : p.cost_usd)) ?? [1]),
    0.00001
  );

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setDays(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              days === p.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
          <span className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
          Cargando costes…
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Coste total
              </p>
              <p className="text-2xl font-semibold text-slate-900">{fmt(data.total_usd)}</p>
              <p className="text-xs text-slate-400">
                OpenRouter + SerpAPI
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                OpenRouter
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {fmt(data.total_openrouter_usd)}
              </p>
              <p className="text-xs text-slate-400">
                {data.by_provider.reduce((s, p) => s + p.runs, 0)} ejecuciones
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                SerpAPI (AI Overviews)
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {fmt(data.serpapi_cost_usd)}
              </p>
              <p className="text-xs text-slate-400">
                {data.serpapi_calls} llamadas × ${data.serpapi_cost_per_call}/llamada
              </p>
            </div>
          </div>

          {/* Provider breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Desglose por proveedor</h3>
            </div>

            {data.by_provider.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">
                Sin datos en el período seleccionado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.by_provider.map((row) => {
                  const meta = PROVIDER_META[row.llm_key] ?? {
                    label: row.provider_name,
                    color: "text-slate-700",
                    bg: "bg-slate-50 border-slate-200",
                    dot: "bg-slate-400",
                  };
                  const isGemini = row.llm_key === "gemini";
                  const displayCost = isGemini ? geminiTotal : row.cost_usd;
                  const pct = maxCost > 0 ? (displayCost / maxCost) * 100 : 0;

                  return (
                    <div key={row.llm_key} className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                          <span className={`text-sm font-semibold ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {row.runs} runs · {fmtTokens(row.input_tokens + row.output_tokens)} tokens
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-slate-800">
                            {fmt(displayCost)}
                          </span>
                          {isGemini && data.serpapi_cost_usd > 0 && (
                            <span className="ml-1 text-xs text-slate-400">total</span>
                          )}
                        </div>
                      </div>
                      <Bar pct={pct} />

                      {/* OpenRouter breakdown row */}
                      <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                        <div>
                          <span className="font-medium text-slate-700">OpenRouter</span>
                          <p>{fmt(row.cost_usd)}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Tokens entrada</span>
                          <p>{fmtTokens(row.input_tokens)}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">Tokens salida</span>
                          <p>{fmtTokens(row.output_tokens)}</p>
                        </div>
                      </div>

                      {/* SerpAPI extra row for gemini */}
                      {isGemini && data.serpapi_calls > 0 && (
                        <div className={`rounded-lg border px-3 py-2 text-xs ${meta.bg}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`font-medium ${meta.color}`}>SerpAPI</span>
                              <span className="ml-2 text-slate-500">
                                {data.serpapi_calls} llamadas × ${data.serpapi_cost_per_call}
                              </span>
                            </div>
                            <span className={`font-semibold ${meta.color}`}>
                              {fmt(data.serpapi_cost_usd)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
