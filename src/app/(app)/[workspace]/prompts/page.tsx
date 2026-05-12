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
  }

  const defaultKpis: WorkspaceKpis = {
    activePromptsCount: 0,
    brandMentionsCount: 0,
    avgPosition: null,
    brandConsistency: 0,
    avgSov: null,
  };

  const workspaceKpis: WorkspaceKpis = kpis
    ? {
        activePromptsCount: (kpis as WorkspaceKpis).activePromptsCount ?? 0,
        brandMentionsCount: (kpis as WorkspaceKpis).brandMentionsCount ?? 0,
        avgPosition: (kpis as WorkspaceKpis).avgPosition ?? null,
        brandConsistency: (kpis as WorkspaceKpis).brandConsistency ?? 0,
        avgSov: (kpis as WorkspaceKpis).avgSov ?? null,
      }
    : defaultKpis;

  const activeCount = promptRows.filter((r) => r.prompt_status === "active").length;

  return (
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
      />
    </div>
  );
}
