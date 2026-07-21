import { notFound } from "next/navigation";
import { listMcpConnectionsAction, listMcpKeysAction } from "@/actions/mcp";
import { McpKeysPanel } from "@/components/workspace/McpKeysPanel";
import { isMcpBlocked } from "@/lib/auth/mcpAccess";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function McpPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (isMcpBlocked(session?.user.email)) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspace.id,
  });
  if (!canManage) notFound();

  const [keysResult, connectionsResult] = await Promise.all([
    listMcpKeysAction(workspace.id),
    listMcpConnectionsAction(workspace.id),
  ]);
  const base = process.env.MCP_PUBLIC_BASE_URL ?? "https://neogeo-three.vercel.app";
  const serverUrl = `${base.replace(/\/$/, "")}/api/mcp`;

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">MCP · Model Context Protocol</h1>
          <p className="text-sm text-slate-500 mt-1">
            Conecta este workspace a Claude o ChatGPT vía MCP (solo lectura).
          </p>
        </div>

        <McpKeysPanel
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          serverUrl={serverUrl}
          initialKeys={keysResult.data ?? []}
          initialConnections={connectionsResult.data ?? []}
        />
      </div>
    </div>
  );
}
