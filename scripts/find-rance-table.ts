import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const words = ["rance", "france", "runs", "prom", "backup", "old", "temp"];
  const tables = [];
  
  // Since we can't list tables, let's try some specific combinations the user might have used
  const names = [
    "proms_rance", "proms_france", "proms_runs", "prompt_runs_rance", "prompt_runs_france",
    "prompts_rance", "prompts_france", "proms", "rance", "france"
  ];

  for (const name of names) {
     const { error } = await supabase.from(name).select('count').limit(1);
     if (!error) {
       console.log("Found table:", name);
     }
  }
}

main().catch(console.error);
