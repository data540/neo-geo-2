import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  // Check if prompts table has data
  const { count: pCount } = await supabase.from("prompts").select("*", { count: 'exact', head: true });
  console.log("Prompts count:", pCount);

  const { count: rCount } = await supabase.from("prompt_runs").select("*", { count: 'exact', head: true });
  console.log("Prompt runs count:", rCount);

  const { count: mCount } = await supabase.from("mentions").select("*", { count: 'exact', head: true });
  console.log("Mentions count:", mCount);

  const { count: dpmCount } = await supabase.from("daily_prompt_metrics").select("*", { count: 'exact', head: true });
  console.log("Daily prompt metrics count:", dpmCount);

  const { count: dwmCount } = await supabase.from("daily_workspace_metrics").select("*", { count: 'exact', head: true });
  console.log("Daily workspace metrics count:", dwmCount);
  
  // Check for any table that might be "PROMs RANCE"
  const tablesToTry = ["prompts_france", "prompts_air_france", "prompt_runs_history"];
  
  for (const table of tablesToTry) {
    const { data, error } = await supabase.from(table).select("count").limit(1);
    if (!error) {
       console.log(`Table '${table}' exists and has data.`);
       // If it's prompt_runs, let's see if it has prompt text
       if (table === "prompt_runs") {
         const { data: sample } = await supabase.from(table).select("*").limit(1);
         console.log(`Sample from ${table}:`, sample);
       }
    } else {
       console.log(`Table '${table}' does not exist or error:`, error.message);
    }
  }
}

main().catch(console.error);
