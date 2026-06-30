import { notFound } from "next/navigation";
import { AdminLogsTable } from "@/components/admin/AdminLogsTable";
import { AdminTabsWrapper } from "@/components/admin/AdminTabsWrapper";
import { createClient } from "@/lib/supabase/server";
import type { RunStatus } from "@/types";

interface AdminPageProps {
  params: Promise<{ workspace: string; tab?: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage({ params, searchParams }: AdminPageProps) {
  const { workspace: slug } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    notFound();
  }

  // Solo el rol 'owner' accede a Admin (defensa en profundidad: además de ocultarlo en el menú)
  if (membership.role !== "owner") {
    notFound();
  }

  const { data: runs } = await supabase
    .from("prompt_runs")
    .select(`
      id, status, model, input_tokens, output_tokens, cost_usd,
      started_at, completed_at, created_at, error_message, raw_response,
      prompts!inner(text),
      llm_providers(name)
    `)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (runs ?? []).map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    started_at: r.started_at as string | null,
    completed_at: r.completed_at as string | null,
    status: r.status as RunStatus,
    model: r.model as string | null,
    input_tokens: r.input_tokens as number | null,
    output_tokens: r.output_tokens as number | null,
    cost_usd: r.cost_usd as number | null,
    error_message: r.error_message as string | null,
    raw_response: r.raw_response as string | null,
    prompt_text: (r.prompts as unknown as { text: string }).text,
    provider_name: (r.llm_providers as unknown as { name: string } | null)?.name ?? "—",
  }));

  return (
    <AdminTabsWrapper
      workspaceId={workspace.id}
      workspaceSlug={slug}
      workspaceName={workspace.name}
      userRole={membership.role}
      logsRows={rows}
      initialTab={tab}
    />
  );
}
