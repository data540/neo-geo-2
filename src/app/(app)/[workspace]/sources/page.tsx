import { notFound } from "next/navigation";
import { SourceCitationsTable } from "@/components/sources/SourceCitationsTable";
import { SourceKpiCards } from "@/components/sources/SourceKpiCards";
import { SourceRankingsTable } from "@/components/sources/SourceRankingsTable";
import { getPeriodWindow, getWorkspaceTimeZone } from "@/lib/metrics/visibility";
import { getSourceType } from "@/lib/sources/classify";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceCountryFilter } from "@/lib/workspace-country";
import type {
  LlmProviderKey,
  RunStatus,
  SourceCitationRow,
  SourceKpis,
  SourceRankingRow,
  WorkspaceMemberRole,
} from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; country?: string; range?: string }>;
}

const RANGE_TO_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

interface RawSourceRow {
  id: string;
  url: string | null;
  domain: string | null;
  title: string | null;
  cited_by_llm: boolean;
  created_at: string;
  prompt_run_id: string;
  prompt_runs:
    | {
        id: string;
        status: RunStatus;
        created_at: string;
        llm_providers:
          | { key: LlmProviderKey; name: string }
          | Array<{ key: LlmProviderKey; name: string }>
          | null;
        prompts:
          | { id: string; text: string; country: string }
          | Array<{ id: string; text: string; country: string }>
          | null;
      }
    | Array<{
        id: string;
        status: RunStatus;
        created_at: string;
        llm_providers:
          | { key: LlmProviderKey; name: string }
          | Array<{ key: LlmProviderKey; name: string }>
          | null;
        prompts:
          | { id: string; text: string; country: string }
          | Array<{ id: string; text: string; country: string }>
          | null;
      }>
    | null;
}

