import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { executePromptRun } from "@/lib/llm/executePromptRun";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "neo-geo-internal-2024";
const CONCURRENCY = 5;

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function executeRunsConcurrent(runIds: string[]): Promise<void> {
  const queue = [...runIds];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id) {
        try {
          await executePromptRun(id);
        } catch (err) {
          console.error(`[run-prompts] run ${id} failed:`, err);
        }
      }
    }
  });
  await Promise.all(workers);
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

  const supabase = getServiceClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .single();

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  after(() => executeRunsConcurrent(runIds));

  return NextResponse.json({ ok: true, queued: runIds.length });
}
