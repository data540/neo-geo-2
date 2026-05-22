import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { executeRunsInBackground } from "@/lib/llm/enqueueWorkspaceRuns";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "neo-geo-internal-2024";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { workspaceId: string; runIds: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { workspaceId, runIds } = body;
  if (!workspaceId || !Array.isArray(runIds) || runIds.length === 0) {
    return NextResponse.json({ error: "Missing workspaceId or runIds" }, { status: 400 });
  }

  // Verify workspaceId exists (basic security)
  const supabase = getServiceClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .single();

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Use after() from the route handler context — completely isolated from any Server Action.
  // This route handler has no revalidatePath calls, so after() won't inherit any pending revalidations.
  after(() => executeRunsInBackground(workspaceId, runIds).catch((err) => {
    console.error("[api/internal/run-prompts] executeRunsInBackground failed:", err);
  }));

  return NextResponse.json({ ok: true, queued: runIds.length });
}