const CITATION_TABLE_LIMIT = 1000;

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SourcesPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm, country, range } = await searchParams;
  const days = RANGE_TO_DAYS[range ?? "30d"] ?? 30;

  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .single()
    : { data: null };
  const countryFilter = resolveWorkspaceCountryFilter({
    workspaceSlug: slug,
    requestedCountry: country,
    userRole: (membership?.role as WorkspaceMemberRole | undefined) ?? null,
  });

  const [{ data: rawRows }, { data: rawKpis }] = await Promise.all([
    supabase.rpc("get_workspace_source_rankings", {
      workspace_slug: slug,
      days,
      llm_key: llm ?? null,
      p_country_filter: countryFilter,
      limit_n: 100,
    }),
    supabase.rpc("get_workspace_source_kpis", {
      workspace_slug: slug,
      days,
      llm_key: llm ?? null,
      p_country_filter: countryFilter,
    }),
  ]);

  const rankingRows: SourceRankingRow[] = (rawRows ?? []).map(
    (row: {
      domain: string;
      citations_count: number;
      urls_total: number;
      pct_of_runs: number;
      example_prompt_text: string | null;
      extra_prompt_count: number;
    }) => ({
      domain: row.domain,
      citationsCount: row.citations_count,
      urlsTotal: row.urls_total,
      pctOfRuns: row.pct_of_runs,
      examplePromptText: row.example_prompt_text,
      extraPromptCount: row.extra_prompt_count,
    })
  );

  // Tabla de citas: las más recientes DENTRO del periodo (misma ventana de días
  // naturales que el ranking y las RPCs). Los contadores salen de la RPC.
  const { now: periodEnd, currentStart: periodStart } = getPeriodWindow(
    days,
    new Date(),
    getWorkspaceTimeZone(countryFilter)
  );
  let citationsQuery = supabase
    .from("sources")
    .select(
      "id, url, domain, title, cited_by_llm, created_at, prompt_run_id, prompt_runs!inner(id, status, created_at, completed_at, llm_providers!inner(key, name), prompts!inner(id, text, country))"
    )
    .eq("workspace_id", workspace.id)
    .eq("cited_by_llm", true)
    .eq("prompt_runs.status", "completed")
    .gte("prompt_runs.completed_at", periodStart.toISOString())
    .lt("prompt_runs.completed_at", periodEnd.toISOString())
    .order("created_at", { ascending: false })
    .range(0, CITATION_TABLE_LIMIT - 1);
  if (llm) citationsQuery = citationsQuery.eq("prompt_runs.llm_providers.key", llm);
  if (countryFilter) citationsQuery = citationsQuery.eq("prompt_runs.prompts.country", countryFilter);
  const { data: rawSourceRows } = await citationsQuery;

  const sourceRows = ((rawSourceRows ?? []) as unknown as RawSourceRow[])
    .map((row) => {
      const run = firstOrNull(row.prompt_runs);
      const provider = firstOrNull(run?.llm_providers);
      const prompt = firstOrNull(run?.prompts);
      return { row, run, provider, prompt };
    })
    .filter(({ provider }) => !llm || provider?.key === llm)
    .filter(({ prompt }) => !countryFilter || prompt?.country === countryFilter);

  const citationRows: SourceCitationRow[] = sourceRows.map(({ row, run, provider, prompt }) => ({
    id: row.id,
    domain: row.domain,
    url: row.url,
    title: row.title,
    citedByLlm: row.cited_by_llm,
    sourceCreatedAt: row.created_at,
    runCreatedAt: run?.created_at ?? null,
    runStatus: run?.status ?? null,
    llmKey: provider?.key ?? null,
    llmName: provider?.name ?? null,
    promptText: prompt?.text ?? null,
    promptCountry: prompt?.country ?? null,
  }));

  const kpisRaw = rawKpis as {
    brand_citing_urls?: number;
    most_influential_domain?: string | null;
    most_influential_count?: number;
    citations_count?: number;
    domains_count?: number;
    urls_count?: number;
    prompts_count?: number;
    llms_count?: number;
  } | null;

  const sourceTypeCount = new Set(rankingRows.map((r) => getSourceType(r.domain))).size;

  const sourceKpis: SourceKpis = {
    brandCitingUrls: kpisRaw?.brand_citing_urls ?? 0,
    mostInfluentialDomain: kpisRaw?.most_influential_domain ?? null,
    mostInfluentialCount: kpisRaw?.most_influential_count ?? 0,
    sourceTypeCount,
  };

  // Contadores del periodo completo (RPC), no de las filas cargadas en la tabla.
  const domainsCount =
    kpisRaw?.domains_count ?? new Set(citationRows.map((row) => row.domain).filter(Boolean)).size;
  const citationsCount = kpisRaw?.citations_count ?? citationRows.length;
  const urlsCount =
    kpisRaw?.urls_count ?? new Set(citationRows.map((row) => row.url).filter(Boolean)).size;
  const promptsCount =
    kpisRaw?.prompts_count ??
    new Set(citationRows.map((row) => row.promptText).filter(Boolean)).size;
  const llmsCount =
    kpisRaw?.llms_count ?? new Set(citationRows.map((row) => row.llmKey).filter(Boolean)).size;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="p-6 pb-12 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fuentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dominios citados por los motores de IA en las respuestas a tus prompts.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Dominios únicos"
            value={domainsCount}
            hint="Agrupados en el ranking"
          />
          <SummaryCard
            label="Citas guardadas"
            value={citationsCount}
            hint={
              citationsCount > citationRows.length
                ? `La tabla muestra las ${citationRows.length.toLocaleString("es-ES")} más recientes`
                : "Filas reales en sources"
            }
          />
          <SummaryCard
            label="URLs únicas"
            value={urlsCount}
            hint="Sin repetir la misma URL"
          />
          <SummaryCard
            label="Prompts con fuente"
            value={promptsCount}
            hint={`${llmsCount} motor(es) IA`}
          />
        </div>

        <SourceKpiCards kpis={sourceKpis} />

        {rankingRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <p className="text-sm text-slate-400">
              No hay fuentes en el período seleccionado. Las fuentes se detectan automáticamente al
              ejecutar prompts.
            </p>
          </div>
        ) : (
          <SourceRankingsTable
            rows={rankingRows}
            workspaceSlug={slug}
            workspaceId={workspace.id}
            days={days}
            llmKey={llm ?? null}
            country={countryFilter}
          />
        )}

        <SourceCitationsTable rows={citationRows} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  );
}
