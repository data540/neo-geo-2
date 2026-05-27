"use server";

import { generateRecommendations } from "@/lib/geo/generateRecommendations";
import { buildRetrievalQueries, retrieveRelevantKnowledge } from "@/lib/geo/knowledgeRetrieval";
import { getWorkspaceVisibilityMetrics } from "@/lib/metrics/visibility";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, GeoRecommendation } from "@/types";

export async function generateRecommendationsAction(
  workspaceId: string
): Promise<ActionResult<GeoRecommendation[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, brand_name, country")
    .eq("id", workspaceId)
    .single();
  if (!workspace) return { success: false, error: "Workspace not found" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return { success: false, error: "Not a member" };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: metrics } = await supabase
    .from("daily_workspace_metrics")
    .select("avg_sov, avg_position, brand_consistency, brand_mentions_count, active_prompts_count")
    .eq("workspace_id", workspaceId)
    .gte("date", since)
    .order("date", { ascending: false });

  const rows = metrics ?? [];
  const avgPosition =
    rows.length > 0
      ? Math.round((rows.reduce((a, b) => a + (b.avg_position ?? 0), 0) / rows.length) * 10) / 10
      : null;
  const avgConsistency =
    rows.length > 0
      ? Math.round((rows.reduce((a, b) => a + (b.brand_consistency ?? 0), 0) / rows.length) * 10) /
        10
      : null;
  const totalMentions = rows.reduce((a, b) => a + (b.brand_mentions_count ?? 0), 0);
  const latestActivePrompts = rows[0]?.active_prompts_count ?? 0;
  const visibilityMetrics = await getWorkspaceVisibilityMetrics({
    workspaceId,
    country: workspace.country,
    days: 7,
  });

  const { data: promptMetrics } = await supabase
    .from("daily_prompt_metrics")
    .select("sov")
    .eq("workspace_id", workspaceId)
    .gte("date", since);

  const lowSovCount = (promptMetrics ?? []).filter((p) => (p.sov ?? 0) < 30).length;

  const { count: sourcesCount } = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("positioning")
    .eq("workspace_id", workspaceId)
    .single();

  const { data: promptRows } = await supabase
    .from("prompts")
    .select("funnel_stage")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  const totalPrompts = promptRows?.length ?? 0;
  const topCount = promptRows?.filter((p) => p.funnel_stage === "top").length ?? 0;
  const midCount = promptRows?.filter((p) => p.funnel_stage === "middle").length ?? 0;
  const bottomCount = promptRows?.filter((p) => p.funnel_stage === "bottom").length ?? 0;

  const topPct = totalPrompts > 0 ? Math.round((topCount / totalPrompts) * 100) : 0;
  const midPct = totalPrompts > 0 ? Math.round((midCount / totalPrompts) * 100) : 0;
  const bottomPct = totalPrompts > 0 ? Math.round((bottomCount / totalPrompts) * 100) : 0;

  const metricsForRetrieval = {
    brandName: workspace.brand_name,
    sector: brandProfile?.positioning ?? "aerolínea",
    country: workspace.country,
    visibilityPct: visibilityMetrics.current.visibilityPct,
    avgPosition,
    consistencyPct: avgConsistency,
    brandMentionsCount: totalMentions,
    activePromptsCount: latestActivePrompts,
    topFunnelPct: topPct,
    midFunnelPct: midPct,
    bottomFunnelPct: bottomPct,
    lowSovPromptsCount: lowSovCount,
    sourcesCount: sourcesCount ?? 0,
  };

  const queries = buildRetrievalQueries(metricsForRetrieval);
  const chunks = await retrieveRelevantKnowledge(queries, 4, 10);

  const recommendations = await generateRecommendations({
    workspace: metricsForRetrieval,
    chunks,
  });

  return { success: true, data: recommendations };
}
