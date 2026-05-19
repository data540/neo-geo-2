import type { createClient as createSupabaseClient } from "@supabase/supabase-js";

// biome-ignore lint/suspicious/noExplicitAny: service client type varies across callers
type ServiceClient = ReturnType<typeof createSupabaseClient<any, any, any>>;

export async function upsertDailyWorkspaceMetrics(params: {
  supabase: ServiceClient;
  workspaceId: string;
  llmProviderId: string;
  date: string;
}) {
  const { supabase, workspaceId, llmProviderId, date } = params;

  const { data: metrics } = await supabase
    .from("daily_prompt_metrics")
    .select("brand_mentioned, brand_position, sov, consistency_score")
    .eq("workspace_id", workspaceId)
    .eq("llm_provider_id", llmProviderId)
    .eq("date", date);

  type Row = {
    brand_mentioned: boolean | null;
    brand_position: number | null;
    sov: number | null;
    consistency_score: number | null;
  };

  const rows: Row[] = metrics ?? [];
  if (rows.length === 0) return;

  const activePrompts = rows.length;
  const brandMentions = rows.filter((m) => m.brand_mentioned).length;
  const positions = rows
    .filter((m) => m.brand_mentioned && m.brand_position !== null)
    .map((m) => m.brand_position as number);
  const avgPosition = positions.length
    ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
    : null;
  const consistencyHigh = rows.filter((m) => (m.consistency_score ?? 0) >= 70).length;
  const brandConsistency = Math.round((consistencyHigh / activePrompts) * 1000) / 10;
  const sovValues = rows.filter((m) => m.sov !== null).map((m) => m.sov as number);
  const avgSov = sovValues.length
    ? Math.round((sovValues.reduce((a, b) => a + b, 0) / sovValues.length) * 10) / 10
    : null;

  await supabase.from("daily_workspace_metrics").upsert(
    {
      workspace_id: workspaceId,
      llm_provider_id: llmProviderId,
      date,
      active_prompts_count: activePrompts,
      brand_mentions_count: brandMentions,
      avg_position: avgPosition,
      brand_consistency: brandConsistency,
      avg_sov: avgSov,
    },
    { onConflict: "workspace_id,llm_provider_id,date" }
  );
}
