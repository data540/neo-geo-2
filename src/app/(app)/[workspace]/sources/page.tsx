import { notFound } from "next/navigation";
import { SourceRankingsTable } from "@/components/sources/SourceRankingsTable";
import { createClient } from "@/lib/supabase/server";
import type { SourceRankingRow } from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; country?: string; range?: string }>;
}

const RANGE_TO_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

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

  const { data: rows } = await supabase.rpc("get_workspace_source_rankings", {
    workspace_slug: slug,
    days,
    llm_key: llm ?? null,
    p_country_filter: country ?? null,
    limit_n: 100,
  });

  const rankingRows = (rows ?? []) as SourceRankingRow[];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Fuentes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Dominios citados por los motores de IA en las respuestas a tus prompts.
        </p>
      </div>

      {rankingRows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-sm text-slate-400">
            No hay fuentes en el período seleccionado. Las fuentes se detectan
            automáticamente al ejecutar prompts.
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
    </div>
  );
}
