import { notFound, redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LlmSwitcher } from "@/components/layout/LlmSwitcher";
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const user = session.user;

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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <LlmSwitcher />
        </header>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
