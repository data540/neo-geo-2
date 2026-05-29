// Diagnose why Market Share donut might be empty.
// Run with: pnpm tsx scripts/diagnose-market-share.ts <workspace_slug> [days] [llm_key]

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const slug = process.argv[2] ?? "air-europa";
const days = Number(process.argv[3] ?? 7);
const llmKey = process.argv[4] ?? "chatgpt";

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log(`\n=== Diagnose Market Share ===`);
  console.log(`slug=${slug}  days=${days}  llm=${llmKey}\n`);

  // 1. Workspace
  const { data: ws, error: wsErr } = await sb
    .from("workspaces")
    .select("id, name, slug, brand_name")
    .eq("slug", slug)
    .single();
  if (wsErr || !ws) {
    console.error("Workspace not found:", wsErr?.message);
    return;
  }
  console.log(`[1] workspace: ${ws.name}  id=${ws.id}  brand=${ws.brand_name}`);

  // 2. LLM provider
  const { data: prov, error: provErr } = await sb
    .from("llm_providers")
    .select("id, key, name, enabled")
    .order("key");
  if (provErr) console.error("providers err:", provErr);
  console.log(`[2] llm_providers:`, prov);
  const selectedProv = prov?.find((p) => p.key === llmKey);
  if (!selectedProv) console.warn(`!! provider with key="${llmKey}" not found`);

  // 3. Brands
  const { data: brands } = await sb
    .from("brands")
    .select("id, name, type, domain")
    .eq("workspace_id", ws.id);
  console.log(`[3] brands count: ${brands?.length ?? 0}`);
  console.log(
    `    own:`,
    brands?.filter((b) => b.type === "own").map((b) => b.name)
  );
  console.log(
    `    competitors:`,
    brands?.filter((b) => b.type === "competitor").map((b) => b.name)
  );

  // 4. prompt_runs in window
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: runs, count: runsCount } = await sb
    .from("prompt_runs")
    .select("id, status, llm_provider_id, created_at", { count: "exact" })
    .eq("workspace_id", ws.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  console.log(`[4] prompt_runs since ${since}: ${runsCount}`);
  const byStatus = (runs ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`    by status:`, byStatus);
  const byProv = (runs ?? []).reduce<Record<string, number>>((acc, r) => {
    const key = r.llm_provider_id ?? "null";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`    by llm_provider_id:`, byProv);
  if (selectedProv) {
    const matching = (runs ?? []).filter((r) => r.llm_provider_id === selectedProv.id).length;
    console.log(`    runs matching llm=${llmKey}: ${matching}`);
  }

  // 5. mentions in window
  const { data: mentions, count: mentCount } = await sb
    .from("mentions")
    .select("id, brand_id, brand_type, mention_type, prompt_run_id, created_at", {
      count: "exact",
    })
    .eq("workspace_id", ws.id)
    .gte("created_at", since)
    .limit(2000);
  console.log(`\n[5] mentions in window: ${mentCount}`);
  const mWithBrand = (mentions ?? []).filter((m) => m.brand_id).length;
  const mNullBrand = (mentions ?? []).filter((m) => !m.brand_id).length;
  console.log(`    with brand_id: ${mWithBrand}    null brand_id: ${mNullBrand}`);
  const byType = (mentions ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.brand_type ?? "null"] = (acc[m.brand_type ?? "null"] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`    by brand_type:`, byType);

  // 6. RPC actual return
  console.log(`\n[6] RPC get_workspace_market_share:`);
  const { data: ms, error: msErr } = await sb.rpc("get_workspace_market_share", {
    workspace_slug: slug,
    days,
    llm_key: llmKey,
  });
  if (msErr) console.error("    err:", msErr);
  console.log(`    rows: ${ms?.length ?? 0}`);
  console.log(ms);

  console.log(`\n[7] RPC without llm filter (all providers):`);
  const { data: msAll, error: msAllErr } = await sb.rpc("get_workspace_market_share", {
    workspace_slug: slug,
    days,
    llm_key: null,
  });
  if (msAllErr) console.error("    err:", msAllErr);
  console.log(`    rows: ${msAll?.length ?? 0}`);
  console.log(msAll);

  console.log(`\n[8] RPC with days=365 + llm=${llmKey}:`);
  const { data: msYear } = await sb.rpc("get_workspace_market_share", {
    workspace_slug: slug,
    days: 365,
    llm_key: llmKey,
  });
  console.log(`    rows: ${msYear?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
