import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { AnalyzeExecutedPromptsButton } from "./AnalyzeExecutedPromptsButton";
import { CompetitorSuggestionActions } from "./CompetitorSuggestionActions";
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function sentimentClass(sentiment: "positive" | "neutral" | "negative" | "no_data"): string {
  const map = {
    positive: "bg-green-50 text-green-700 border-green-200",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
    negative: "bg-red-50 text-red-700 border-red-200",
    no_data: "bg-slate-50 text-slate-400 border-slate-200",
  };
  return map[sentiment];
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
    .select("id, prompt_id")
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
        positions.length > 0 ? round1(positions.reduce((a, b) => a + b, 0) / positions.length) : null;
      const consistency = totalRuns > 0 ? round1((runIdsSet.size / totalRuns) * 100) : 0;
      const sov = sovPool > 0 ? round1((cMentions.length / sovPool) * 100) : null;
      const sentiment = getDominantSentiment(cMentions.map((m) => m.sentiment));
      const lastSeenAt =
        cMentions.length > 0
          ? cMentions
              .map((m) => m.created_at)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
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

      <AddCompetitorForm workspaceId={workspace.id} />

      <AnalyzeExecutedPromptsButton workspaceId={workspace.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-800">Rendimiento de competidores</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas para <span className="font-medium">{llm}</span> sobre runs completados (
            {totalRuns}) y ordenadas de mejor a peor posición media.
          </p>
        </div>

        {competitorPerformance.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay competidores para analizar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Competidor</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Posición media</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">SOV</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Sentiment</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Consistencia</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Menciones</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Prompts</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Última mención</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competitorPerformance.map((row) => (
                  <tr key={row.competitorId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{row.name}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.avgPosition !== null ? row.avgPosition.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.sov !== null ? `${row.sov.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sentimentClass(row.sentiment)}`}
                      >
                        {row.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.consistency.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.mentions}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.promptsCovered}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(row.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
