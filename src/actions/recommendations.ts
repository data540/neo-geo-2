"use server";

import { generateRecommendations } from "@/lib/geo/generateRecommendations";
import { buildRetrievalQueries, retrieveRelevantKnowledge } from "@/lib/geo/knowledgeRetrieval";
import { getWorkspaceBrandPerformanceMetrics } from "@/lib/metrics/visibility";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, GeoRecommendation, RetrievedChunk } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function buildMetrics(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, workspaceCountry: string, brandProfilePositioning: string | null) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().slice(0, 10);

  const [
    { data: metrics },
    brandPerformanceMetrics,
    { data: promptMetrics },
    { count: sourcesCount },
    { data: promptRows },
    { data: workspace },
  ] = await Promise.all([
    supabase
      .from("daily_workspace_metrics")
      .select("avg_sov, avg_position, brand_consistency, brand_mentions_count, active_prompts_count")
      .eq("workspace_id", workspaceId)
      .gte("date", since)
      .order("date", { ascending: false }),
    getWorkspaceBrandPerformanceMetrics({ workspaceId, country: workspaceCountry, days: 7 }),
    supabase.from("daily_prompt_metrics").select("sov").eq("workspace_id", workspaceId).gte("date", since),
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("prompts").select("funnel_stage").eq("workspace_id", workspaceId).eq("status", "active"),
    supabase.from("workspaces").select("brand_name").eq("id", workspaceId).single(),
  ]);

  const rows = metrics ?? [];
  const avgConsistency = rows.length > 0
    ? Math.round((rows.reduce((a, b) => a + (b.brand_consistency ?? 0), 0) / rows.length) * 10) / 10
    : null;
  const totalMentions = rows.reduce((a, b) => a + (b.brand_mentions_count ?? 0), 0);
  const latestActivePrompts = rows[0]?.active_prompts_count ?? 0;
  const lowSovCount = (promptMetrics ?? []).filter((p) => (p.sov ?? 0) < 30).length;
  const totalPrompts = promptRows?.length ?? 0;
  const topPct = totalPrompts > 0 ? Math.round(((promptRows?.filter((p) => p.funnel_stage === "top").length ?? 0) / totalPrompts) * 100) : 0;
  const midPct = totalPrompts > 0 ? Math.round(((promptRows?.filter((p) => p.funnel_stage === "middle").length ?? 0) / totalPrompts) * 100) : 0;
  const bottomPct = totalPrompts > 0 ? Math.round(((promptRows?.filter((p) => p.funnel_stage === "bottom").length ?? 0) / totalPrompts) * 100) : 0;

  return {
    brandName: (workspace as { brand_name?: string } | null)?.brand_name ?? "",
    sector: brandProfilePositioning ?? "aerolínea",
    country: workspaceCountry,
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
}

// ── Server Actions ─────────────────────────────────────────────────────────

export type RecommendationsCacheResult = ActionResult<{
  recommendations: GeoRecommendation[];
  chunks: RetrievedChunk[];
  generatedAt: string;
  canRegenerate: boolean;
}>;

/** Lee la caché de recomendaciones para un workspace. */
export async function getRecommendationsCacheAction(
  workspaceId: string
): Promise<RecommendationsCacheResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: cache } = await supabase
    .from("workspace_recommendations_cache")
    .select("recommendations, chunks, generated_at, last_attempt_at")
    .eq("workspace_id", workspaceId)
    .single();

  if (!cache) return { success: false, error: "no_cache" };

  const lastAttemptDate = cache.last_attempt_at
    ? (cache.last_attempt_at as string).slice(0, 10)
    : null;
  const canRegenerate = lastAttemptDate !== todayUtc();

  return {
    success: true,
    data: {
      recommendations: (cache.recommendations as GeoRecommendation[]) ?? [],
      chunks: (cache.chunks as RetrievedChunk[]) ?? [],
      generatedAt: cache.generated_at as string,
      canRegenerate,
    },
  };
}

/** Regenera las recomendaciones LLM. Limitado a 1 vez por día por workspace. */
export async function generateRecommendationsAction(
  workspaceId: string
): Promise<ActionResult<GeoRecommendation[]>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, brand_name, country")
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

  // ── Rate limit: 1 regeneración por día ────────────────────────────────
  const { data: cache } = await supabase
    .from("workspace_recommendations_cache")
    .select("last_attempt_at")
    .eq("workspace_id", workspaceId)
    .single();

  if (cache?.last_attempt_at) {
    const lastDate = (cache.last_attempt_at as string).slice(0, 10);
    if (lastDate === todayUtc()) {
      return { success: false, error: "rate_limited" };
    }
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("positioning")
    .eq("workspace_id", workspaceId)
    .single();

  const metricsForRetrieval = await buildMetrics(
    supabase,
    workspaceId,
    workspace.country,
    brandProfile?.positioning ?? null
  );
  // Sobreescribir brandName con el valor correcto del workspace
  metricsForRetrieval.brandName = workspace.brand_name;

  const queries = buildRetrievalQueries(metricsForRetrieval);
  const chunks = await retrieveRelevantKnowledge(queries, 4, 10);
  const recommendations = await generateRecommendations({ workspace: metricsForRetrieval, chunks });

  // ── Guardar en caché ───────────────────────────────────────────────────
  await supabase.from("workspace_recommendations_cache").upsert(
    {
      workspace_id: workspaceId,
      recommendations,
      chunks,
      generated_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );

  return { success: true, data: recommendations };
}
