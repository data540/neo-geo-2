import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const { data: provider, error: providerError } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", "chatgpt")
    .single();
  if (providerError || !provider) {
    throw new Error(`Provider error: ${providerError?.message ?? "not found"}`);
  }

  const { data: prompts, error: promptsError } = await supabase
    .from("prompts")
    .select("id, workspace_id, text")
    .eq("status", "active")
    .eq("country", "CO");
  if (promptsError) {
    throw new Error(`Prompts query error: ${promptsError.message}`);
  }

  if (!prompts || prompts.length === 0) {
    console.log("No active CO prompts found");
    return;
  }

  const model = (process.env.OPENROUTER_MODEL_CHATGPT || "openai/gpt-4.1-nano").trim();

  const normalizeName = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");

  const extractPotentialCompetitorsFromResponse = (rawResponse: string): string[] => {
    const candidates = new Set<string>();

    const quotedMatches = rawResponse.matchAll(/"([A-Z][A-Za-z0-9&\-\s]{2,40})"/g);
    for (const match of quotedMatches) {
      const value = (match[1] ?? "").trim();
      if (value) candidates.add(value);
    }

    const namedMatches = rawResponse.matchAll(
      /\b([A-Z][A-Za-z0-9&-]{1,20}(?:\s+[A-Z][A-Za-z0-9&-]{1,20}){0,3})\b/g
    );
    for (const match of namedMatches) {
      const candidate = (match[1] ?? "").trim();
      if (candidate.length < 3) continue;
      if (/^(Top|Ruta|Vuelo|Clase|Programa|Tarifa|Equipaje|Check)$/i.test(candidate)) continue;
      if (/[0-9]{2,}/.test(candidate)) continue;
      candidates.add(candidate);
    }

    return Array.from(candidates).slice(0, 25);
  };

  const AIRLINE_NAME_HINTS = [
    "air",
    "airlines",
    "airways",
    "avianca",
    "iberia",
    "latam",
    "ryanair",
    "vueling",
    "wizz",
    "easyjet",
    "klm",
    "lufthansa",
    "turkish",
    "aeromexico",
    "volaris",
    "copa",
    "delta",
    "united",
    "american",
    "jetblue",
    "emirates",
    "qatar",
    "etihad",
    "air europa",
    "air france",
    "sky",
    "flight",
    "airline",
    "aeroline",
  ];

  const shouldKeepCompetitorCandidate = (name: string): boolean => {
    const normalized = normalizeName(name);
    if (normalized.length < 3) return false;
    if (/^(espana|colombia|madrid|bogota|barcelona|medellin|aeropuerto)$/i.test(normalized)) {
      return false;
    }
    return AIRLINE_NAME_HINTS.some((hint) => normalized.includes(hint));
  };

  let insertedCompetitors = 0;
  console.log(`Re-launching CO prompts: ${prompts.length}`);

  for (const prompt of prompts) {
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
      console.error(`Run insert error for prompt ${prompt.id}: ${runInsertError?.message}`);
      continue;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt.text }],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter error (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const rawResponse = payload.choices?.[0]?.message?.content ?? "";
      await supabase
        .from("prompt_runs")
        .update({
          raw_response: rawResponse,
          model: payload.model ?? model,
          input_tokens: payload.usage?.prompt_tokens ?? null,
          output_tokens: payload.usage?.completion_tokens ?? null,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      const [{ data: ownBrands }, { data: competitorBrands }] = await Promise.all([
        supabase.from("brands").select("name").eq("workspace_id", prompt.workspace_id).eq("type", "own"),
        supabase
          .from("brands")
          .select("name")
          .eq("workspace_id", prompt.workspace_id)
          .eq("type", "competitor"),
      ]);

      const existingNames = new Set(
        [
          ...(ownBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
          ...(competitorBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
        ].filter(Boolean)
      );

      const candidates = extractPotentialCompetitorsFromResponse(rawResponse)
        .filter(shouldKeepCompetitorCandidate)
        .map((name) => name.trim())
        .filter((name) => !existingNames.has(normalizeName(name)));

      const unique = Array.from(new Set(candidates.map((name) => normalizeName(name))))
        .map((normalized) => candidates.find((name) => normalizeName(name) === normalized))
        .filter((name): name is string => Boolean(name));

      if (unique.length > 0) {
        const { error: insertCompetitorsError } = await supabase.from("brands").insert(
          unique.map((name) => ({
            workspace_id: prompt.workspace_id,
            name,
            aliases: [],
            type: "competitor",
          }))
        );

        if (!insertCompetitorsError) {
          insertedCompetitors += unique.length;
        }
      }

      console.log(`Run ${run.id} completed`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await supabase
        .from("prompt_runs")
        .update({ status: "failed", error_message: errMsg, completed_at: new Date().toISOString() })
        .eq("id", run.id);
      console.error(`Run ${run.id} failed: ${errMsg}`);
    }
  }

  console.log(`All CO prompt runs executed. New competitors inserted: ${insertedCompetitors}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
