import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
async function main() {
  const env = readFileSync(".env.local", "utf-8");
  const vars: Record<string, string> = {};
  for (const line of env.split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  const sb = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: failed } = await sb.from("prompt_runs").select("id").eq("status", "failed");
  const ids = (failed ?? []).map((r: any) => r.id as string);
  if (!ids.length) { console.log("No hay runs fallidos"); return; }
  await sb.from("mentions").delete().in("prompt_run_id", ids);
  await sb.from("sources").delete().in("prompt_run_id", ids);
  const { error } = await sb.from("prompt_runs").delete().eq("status", "failed");
  if (error) console.error("Error:", error.message);
  else console.log(`Eliminados ${ids.length} runs fallidos`);
}
main().catch(console.error);
