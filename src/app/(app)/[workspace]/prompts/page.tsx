import { notFound } from "next/navigation";
import { PromptKpiCards } from "@/components/prompts/PromptKpiCards";
import { PromptPerformanceCard } from "@/components/prompts/PromptPerformanceCard";
import { PromptsPageHeader } from "@/components/prompts/PromptsPageHeader";
import { createClient } from "@/lib/supabase/server";
import type { PromptPerformanceRow, RunStatus, WorkspaceKpis } from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; country?: string }>;
}

export default async function PromptsPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm = "chatgpt", country } = await searchParams;

  const supabase = await createClient();

  // Obtener workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, country")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  // Obtener prompts con métricas (RPC)
  const { data: rows } = await supabase.rpc("get_workspace_prompt_performance", {
    p_workspace_slug: slug,
    p_llm_key: llm,
    p_country_filter: country ?? null,
  });

  // Obtener KPIs
  const { data: kpis } = await supabase.rpc("get_workspace_kpis", {
    p_workspace_slug: slug,
    p_llm_key: llm,
  });

  // Obtener tags disponibles del workspace
  const { data: allTags } = await supabase
    .from("prompt_tags")
    .select("id, name, color")
    .eq("workspace_id", workspace.id)
    .order("name");

  // Obtener tags asignadas a cada prompt
  const promptRows = (rows ?? []) as PromptPerformanceRow[];
  const promptIds = promptRows.map((r) => r.prompt_id);

  const promptTags: Record<string, { id: string; name: string; color: string }[]> = {};
  const latestStatusByPrompt: Record<string, RunStatus> = {};
  const llmsByPrompt: Record<string, string[]> = {};

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

    // Obtener el status del último run de cada prompt para el LLM activo
    const { data: provider } = await supabase
      .from("llm_providers")
      .select("id")
      .eq("key", llm)
      .single();

    if (provider) {
      const { data: latestRuns } = await supabase
        .from("prompt_runs")
        .select("prompt_id, status, created_at")
        .in("prompt_id", promptIds)
        .eq("llm_provider_id", provider.id)
        .order("created_at", { ascending: false });

      for (const r of latestRuns ?? []) {
        if (!latestStatusByPrompt[r.prompt_id]) {
          latestStatusByPrompt[r.prompt_id] = r.status as RunStatus;
        }
      }
    }

    const { data: llmRuns } = await supabase
      .from("prompt_runs")
      .select("prompt_id, llm_providers(name)")
      .in("prompt_id", promptIds)
      .not("llm_provider_id", "is", null);

    for (const run of llmRuns ?? []) {
      const promptId = run.prompt_id as string;
      const llmName = (run.llm_providers as { name?: string } | null)?.name;
      if (!llmName) continue;
      if (!llmsByPrompt[promptId]) llmsByPrompt[promptId] = [];
      if (!llmsByPrompt[promptId]?.includes(llmName)) {
        llmsByPrompt[promptId]?.push(llmName);
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

  const rawKpis = (kpis ?? null) as
    | {
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
      }
    | null;

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

        <PromptKpiCards kpis={workspaceKpis} />

        <PromptPerformanceCard
          rows={promptRows}
          workspaceId={workspace.id}
          llmKey={llm}
          availableTags={allTags ?? []}
          promptTags={promptTags}
          latestStatusByPrompt={latestStatusByPrompt}
          llmsByPrompt={llmsByPrompt}
        />
      </div>
    </div>
  );
}
