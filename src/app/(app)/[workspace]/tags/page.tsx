import { notFound } from "next/navigation";
import { getWorkspaceTagsAction } from "@/actions/tags";
import { TagsManagementPanel } from "@/components/tags/TagsManagementPanel";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function TagsPage({ params }: Props) {
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

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) notFound();

  const tagsResult = await getWorkspaceTagsAction(workspace.id);
  const tags = tagsResult.success && tagsResult.data ? tagsResult.data : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Etiquetas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Crea y organiza etiquetas para clasificar tus prompts. Asígnalas desde la tabla de
          prompts.
        </p>
      </div>

      <TagsManagementPanel
        workspaceId={workspace.id}
        initialTags={tags}
        canManage={membership.role !== "viewer"}
      />
    </div>
  );
}
