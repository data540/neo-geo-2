import { redirect } from "next/navigation";
import { WorkspaceSelector } from "@/app/(app)/workspaces/WorkspaceSelector";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/types";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const workspaces: Workspace[] =
    memberships?.map((m) => m.workspaces as unknown as Workspace).filter(Boolean) ?? [];

  if (workspaces.length === 0) redirect("/onboarding");

  return <WorkspaceSelector workspaces={workspaces} />;
}
