/**
 * Runs the AI Overview / AI Mode SERP refresh immediately.
 *
 * Usage:
 *   pnpm exec tsx scripts/refresh-aio-serp-now.mts
 *
 * Optional:
 *   FORCE_SERP_REFRESH=1 pnpm exec tsx scripts/refresh-aio-serp-now.mts
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { canRunPromptForWorkspace } from "../src/lib/workspace-country";

const serpApiClient = await import("../src/lib/aio/serpApiClient");
const fetchAiOverviewSerp =
  serpApiClient.fetchAiOverviewSerp ??
  (serpApiClient as unknown as { default?: typeof serpApiClient }).default?.fetchAiOverviewSerp;

if (!fetchAiOverviewSerp) {
  throw new Error("Could not load fetchAiOverviewSerp");
}

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const CACHE_TTL_DAYS = 7;
const BATCH_DELAY_MS = 500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!process.env.SERPAPI_KEY) {
  throw new Error("Missing SERPAPI_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSerpApiSearchesLeft() {
  const res = await fetch(`https://serpapi.com/account?api_key=${process.env.SERPAPI_KEY}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    total_searches_left?: number;
    plan_searches_left?: number;
    extra_searches_left?: number;
  };
  return data.total_searches_left ?? data.plan_searches_left ?? data.extra_searches_left ?? null;
}

async function main() {
  const searchesLeft = await getSerpApiSearchesLeft();
  if (searchesLeft !== null && searchesLeft <= 0) {
    throw new Error("SerpAPI quota is exhausted: 0 searches left");
  }

  const { data: geminiProvider, error: providerError } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", "gemini")
    .eq("enabled", true)
    .single();

  if (providerError || !geminiProvider) {
    throw new Error("Gemini provider not found or disabled");
  }

  const { data: configs, error: configsError } = await supabase
    .from("workspace_llm_config")
    .select("workspace_id")
    .eq("llm_provider_id", geminiProvider.id)
    .eq("enabled", true);

  if (configsError) throw configsError;

  const workspaceIds = (configs ?? []).map((config) => config.workspace_id as string);
  if (workspaceIds.length === 0) {
    console.log("No workspaces with Gemini enabled.");
    return;
  }

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id, slug")
    .in("id", workspaceIds);

  if (workspacesError) throw workspacesError;
  const workspaceSlugById = new Map(
    (workspaces ?? []).map((workspace) => [workspace.id as string, workspace.slug as string])
  );

  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select("id, workspace_id, text, country")
    .in("workspace_id", workspaceIds)
    .eq("status", "active");

  if (promptsError) throw promptsError;

  const activePrompts = (prompts ?? []) as Array<{
    id: string;
    workspace_id: string;
    text: string;
    country: string | null;
  }>;
  const executablePrompts = activePrompts.filter((prompt) =>
    canRunPromptForWorkspace({
      workspaceSlug: workspaceSlugById.get(prompt.workspace_id) ?? "",
      promptCountry: prompt.country,
    })
  );

  const force = process.env.FORCE_SERP_REFRESH === "1";
  let toFetch = executablePrompts;

  if (!force) {
    const since = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from("prompt_serp_cache")
      .select("prompt_id")
      .in(
        "prompt_id",
        executablePrompts.map((prompt) => prompt.id)
      )
      .gte("fetched_at", since);

    if (recentError) throw recentError;
    const recentIds = new Set((recent ?? []).map((row) => row.prompt_id as string));
    toFetch = executablePrompts.filter((prompt) => !recentIds.has(prompt.id));
  }

  if (searchesLeft !== null && searchesLeft < toFetch.length * 2) {
    throw new Error(
      `SerpAPI quota too low: ${searchesLeft} searches left for ${toFetch.length} prompts`
    );
  }

  console.log(`Refreshing SERP snapshots for ${toFetch.length}/${executablePrompts.length} prompts.`);

  let fetched = 0;
  let errors = 0;
  let aioPresent = 0;
  let aiModePresent = 0;

  for (const prompt of toFetch) {
    try {
      const result = await fetchAiOverviewSerp(prompt.text, prompt.country);
      const { error } = await supabase.from("prompt_serp_cache").insert({
        workspace_id: prompt.workspace_id,
        prompt_id: prompt.id,
        ai_overview_present: result.present,
        ai_overview_serp_position: result.serpPosition,
        ai_overview_sections: result.sections,
        ai_mode_present: result.aiMode.present,
        ai_mode_serp_position: result.aiMode.serpPosition,
      });
      if (error) throw error;

      fetched++;
      if (result.present) aioPresent++;
      if (result.aiMode.present) aiModePresent++;
      process.stdout.write(`\r${fetched + errors}/${toFetch.length} processed`);
    } catch (err) {
      errors++;
      process.stdout.write(`\r${fetched + errors}/${toFetch.length} processed`);
      console.error(`\nError prompt=${prompt.id}:`, err instanceof Error ? err.message : err);
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(
    `\nDone. fetched=${fetched}, errors=${errors}, aio_present=${aioPresent}, ai_mode_present=${aiModePresent}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
