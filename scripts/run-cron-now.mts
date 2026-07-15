/**
 * Ejecuta el cron de prompts manualmente para todos los workspaces.
 * Replica la lógica de runPromptScheduled sin depender de Inngest/Next.js.
 * Uso: npx tsx scripts/run-cron-now.mts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { canRunPromptForWorkspace } from "../src/lib/workspace-country";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !OPENROUTER_KEY) {
  console.error("Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_MODELS: Record<string, string> = {
  chatgpt: "openai/gpt-4o",
  gemini: "google/gemini-2.5-flash-lite",
  perplexity: "perplexity/sonar",
};

const LEGACY_MODELS: Record<string, string[]> = {
  chatgpt: ["openai/gpt-5.5", "openai/gpt-5.4-nano", "openai/gpt-4o-mini", "openai/gpt-4.1-nano"],
  gemini: ["google/gemini-3.5-flash", "google/gemini-2.0-flash-001"],
  perplexity: [],
};

function resolveModel(providerKey: string, configuredModel?: string | null): string {
  const fallback = DEFAULT_MODELS[providerKey] ?? "openai/gpt-4o";
  const m = configuredModel?.trim();
  if (!m) return fallback;
  if ((LEGACY_MODELS[providerKey] ?? []).includes(m)) return fallback;
  return m;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

async function callOpenRouter(model: string, promptText: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo-cron",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: promptText }],
      max_tokens: 1000,
      temperature: 0.2,
      usage: { include: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: {
      prompt_tokens?: number; completion_tokens?: number;
      input_tokens?: number; output_tokens?: number;
      cost_details?: { upstream_inference_cost?: number };
    };
  };
  return {
    rawResponse: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    inputTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens,
    outputTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens,
    costUsd: data.usage?.cost_details?.upstream_inference_cost,
  };
}

function detectBrandInText(text: string, name: string, aliases: string[]): boolean {
  const lower = text.toLowerCase();
  const terms = [name, ...aliases].map((t) => t.toLowerCase());
  return terms.some((t) => lower.includes(t));
}

async function runOne(params: {
  promptId: string;
  workspaceId: string;
  llmProviderId: string;
  llmKey: string;
  modelOverride?: string | null;
  promptText: string;
  ownBrand: { id: string; name: string; aliases: string[] };
  competitors: Array<{ id: string; name: string; aliases: string[] }>;
}) {
  const { promptId, workspaceId, llmProviderId, llmKey, modelOverride, promptText, ownBrand, competitors } = params;
  const model = resolveModel(llmKey, modelOverride);

  const { data: run } = await supabase
    .from("prompt_runs")
    .insert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: llmProviderId,
      status: "queued",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!run) {
    console.error(`  [ERROR] No se pudo insertar prompt_run para prompt ${promptId}`);
    return;
  }

  await supabase
    .from("prompt_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", run.id);

  try {
    const result = await callOpenRouter(model, promptText);

    const ownMentioned = detectBrandInText(result.rawResponse, ownBrand.name, ownBrand.aliases);
    const today = new Date().toISOString().slice(0, 10);

    const mentions: Record<string, unknown>[] = [];
    if (ownMentioned) {
      mentions.push({
        workspace_id: workspaceId,
        prompt_run_id: run.id,
        brand_id: ownBrand.id,
        brand_name_detected: ownBrand.name,
        brand_type: "own",
        position: null,
        sentiment: null,
        mention_type: "general_mention",
        confidence: 0.8,
      });
    }
    for (const comp of competitors) {
      if (detectBrandInText(result.rawResponse, comp.name, comp.aliases)) {
        mentions.push({
          workspace_id: workspaceId,
          prompt_run_id: run.id,
          brand_id: comp.id,
          brand_name_detected: comp.name,
          brand_type: "competitor",
          position: null,
          sentiment: null,
          mention_type: "general_mention",
          confidence: 0.8,
        });
      }
    }

    const compCount = mentions.filter((m) => m.brand_type === "competitor").length;

    await supabase.from("prompt_runs").update({
      raw_response: result.rawResponse,
      model: result.model,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
      cost_usd: result.costUsd ?? null,
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    if (mentions.length > 0) {
      await supabase.from("mentions").insert(mentions);
    }

    await supabase.from("daily_prompt_metrics").upsert({
      workspace_id: workspaceId,
      prompt_id: promptId,
      llm_provider_id: llmProviderId,
      date: today,
      brand_mentioned: ownMentioned,
      brand_position: null,
      competitor_count: compCount,
      sov: ownMentioned ? Math.round(100 / (1 + compCount)) : 0,
      sentiment: null,
      consistency_score: ownMentioned ? 100 : 0,
    }, { onConflict: "prompt_id,llm_provider_id,date" });

    console.log(`  ✓ [${llmKey}] ${promptId.slice(0, 8)}… | ${result.model} | own=${ownMentioned} comp=${compCount} cost=$${result.costUsd?.toFixed(6) ?? "?"}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ [${llmKey}] ${promptId.slice(0, 8)}… ERROR: ${msg}`);
    await supabase.from("prompt_runs").update({
      status: "failed",
      error_message: msg,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
  }
}

async function main() {
  console.log(`\n=== CRON manual ${new Date().toISOString()} ===\n`);

  const { data: configs } = await supabase
    .from("workspace_llm_config")
    .select("workspace_id, prompts_per_day, model, llm_providers!inner(id, key, enabled)")
    .eq("enabled", true)
    .eq("llm_providers.enabled", true)
    .gt("prompts_per_day", 0);

  if (!configs?.length) {
    console.log("No hay configuraciones activas.");
    return;
  }

  const { data: allPrompts } = await supabase
    .from("prompts")
    .select("id, workspace_id, text, country")
    .eq("status", "active");

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: todayRuns } = await supabase
    .from("prompt_runs")
    .select("workspace_id, llm_provider_id")
    .gte("created_at", todayStart.toISOString());

  const runCounts = new Map<string, number>();
  for (const r of todayRuns ?? []) {
    const k = `${r.workspace_id}:${r.llm_provider_id}`;
    runCounts.set(k, (runCounts.get(k) ?? 0) + 1);
  }

  const workspaceIds = [...new Set(configs.map((c) => c.workspace_id as string))];

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, slug")
    .in("id", workspaceIds);
  const wsMap = new Map((workspaces ?? []).map((w) => [w.id as string, w.slug as string]));

  const promptsByWorkspace = new Map<string, Array<{ id: string; text: string }>>();
  for (const p of allPrompts ?? []) {
    const wid = p.workspace_id as string;
    if (
      !canRunPromptForWorkspace({
        workspaceSlug: wsMap.get(wid) ?? "",
        promptCountry: p.country as string | null,
      })
    ) {
      continue;
    }
    if (!promptsByWorkspace.has(wid)) promptsByWorkspace.set(wid, []);
    promptsByWorkspace.get(wid)!.push({ id: p.id as string, text: p.text as string });
  }

  const { data: brands } = await supabase
    .from("brands")
    .select("id, workspace_id, name, aliases, type")
    .in("workspace_id", workspaceIds);

  const ownBrandMap = new Map<string, { id: string; name: string; aliases: string[] }>();
  const competitorMap = new Map<string, Array<{ id: string; name: string; aliases: string[] }>>();
  for (const b of brands ?? []) {
    const wid = b.workspace_id as string;
    if (b.type === "own") {
      ownBrandMap.set(wid, { id: b.id as string, name: b.name as string, aliases: (b.aliases ?? []) as string[] });
    } else {
      if (!competitorMap.has(wid)) competitorMap.set(wid, []);
      competitorMap.get(wid)!.push({ id: b.id as string, name: b.name as string, aliases: (b.aliases ?? []) as string[] });
    }
  }

  let totalSent = 0;

  for (const config of configs) {
    const workspaceId = config.workspace_id as string;
    const provider = config.llm_providers as unknown as { id: string; key: string };
    const llmKey = provider.key;
    const llmProviderId = provider.id;
    const slug = wsMap.get(workspaceId) ?? workspaceId;

    const available = promptsByWorkspace.get(workspaceId) ?? [];
    if (available.length === 0) continue;

    const alreadyToday = runCounts.get(`${workspaceId}:${llmProviderId}`) ?? 0;
    const remaining = Math.max(0, config.prompts_per_day - alreadyToday);

    if (remaining === 0) {
      console.log(`[${slug}/${llmKey}] Cap alcanzado: ${alreadyToday}/${config.prompts_per_day} — omitido`);
      continue;
    }

    const selected = shuffle(available).slice(0, remaining);
    const ownBrand = ownBrandMap.get(workspaceId);
    const competitors = competitorMap.get(workspaceId) ?? [];

    if (!ownBrand) {
      console.warn(`[${slug}/${llmKey}] Sin brand propia — omitido`);
      continue;
    }

    console.log(`[${slug}/${llmKey}] Ejecutando ${selected.length} prompts (cap=${config.prompts_per_day}, ya hechos hoy=${alreadyToday})`);

    for (const prompt of selected) {
      await runOne({
        promptId: prompt.id,
        workspaceId,
        llmProviderId,
        llmKey,
        modelOverride: config.model as string | null,
        promptText: prompt.text,
        ownBrand,
        competitors,
      });
      totalSent++;
    }
  }

  console.log(`\n=== Completado: ${totalSent} prompts ejecutados ===\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
