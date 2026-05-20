import { notFound } from "next/navigation";
import { detectBrands } from "@/lib/detection/detectBrands";
import { createClient } from "@/lib/supabase/server";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { AnalyzeExecutedPromptsButton } from "./AnalyzeExecutedPromptsButton";
import { CompetitorKpiCards } from "./CompetitorKpiCards";
import { CompetitorSuggestionActions } from "./CompetitorSuggestionActions";
import { CompetitorTableSortable } from "./CompetitorTableSortable";
import { DeleteCompetitorButton } from "./DeleteCompetitorButton";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string }>;
}

interface CompetitorRow {
  id: string;
  name: string;
  domain: string | null;
  aliases: string[];
}

interface MentionRow {
  prompt_run_id: string;
  brand_id: string | null;
  brand_type: "own" | "competitor" | null;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data" | null;
  created_at: string;
}

interface RunRow {
  id: string;
  prompt_id: string;
  raw_response: string | null;
  created_at: string;
}

interface CompetitorPerformanceRow {
  competitorId: string;
  name: string;
  avgPosition: number | null;
  sov: number | null;
  sentiment: "positive" | "neutral" | "negative" | "no_data";
  consistency: number;
  mentions: number;
  promptsCovered: number;
  lastSeenAt: string | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function getDominantSentiment(
  sentiments: Array<"positive" | "neutral" | "negative" | "no_data" | null>
): "positive" | "neutral" | "negative" | "no_data" {
  const tally = {
    positive: 0,
    neutral: 0,
    negative: 0,
    no_data: 0,
  };

  for (const s of sentiments) {
    if (!s) {
      tally.no_data += 1;
      continue;
    }
    tally[s] += 1;
  }

  const ordered: Array<keyof typeof tally> = ["positive", "neutral", "negative", "no_data"];
  let best: keyof typeof tally = "no_data";
  let bestScore = -1;
  for (const key of ordered) {
    if (tally[key] > bestScore) {
      best = key;
      bestScore = tally[key];
    }
  }

  return best;
}

const LLM_OPTIONS = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "perplexity", label: "Perplexity" },
  { key: "deepseek", label: "DeepSeek" },
] as const;

