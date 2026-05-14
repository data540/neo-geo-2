import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { estimateCostForModel } from "../src/lib/llm/pricing";

interface PromptRow {
  id: string;
  workspace_id: string;
  text: string;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function callOpenRouter(prompt: string, model: string, apiKey: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    rawResponse: payload.choices?.[0]?.message?.content ?? "",
    model: payload.model ?? model,
    inputTokens: payload.usage?.prompt_tokens,
    outputTokens: payload.usage?.completion_tokens,
  };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const model = (process.env.OPENROUTER_MODEL_CHATGPT || "openai/gpt-4.1-nano").trim();

  if (!supabaseUrl || !serviceRoleKey || !openRouterApiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or OPENROUTER_API_KEY");
  }

  console.log(`Using model: ${model}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: provider, error: providerError } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", "chatgpt")
    .single();

  if (providerError || !provider) {
    throw new Error(`Provider error: ${providerError?.message ?? "chatgpt not found"}`);
  }

  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select("id, workspace_id, text")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (promptsError) {
    throw new Error(`Prompts query error: ${promptsError.message}`);
  }

  const activePrompts = (prompts ?? []) as PromptRow[];
  if (activePrompts.length === 0) {
    console.log("No active prompts found");
    return;
  }

  console.log(`Re-launching prompts: ${activePrompts.length}`);

  let completed = 0;
  let failed = 0;

  for (const prompt of activePrompts) {
    const { data: run, error: runInsertError } = await supabase
      .from("prompt_runs")
      .insert({
        workspace_id: prompt.workspace_id,
        prompt_id: prompt.id,
        llm_provider_id: provider.id,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runInsertError || !run) {
      failed += 1;
      console.error(`Run insert failed for prompt ${prompt.id}: ${runInsertError?.message}`);
      continue;
    }

    try {
      const result = await callOpenRouter(prompt.text, model, openRouterApiKey);
      const costUsd = await estimateCostForModel(result.model, result.inputTokens, result.outputTokens);

      await supabase
        .from("prompt_runs")
        .update({
          raw_response: result.rawResponse,
          model: result.model,
          input_tokens: result.inputTokens ?? null,
          output_tokens: result.outputTokens ?? null,
          cost_usd: costUsd,
          status: "completed",
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", run.id);

      completed += 1;
      console.log(`Completed ${completed}/${activePrompts.length} run=${run.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await supabase
        .from("prompt_runs")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      failed += 1;
      console.error(`Failed run=${run.id}: ${errorMessage}`);
    }
  }

  console.log(`Done. completed=${completed} failed=${failed}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
