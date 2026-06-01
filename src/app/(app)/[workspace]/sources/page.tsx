import { notFound } from "next/navigation";
import { SourceCitationsTable } from "@/components/sources/SourceCitationsTable";
import { SourceRankingsTable } from "@/components/sources/SourceRankingsTable";
import { createClient } from "@/lib/supabase/server";
import type { LlmProviderKey, RunStatus, SourceCitationRow, SourceRankingRow } from "@/types";

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

function isWithinDays(dateValue: string | null | undefined, days: number): boolean {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return false;
  return time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

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

  const { data: rawRows } = await supabase.rpc("get_workspace_source_rankings", {
    workspace_slug: slug,
    days,
    llm_key: llm ?? null,
    p_country_filter: country ?? null,
    limit_n: 100,
  });

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

  const { data: rawSourceRows } = await supabase
    .from("sources")
    .select(
      "id, url, domain, title, cited_by_llm, created_at, prompt_run_id, prompt_runs(id, status, created_at, llm_providers(key, name), prompts(id, text, country))"
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .range(0, 999);

  const sourceRows = ((rawSourceRows ?? []) as unknown as RawSourceRow[])
    .map((row) => {
      const run = firstOrNull(row.prompt_runs);
      const provider = firstOrNull(run?.llm_providers);
      const prompt = firstOrNull(run?.prompts);
      return { row, run, provider, prompt };
    })
    .filter(({ row, run }) => isWithinDays(run?.created_at ?? row.created_at, days))
    .filter(({ provider }) => !llm || provider?.key === llm)
    .filter(({ prompt }) => !country || prompt?.country === country);

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

  const domainsCount = new Set(citationRows.map((row) => row.domain).filter(Boolean)).size;
  const urlsCount = new Set(citationRows.map((row) => row.url).filter(Boolean)).size;
  const promptsCount = new Set(citationRows.map((row) => row.promptText).filter(Boolean)).size;
  const llmsCount = new Set(citationRows.map((row) => row.llmKey).filter(Boolean)).size;

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
            value={citationRows.length}
            hint="Filas reales en sources"
          />
          <SummaryCard
            label="URLs únicas"
            value={urlsCount}
            hint="Incluye URLs repetidas por runs"
          />
          <SummaryCard
            label="Prompts con fuente"
            value={promptsCount}
            hint={`${llmsCount} motor(es) IA`}
          />
        </div>

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
            country={country ?? null}
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