export default async function CompetitorsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm = "chatgpt" } = await searchParams;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: competitorsData } = await supabase
    .from("brands")
    .select("id, name, domain, aliases")
    .eq("workspace_id", workspace.id)
    .eq("type", "competitor")
    .order("name");

  const competitors = (competitorsData ?? []) as CompetitorRow[];

  const { data: ownBrandData } = await supabase
    .from("brands")
    .select("id, name, aliases")
    .eq("workspace_id", workspace.id)
    .eq("type", "own")
    .maybeSingle();

  const { data: suggestions } = await supabase
    .from("competitor_suggestions")
    .select("id, name, created_at")
    .eq("workspace_id", workspace.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id, key")
    .eq("key", llm)
    .single();

  const { data: completedRunsData } = await supabase
    .from("prompt_runs")
    .select("id, prompt_id, raw_response, created_at")
    .eq("workspace_id", workspace.id)
    .eq("llm_provider_id", provider?.id ?? "")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1000);

  const completedRuns = (completedRunsData ?? []) as RunRow[];
  const runIds = completedRuns.map((r) => r.id);
  const runIdToPromptId = new Map(completedRuns.map((r) => [r.id, r.prompt_id]));

  let mentions: MentionRow[] = [];
  if (runIds.length > 0) {
    const { data: mentionRows } = await supabase
      .from("mentions")
      .select("prompt_run_id, brand_id, brand_type, position, sentiment, created_at")
      .in("prompt_run_id", runIds);
    mentions = (mentionRows ?? []) as MentionRow[];
  }

  if (ownBrandData && completedRuns.length > 0 && competitors.length > 0) {
    const existingMentionKeys = new Set(
      mentions.map((m) => `${m.prompt_run_id}|${m.brand_type}|${m.brand_id ?? "own"}`)
    );

    for (const run of completedRuns) {
      if (!run.raw_response) continue;

      const detection = detectBrands({
        rawResponse: run.raw_response,
        ownBrand: {
          id: ownBrandData.id as string,
          name: ownBrandData.name as string,
          aliases: (ownBrandData.aliases as string[] | null) ?? [],
        },
        competitors: competitors.map((c) => ({
          id: c.id,
          name: c.name,
          aliases: c.aliases ?? [],
        })),
      });

      if (detection.ownBrandMentioned) {
        const ownKey = `${run.id}|own|${ownBrandData.id}`;
        if (!existingMentionKeys.has(ownKey)) {
          mentions.push({
            prompt_run_id: run.id,
            brand_id: ownBrandData.id as string,
            brand_type: "own",
            position: detection.ownBrandPosition,
            sentiment: detection.sentiment,
            created_at: run.created_at,
          });
          existingMentionKeys.add(ownKey);
        }
      }

      for (const comp of detection.competitors) {
        const compKey = `${run.id}|competitor|${comp.brandId}`;
        if (existingMentionKeys.has(compKey)) continue;
        mentions.push({
          prompt_run_id: run.id,
          brand_id: comp.brandId,
          brand_type: "competitor",
          position: comp.position,
          sentiment: comp.sentiment,
          created_at: run.created_at,
        });
        existingMentionKeys.add(compKey);
      }
    }
  }

  const ownMentions = mentions.filter((m) => m.brand_type === "own").length;
  const competitorMentionsAll = mentions.filter((m) => m.brand_type === "competitor").length;
  const sovPool = ownMentions + competitorMentionsAll;
  const totalRuns = completedRuns.length;

  const competitorPerformance: CompetitorPerformanceRow[] = competitors
    .map((competitor) => {
      const cMentions = mentions.filter(
        (m) => m.brand_type === "competitor" && m.brand_id === competitor.id
      );
      const positions = cMentions
        .map((m) => m.position)
        .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
      const runIdsSet = new Set(cMentions.map((m) => m.prompt_run_id));
      const promptIdsSet = new Set(
        Array.from(runIdsSet)
          .map((runId) => runIdToPromptId.get(runId))
          .filter((id): id is string => Boolean(id))
      );

      const avgPosition =
        positions.length > 0
          ? round1(positions.reduce((a, b) => a + b, 0) / positions.length)
          : null;
      const consistency = totalRuns > 0 ? round1((runIdsSet.size / totalRuns) * 100) : 0;
      const sov = sovPool > 0 ? round1((cMentions.length / sovPool) * 100) : null;
      const sentiment = getDominantSentiment(cMentions.map((m) => m.sentiment));
      const lastSeenAt =
        cMentions.length > 0
          ? (cMentions
              .map((m) => m.created_at)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null)
          : null;

      return {
        competitorId: competitor.id,
        name: competitor.name,
        avgPosition,
        sov,
        sentiment,
        consistency,
        mentions: cMentions.length,
        promptsCovered: promptIdsSet.size,
        lastSeenAt,
      };
    })
    .sort((a, b) => {
      if (a.avgPosition === null && b.avgPosition === null) return b.consistency - a.consistency;
      if (a.avgPosition === null) return 1;
      if (b.avgPosition === null) return -1;
      if (a.avgPosition !== b.avgPosition) return a.avgPosition - b.avgPosition;
      return b.consistency - a.consistency;
    });

  // KPIs de la marca propia
  const ownMentionRows = mentions.filter((m) => m.brand_type === "own");
  const ownRunsWithMention = new Set(ownMentionRows.map((m) => m.prompt_run_id)).size;
  const ownVisibility = totalRuns > 0 ? round1((ownRunsWithMention / totalRuns) * 100) : 0;
  const ownPositions = ownMentionRows
    .map((m) => m.position)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  const ownAvgPosition =
    ownPositions.length > 0
      ? round1(ownPositions.reduce((a, b) => a + b, 0) / ownPositions.length)
      : null;
  const ownSov = sovPool > 0 ? round1((ownMentions / sovPool) * 100) : null;
  const highThreats = competitorPerformance.filter((c) => (c.sov ?? 0) > (ownSov ?? 0)).length;

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Competidores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Marcas que tu IA monitoriza en las respuestas junto a la tuya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {LLM_OPTIONS.map((option) => {
            const isActive = llm === option.key;
            const href = `/${slug}/competitors?llm=${option.key}`;
            return (
              <a
                key={option.key}
                href={href}
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                {option.label}
              </a>
            );
          })}
        </div>

        <CompetitorKpiCards
          kpis={{
            visibility: ownVisibility,
            avgPosition: ownAvgPosition,
            sov: ownSov,
            totalCompetitors: competitors.length,
            highThreats,
          }}
        />

        <CompetitorTableSortable rows={competitorPerformance} totalRuns={totalRuns} llm={llm} />

        <AddCompetitorForm workspaceId={workspace.id} />

        <AnalyzeExecutedPromptsButton workspaceId={workspace.id} />

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Sugerencias detectadas por IA</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Se generan a partir de respuestas de LLM. Revisa y aprueba solo las validas.
            </p>
          </div>

          {!suggestions || suggestions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No hay sugerencias pendientes.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">
                      Detectado automaticamente en respuestas LLM
                    </p>
                  </div>
                  <CompetitorSuggestionActions
                    suggestionId={s.id}
                    workspaceId={workspace.id}
                    name={s.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {!competitors || competitors.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Aún no has añadido competidores.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {competitors.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    {c.domain && <p className="text-xs text-slate-400 mt-0.5">{c.domain}</p>}
                    {Array.isArray(c.aliases) && c.aliases.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Alias: {(c.aliases as string[]).join(", ")}
                      </p>
                    )}
                  </div>
                  <DeleteCompetitorButton
                    competitorId={c.id}
                    workspaceId={workspace.id}
                    name={c.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
