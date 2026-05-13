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

  switch (provider) {
    case "chatgpt":
      return runChatGPT(prompt);
    case "claude":
      return runClaude(prompt);
    case "gemini":
      return runGemini(prompt);
    case "perplexity":
      return runPerplexity(prompt);
  }
}

async function runChatGPT(prompt: string): Promise<RunPromptOutput> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000,
  });
  return {
    rawResponse: response.choices[0]?.message?.content ?? "",
    model: response.model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

async function runClaude(prompt: string): Promise<RunPromptOutput> {
  const Anthropic = await import("@anthropic-ai/sdk");
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.content[0];
  return {
    rawResponse: content?.type === "text" ? content.text : "",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function runGemini(prompt: string): Promise<RunPromptOutput> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return {
    rawResponse: result.response.text(),
    model: "gemini-1.5-flash",
  };
}

async function runPerplexity(prompt: string): Promise<RunPromptOutput> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    rawResponse: data.choices[0]?.message?.content ?? "",
    model: data.model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}
