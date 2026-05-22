import { notFound } from "next/navigation";
import { PromptKpiCards } from "@/components/prompts/PromptKpiCards";
import { PromptPerformanceCard } from "@/components/prompts/PromptPerformanceCard";
import { PromptsPageHeader } from "@/components/prompts/PromptsPageHeader";
import { createClient } from "@/lib/supabase/server";
import type { PromptPerformanceRow, RunStatus, WorkspaceKpis } from "@/types";

interface EnabledLlm {
  key: string;
  name: string;
}

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ focusLlm?: string; country?: string }>;
}

export default async function PromptsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { focusLlm, country } = await searchParams;

  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, country")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  // LLMs habilitados del workspace
  const { data: llmConfigs } = await supabase
    .from("workspace_llm_config")
    .select("llm_provider_id, llm_providers!inner(key, name)")
    .eq("workspace_id", workspace.id)
    .eq("enabled", true);

  const enabledLlms: EnabledLlm[] = (llmConfigs ?? []).map((c) => {
    const provider = c.llm_providers as unknown as { key: string; name: string };
    return { key: provider.key, name: provider.name };
  });

  const usagePct = enabledLlms.length > 0 ? Math.round(100 / enabledLlms.length) : 100;

  // Métricas cross-LLM (sin filtro de LLM, o filtradas por focusLlm si se especifica)
  const { data: rows } = await supabase.rpc("get_workspace_prompt_performance", {
    p_workspace_slug: slug,
    p_llm_key: focusLlm ?? null,
    p_country_filter: country ?? null,
  });

  // KPIs (cross-LLM o filtrados)
  const { data: kpis } = await supabase.rpc("get_workspace_kpis", {
    p_workspace_slug: slug,
    p_llm_key: focusLlm ?? "chatgpt",
  });

  // Tags disponibles
  const { data: allTags } = await supabase
    .from("prompt_tags")
    .select("id, name, color")
    .eq("workspace_id", workspace.id)
    .order("name");

  const promptRows = (rows ?? []) as PromptPerformanceRow[];
  const promptIds = promptRows.map((r) => r.prompt_id);

  const promptTags: Record<string, { id: string; name: string; color: string }[]> = {};
  // latestStatusByPrompt: status del último run por prompt (cross-LLM o por focusLlm)
  const latestStatusByPrompt: Record<string, RunStatus> = {};

  if (promptIds.length > 0) {
    const { data: assignments } = await supabase
      .from("prompt_tag_assignments")
      .select("prompt_id, tag_id, prompt_tags!inner(id, name, color)")
      .in("prompt_id", promptIds);

    if (assignments) {
      for (const a of assignments) {
        if (!promptTags[a.prompt_id]) promptTags[a.prompt_id] = [];
        const tag = a.prompt_tags as unknown as { id: string; name: string; color: string };
        promptTags[a.prompt_id]?.push(tag);
      }
    }

    // Último run por prompt (cross-LLM o filtrado por focusLlm)
    let runsQuery = supabase
      .from("prompt_runs")
      .select("prompt_id, status, llm_provider_id, created_at")
      .in("prompt_id", promptIds)
      .order("created_at", { ascending: false });

    if (focusLlm) {
      const { data: focusProvider } = await supabase
        .from("llm_providers")
        .select("id")
        .eq("key", focusLlm)
        .single();
      if (focusProvider) {
        runsQuery = runsQuery.eq("llm_provider_id", focusProvider.id);
      }
    }

    const { data: latestRuns } = await runsQuery;
    for (const r of latestRuns ?? []) {
      if (!latestStatusByPrompt[r.prompt_id as string]) {
        latestStatusByPrompt[r.prompt_id as string] = r.status as RunStatus;
      }
    }
  }

  const defaultKpis: WorkspaceKpis = {
    activePromptsCount: 0,
    brandMentionsCount: 0,
    avgPosition: null,
    brandConsistency: 0,
    avgSov: null,
  };

  const rawKpisData = Array.isArray(kpis) ? kpis[0] : kpis;
  const rawKpis = (rawKpisData ?? null) as {
    activePromptsCount?: number;
    brandMentionsCount?: number;
    avgPosition?: number | null;
    brandConsistency?: number;
    avgSov?: number | null;
    active_prompts_count?: number;
    brand_mentions_count?: number;
    avg_position?: number | null;
    brand_consistency?: number;
    avg_sov?: number | null;
  } | null;

  const workspaceKpis: WorkspaceKpis = rawKpis
    ? {
        activePromptsCount: rawKpis.activePromptsCount ?? rawKpis.active_prompts_count ?? 0,
        brandMentionsCount: rawKpis.brandMentionsCount ?? rawKpis.brand_mentions_count ?? 0,
        avgPosition: rawKpis.avgPosition ?? rawKpis.avg_position ?? null,
        brandConsistency: rawKpis.brandConsistency ?? rawKpis.brand_consistency ?? 0,
        avgSov: rawKpis.avgSov ?? rawKpis.avg_sov ?? null,
      }
    : defaultKpis;

  const activeCount = promptRows.filter((r) => r.prompt_status === "active").length;

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        <PromptsPageHeader
          workspaceId={workspace.id}
          workspaceCountry={workspace.country ?? "ES"}
          totalActive={activeCount}
        />

        <PromptKpiCards
          kpis={workspaceKpis}
          enabledLlms={enabledLlms}
          usagePct={usagePct}
        />

        <PromptPerformanceCard
          rows={promptRows}
          workspaceId={workspace.id}
          availableTags={allTags ?? []}
          promptTags={promptTags}
          latestStatusByPrompt={latestStatusByPrompt}
        />
      </div>
    </div>
  );
}
