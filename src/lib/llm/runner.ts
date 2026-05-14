import type { LlmProviderKey } from "@/types";
import { hasApiKey, mockRunPrompt } from "./mock";

export interface RunPromptInput {
  provider: LlmProviderKey;
  prompt: string;
  workspace: { id: string; slug: string };
  brand: { name: string; aliases: string[] };
  competitors: Array<{ name: string; aliases: string[] }>;
}

export interface RunPromptOutput {
  rawResponse: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const DEFAULT_OPENROUTER_MODEL: Record<LlmProviderKey, string> = {
  chatgpt: "openai/gpt-4.1-nano",
  claude: "anthropic/claude-3.5-haiku",
  gemini: "google/gemini-2.0-flash-001",
  perplexity: "perplexity/sonar",
  deepseek: "deepseek/deepseek-chat-v3-0324",
};

function getOpenRouterModel(provider: LlmProviderKey): string {
  const envMap: Record<LlmProviderKey, string | undefined> = {
    chatgpt: process.env.OPENROUTER_MODEL_CHATGPT,
    claude: process.env.OPENROUTER_MODEL_CLAUDE,
    gemini: process.env.OPENROUTER_MODEL_GEMINI,
    perplexity: process.env.OPENROUTER_MODEL_PERPLEXITY,
    deepseek: process.env.OPENROUTER_MODEL_DEEPSEEK,
  };
  return envMap[provider]?.trim() || DEFAULT_OPENROUTER_MODEL[provider];
}

export async function runPrompt(input: RunPromptInput): Promise<RunPromptOutput> {
  const { provider, prompt, brand, competitors } = input;

  if (!hasApiKey(provider)) {
    return mockRunPrompt({
      provider,
      prompt,
      brandName: brand.name,
      competitors: competitors.map((c) => c.name),
    });
  }

  const model = getOpenRouterModel(provider);
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
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}
