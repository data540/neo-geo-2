import { notFound } from "next/navigation";
import { RecommendationsPanel } from "@/components/workspace/RecommendationsPanel";
import { generateRecommendations } from "@/lib/geo/generateRecommendations";
import { buildRetrievalQueries, retrieveRelevantKnowledge } from "@/lib/geo/knowledgeRetrieval";
import { getWorkspaceBrandPerformanceMetrics } from "@/lib/metrics/visibility";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function RecommendationsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, brand_name, country")
    .eq("slug", slug)
    .single();
  if (!workspace) notFound();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) notFound();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: metrics } = await supabase
    .from("daily_workspace_metrics")
    .select("avg_sov, avg_position, brand_consistency, brand_mentions_count, active_prompts_count")
    .eq("workspace_id", workspace.id)
    .gte("date", since)
    .order("date", { ascending: false });

  const rows = metrics ?? [];
  const avgConsistency =
    rows.length > 0
      ? Math.round((rows.reduce((a, b) => a + (b.brand_consistency ?? 0), 0) / rows.length) * 10) /
        10
      : null;
  const totalMentions = rows.reduce((a, b) => a + (b.brand_mentions_count ?? 0), 0);
  const latestActivePrompts = rows[0]?.active_prompts_count ?? 0;
  const brandPerformanceMetrics = await getWorkspaceBrandPerformanceMetrics({
    workspaceId: workspace.id,
    country: workspace.country,
    days: 7,
  });

  const { data: promptMetrics } = await supabase
    .from("daily_prompt_metrics")
    .select("sov")
    .eq("workspace_id", workspace.id)
    .gte("date", since);
  const lowSovCount = (promptMetrics ?? []).filter((p) => (p.sov ?? 0) < 30).length;

  const { count: sourcesCount } = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("positioning")
    .eq("workspace_id", workspace.id)
    .single();

  const { data: promptRows } = await supabase
    .from("prompts")
    .select("funnel_stage")
    .eq("workspace_id", workspace.id)
    .eq("status", "active");

  const totalPrompts = promptRows?.length ?? 0;
  const topPct =
    totalPrompts > 0
      ? Math.round(
          ((promptRows?.filter((p) => p.funnel_stage === "top").length ?? 0) / totalPrompts) * 100
        )
      : 0;
  const midPct =
    totalPrompts > 0
      ? Math.round(
          ((promptRows?.filter((p) => p.funnel_stage === "middle").length ?? 0) / totalPrompts) *
            100
        )
      : 0;
  const bottomPct =
    totalPrompts > 0
      ? Math.round(
          ((promptRows?.filter((p) => p.funnel_stage === "bottom").length ?? 0) / totalPrompts) *
            100
        )
      : 0;

  const metricsForRetrieval = {
    brandName: workspace.brand_name,
    sector: brandProfile?.positioning ?? "aerolínea",
    country: workspace.country,
    visibilityPct: brandPerformanceMetrics.current.visibilityPct,
    avgPosition: brandPerformanceMetrics.current.avgPosition,
    consistencyPct: avgConsistency,
    brandMentionsCount: totalMentions,
    activePromptsCount: latestActivePrompts,
    topFunnelPct: topPct,
    midFunnelPct: midPct,
    bottomFunnelPct: bottomPct,
    lowSovPromptsCount: lowSovCount,
    sourcesCount: sourcesCount ?? 0,
  };

  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY?.trim();

  const queries = buildRetrievalQueries(metricsForRetrieval);
  const chunks = hasOpenRouterKey ? await retrieveRelevantKnowledge(queries, 4, 10) : [];

  const initialRecommendations = hasOpenRouterKey
    ? await generateRecommendations({ workspace: metricsForRetrieval, chunks })
    : [];

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recomendaciones GEO</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acciones para mejorar la visibilidad de{" "}
            <span className="font-medium text-slate-700">{workspace.brand_name}</span> en motores de
            búsqueda de IA.
          </p>
        </div>

        <RecommendationsPanel
          workspaceId={workspace.id}
          initialRecommendations={initialRecommendations}
          retrievedChunks={chunks}
          hasApiKey={hasOpenRouterKey}
        />
      </div>
    </div>
  );
}
