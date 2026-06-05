import { notFound } from "next/navigation";
import { getLlmConfigAction } from "@/actions/llm-config";
import { GoogleIntegrationPanel } from "@/components/workspace/GoogleIntegrationPanel";
import { LlmConfigPanel } from "@/components/workspace/LlmConfigPanel";
import { createClient } from "@/lib/supabase/server";
import type { LlmProvider, WorkspaceLlmConfigWithProvider, WorkspaceMemberRole } from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, gsc_site_url, ga4_property_id")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: currentMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!currentMembership) notFound();

  const { data: providers } = await supabase
    .from("llm_providers")
    .select("id, key, name, enabled")
    .eq("enabled", true)
    .order("name", { ascending: true });

  const configResult = await getLlmConfigAction(workspace.id);
  const existingConfigs: WorkspaceLlmConfigWithProvider[] = configResult.data ?? [];

  const configByProvider = new Map(existingConfigs.map((c) => [c.llm_provider_id, c]));

  const mergedConfigs = (providers ?? []).map((p: LlmProvider) => ({
    providerId: p.id,
    providerKey: p.key,
    providerName: p.name,
    promptsPerDay: configByProvider.get(p.id)?.prompts_per_day ?? 0,
    model: configByProvider.get(p.id)?.model ?? null,
  }));

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">LLM Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure how many prompts each AI provider runs daily for this workspace.
          </p>
        </div>

        <LlmConfigPanel
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          currentRole={currentMembership.role as WorkspaceMemberRole}
          configs={mergedConfigs}
        />

        <GoogleIntegrationPanel
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          currentRole={currentMembership.role as WorkspaceMemberRole}
          gscSiteUrl={workspace.gsc_site_url ?? null}
          ga4PropertyId={workspace.ga4_property_id ?? null}
        />
      </div>
    </div>
  );
}
