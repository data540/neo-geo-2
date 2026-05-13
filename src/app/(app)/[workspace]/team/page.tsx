import { notFound } from "next/navigation";
import { TeamManagementPanel } from "@/components/workspace/TeamManagementPanel";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceMemberRole } from "@/types";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function TeamPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name")
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

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at, profiles(email, full_name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Team</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestiona accesos y colaboradores del workspace.
        </p>
      </div>

      <TeamManagementPanel
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        currentRole={currentMembership.role as WorkspaceMemberRole}
        members={(members ?? []).map((m) => ({
          userId: m.user_id,
          role: m.role as WorkspaceMemberRole,
          createdAt: m.created_at,
          email: (m.profiles as { email?: string } | null)?.email ?? "",
          fullName: (m.profiles as { full_name?: string | null } | null)?.full_name ?? null,
        }))}
      />
    </div>
  );
}
