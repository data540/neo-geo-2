import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GeoSeoCrossTable } from "@/components/analytics/GeoSeoCrossTable";
import { GscQueriesTable } from "@/components/analytics/GscQueriesTable";
import { LlmCpaTable } from "@/components/analytics/LlmCpaTable";
import { Sparkline } from "@/components/dashboard/kpi-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type {
  GeoSeoCrossRow,
  GscQueryRow,
  LlmCpaRow,
  LlmProviderKey,
} from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ range?: string }>;
}

const LLM_NAMES: Record<LlmProviderKey, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { range = "30" } = await searchParams;
  const days = Math.min(Math.max(Number.parseInt(range, 10) || 30, 1), 90);
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, gsc_site_url, ga4_property_id")
    .eq("slug", slug)
    .single();
  if (!workspace) notFound();

  const notConfigured = !workspace.gsc_site_url && !workspace.ga4_property_id;

  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - days);
  const periodStartDate = periodStart.toISOString().slice(0, 10);
  const periodStartIso = periodStart.toISOString();

  // ── Fetch en paralelo ──────────────────────────────────────────────────────
  const [gscRes, ga4Res, promptsRes, runsRes, providersRes] = await Promise.all([
    supabase
      .from("workspace_gsc_cache")
      .select("data_date, query, clicks, impressions, ctr, position")
      .eq("workspace_id", workspace.id)
      .gte("data_date", periodStartDate),
    supabase
      .from("workspace_ga4_llm_cache")
      .select("llm_key, conversions, sessions")
      .eq("workspace_id", workspace.id)
      .gte("data_date", periodStartDate),
    supabase.from("prompts").select("text").eq("workspace_id", workspace.id).eq("status", "active"),
    supabase
      .from("prompt_runs")
      .select("llm_provider_id, cost_usd")
      .eq("workspace_id", workspace.id)
      .eq("status", "completed")
      .gte("created_at", periodStartIso),
    supabase.from("llm_providers").select("id, key, name"),
  ]);

  type GscRow = {
    data_date: string;
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  const gscRaw = (gscRes.data ?? []) as GscRow[];

  // ── KPIs + serie diaria de GSC ──────────────────────────────────────────────
  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPositionSum = 0;
  const byDate = new Map<string, { clicks: number; impressions: number }>();
  const byQuery = new Map<string, GscQueryRow>();

  for (const r of gscRaw) {
    totalClicks += r.clicks;
    totalImpressions += r.impressions;
    weightedPositionSum += (r.position ?? 0) * r.impressions;

    const d = byDate.get(r.data_date) ?? { clicks: 0, impressions: 0 };
    d.clicks += r.clicks;
    d.impressions += r.impressions;
    byDate.set(r.data_date, d);

    // Agregar por query (ponderando posición por impresiones)
    const q = byQuery.get(r.query);
    if (q) {
      q.clicks += r.clicks;
      q.impressions += r.impressions;
      q.position += (r.position ?? 0) * r.impressions; // acumulado ponderado temporal
    } else {
      byQuery.set(r.query, {
        query: r.query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: 0,
        position: (r.position ?? 0) * r.impressions,
      });
    }
  }

  const avgPosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  const gscQueries: GscQueryRow[] = Array.from(byQuery.values()).map((q) => ({
    query: q.query,
    clicks: q.clicks,
    impressions: q.impressions,
    ctr: q.impressions > 0 ? q.clicks / q.impressions : 0,
    position: q.impressions > 0 ? q.position / q.impressions : 0,
  }));

  const sortedDates = Array.from(byDate.keys()).sort();
  const clicksSeries = sortedDates.map((d) => byDate.get(d)?.clicks ?? 0);
  const impressionsSeries = sortedDates.map((d) => byDate.get(d)?.impressions ?? 0);

  // ── Cruce GEO ↔ SEO ─────────────────────────────────────────────────────────
  const activePrompts = (promptsRes.data ?? []) as Array<{ text: string }>;
  const normalizedQueries = gscQueries.map((q) => ({ q, norm: normalize(q.query) }));

  const crossRows: GeoSeoCrossRow[] = activePrompts.map((p) => {
    const pn = normalize(p.text);
    // Mejor query que haga match por substring en cualquier dirección, por clics
    const matches = normalizedQueries
      .filter(({ norm }) => norm.includes(pn) || pn.includes(norm))
      .map(({ q }) => q)
      .sort((a, b) => b.clicks - a.clicks);
    const best = matches[0];
    return best
      ? {
          promptText: p.text,
          matchedQuery: best.query,
          clicks: best.clicks,
          impressions: best.impressions,
          position: best.position,
          status: "tracked" as const,
        }
      : {
          promptText: p.text,
          matchedQuery: null,
          clicks: 0,
          impressions: 0,
          position: null,
          status: "opportunity" as const,
        };
  });

  // ── CPA por LLM ─────────────────────────────────────────────────────────────
  const providers = (providersRes.data ?? []) as Array<{
    id: string;
    key: LlmProviderKey;
    name: string;
  }>;
  const providerKeyById = new Map(providers.map((p) => [p.id, p.key]));

  // Coste GEO por proveedor
  const costByLlm = new Map<LlmProviderKey, number>();
  for (const r of (runsRes.data ?? []) as Array<{ llm_provider_id: string; cost_usd: number | null }>) {
    const key = providerKeyById.get(r.llm_provider_id);
    if (!key) continue;
    costByLlm.set(key, (costByLlm.get(key) ?? 0) + (r.cost_usd ?? 0));
  }

  // Conversiones GA4 por LLM
  const ga4ByLlm = new Map<LlmProviderKey, { conversions: number; sessions: number }>();
  for (const r of (ga4Res.data ?? []) as Array<{
    llm_key: LlmProviderKey;
    conversions: number;
    sessions: number;
  }>) {
    const acc = ga4ByLlm.get(r.llm_key) ?? { conversions: 0, sessions: 0 };
    acc.conversions += Number(r.conversions);
    acc.sessions += Number(r.sessions);
    ga4ByLlm.set(r.llm_key, acc);
  }

  const llmKeys: LlmProviderKey[] = ["chatgpt", "gemini", "perplexity"];
  const cpaRows: LlmCpaRow[] = llmKeys.map((key) => {
    const ga4 = ga4ByLlm.get(key) ?? { conversions: 0, sessions: 0 };
    const geoCost = costByLlm.get(key) ?? 0;
    return {
      llmKey: key,
      llmName: LLM_NAMES[key],
      conversions: ga4.conversions,
      sessions: ga4.sessions,
      geoCostUsd: geoCost,
      cpaUsd: ga4.conversions > 0 ? geoCost / ga4.conversions : null,
      conversionRatePct: ga4.sessions > 0 ? (ga4.conversions / ga4.sessions) * 100 : null,
    };
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="p-6 pb-12 space-y-6 max-w-screen-xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Search Console y GA4: búsquedas reales, cruce con tus prompts GEO y CPA por LLM.
            </p>
          </div>
          <div className="flex gap-1.5">
            {[7, 30, 90].map((value) => (
              <Link
                key={value}
                href={`/${slug}/analytics?range=${value}`}
                className={[
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  days === value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                {value}D
              </Link>
            ))}
          </div>
        </div>

        {notConfigured ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-800">Sin conexión con Google</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Configura el Site URL de Search Console y el Property ID de GA4 en Settings para ver
              tus métricas de búsqueda y conversión.
            </p>
            <Link
              href={`/${slug}/settings`}
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Ir a Settings
            </Link>
          </div>
        ) : (
          <>
            {/* KPI cards GSC */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Impresiones" value={totalImpressions.toLocaleString()}>
                <Sparkline values={impressionsSeries} strokeColor="#6366f1" fillColor="#6366f1" />
              </KpiCard>
              <KpiCard label="Clics" value={totalClicks.toLocaleString()}>
                <Sparkline values={clicksSeries} strokeColor="#22c55e" fillColor="#22c55e" />
              </KpiCard>
              <KpiCard label="CTR medio" value={`${(avgCtr * 100).toFixed(1)}%`} />
              <KpiCard
                label="Posición media"
                value={avgPosition > 0 ? avgPosition.toFixed(1) : "—"}
              />
            </div>

            <LlmCpaTable rows={cpaRows} />
            <GscQueriesTable rows={gscQueries} />
            <GeoSeoCrossTable rows={crossRows} />
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}
