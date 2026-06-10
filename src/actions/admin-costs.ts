"use server";

import { createClient } from "@/lib/supabase/server";

export interface LlmCostRow {
  llm_key: string;
  provider_name: string;
  runs: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface CostBreakdown {
  total_openrouter_usd: number;
  total_usd: number;
  by_provider: LlmCostRow[];
  serpapi_calls: number;
  serpapi_cost_usd: number;
  serpapi_cost_per_call: number;
  period_days: number;
}

export async function getCostBreakdownAction(
  workspaceId: string,
  days: number
): Promise<{ success: true; data: CostBreakdown } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    workspace_id: workspaceId,
  });
  if (!isMember) return { success: false, error: "Sin permisos" };

  const since =
    days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : new Date(0).toISOString();

  const { data: runData, error } = await supabase
    .from("prompt_runs")
    .select(
      "llm_provider_id, cost_usd, input_tokens, output_tokens, llm_providers(key, name)"
    )
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .gte("created_at", since);

  if (error) return { success: false, error: error.message };

  const byProvider = new Map<string, LlmCostRow>();
  for (const run of runData ?? []) {
    const provider = (run.llm_providers as unknown) as { key: string; name: string } | null;
    if (!provider) continue;
    const k = provider.key;
    const existing = byProvider.get(k) ?? {
      llm_key: k,
      provider_name: provider.name,
      runs: 0,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };
    existing.runs++;
    existing.input_tokens += (run.input_tokens as number | null) ?? 0;
    existing.output_tokens += (run.output_tokens as number | null) ?? 0;
    existing.cost_usd += (run.cost_usd as number | null) ?? 0;
    byProvider.set(k, existing);
  }

  const { count: serpCount } = await supabase
    .from("prompt_serp_cache")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("fetched_at", since);

  const serpCostPerCall = parseFloat(process.env.SERPAPI_COST_PER_CALL ?? "0.01");
  const serpCalls = serpCount ?? 0;
  const serpUsd = serpCalls * serpCostPerCall;

  const byProviderList = Array.from(byProvider.values()).sort(
    (a, b) => b.cost_usd - a.cost_usd
  );
  const totalOpenRouter = byProviderList.reduce((s, p) => s + p.cost_usd, 0);

  return {
    success: true,
    data: {
      total_openrouter_usd: totalOpenRouter,
      total_usd: totalOpenRouter + serpUsd,
      by_provider: byProviderList,
      serpapi_calls: serpCalls,
      serpapi_cost_usd: serpUsd,
      serpapi_cost_per_call: serpCostPerCall,
      period_days: days,
    },
  };
}
