import {
  type ExtractedCitation,
  extractCitationsFromOpenRouter,
} from "@/lib/detection/extractCitations";
import type { LlmProviderKey } from "@/types";
import { DEFAULT_OPENROUTER_MODELS, resolveConfiguredOpenRouterModel } from "./modelDefaults";

export interface RunPromptInput {
  provider: LlmProviderKey;
  prompt: string;
  workspace: { id: string; slug: string };
  brand: { name: string; aliases: string[] };
  competitors: Array<{ name: string; aliases: string[] }>;
  /** Override the default model for this provider (from workspace_llm_config) */
  modelOverride?: string;
}

export interface RunPromptOutput {
  rawResponse: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Cost in USD as reported directly by OpenRouter (upstream_inference_cost) */
  costUsd?: number;
  /** Structured citations extracted from OpenRouter's message.annotations[] / data.citations[] */
  citations?: ExtractedCitation[];
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string; annotations?: unknown } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    cost_details?: { upstream_inference_cost?: number };
  };
  citations?: unknown;
};

function getOpenRouterModel(provider: LlmProviderKey): string {
  const envMap: Record<LlmProviderKey, string | undefined> = {
    chatgpt: process.env.OPENROUTER_MODEL_CHATGPT,
    gemini: process.env.OPENROUTER_MODEL_GEMINI,
    perplexity: process.env.OPENROUTER_MODEL_PERPLEXITY,
  };
  return envMap[provider]?.trim() || DEFAULT_OPENROUTER_MODELS[provider];
}

export async function runPrompt(input: RunPromptInput): Promise<RunPromptOutput> {
  const { provider, prompt, modelOverride } = input;

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. Todos los LLMs se ejecutan vía OpenRouter — no hay fallback a mock."
    );
  }

  const model = resolveConfiguredOpenRouterModel(
    provider,
    modelOverride,
    getOpenRouterModel(provider)
  );
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.2,
      usage: { include: true },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return {
    rawResponse: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    inputTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens,
    outputTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens,
    costUsd: data.usage?.cost_details?.upstream_inference_cost,
    citations: extractCitationsFromOpenRouter(data),
  };
}
