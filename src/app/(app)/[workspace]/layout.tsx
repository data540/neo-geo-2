import { notFound, redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceMemberRole } from "@/types";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Obtener el workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (wsError || !workspace) {
    notFound();
  }

  // Verificar membresía
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    notFound();
  }

  // Obtener todos los workspaces del usuario para el switcher
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const workspaces: Workspace[] =
    memberships?.map((m) => m.workspaces as unknown as Workspace).filter(Boolean) ?? [];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <AppSidebar
        workspaces={workspaces}
        currentWorkspace={workspace as Workspace}
        userRole={membership.role as WorkspaceMemberRole}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
