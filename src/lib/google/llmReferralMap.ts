import type { LlmProviderKey } from "@/types";

// Mapea el sessionSource de GA4 (dominio referral) a uno de nuestros LLMs.
// Nota: el tráfico de Google AI Overviews NO es distinguible (llega como
// google/organic), por lo que "gemini" tendrá datos limitados o nulos en GA4.
const SOURCE_PATTERNS: Array<{ match: RegExp; llm: LlmProviderKey }> = [
  { match: /(^|\.)chatgpt\.com$/i, llm: "chatgpt" },
  { match: /(^|\.)chat\.openai\.com$/i, llm: "chatgpt" },
  { match: /(^|\.)openai\.com$/i, llm: "chatgpt" },
  { match: /(^|\.)perplexity\.ai$/i, llm: "perplexity" },
  { match: /(^|\.)gemini\.google\.com$/i, llm: "gemini" },
  { match: /(^|\.)bard\.google\.com$/i, llm: "gemini" },
];

export function mapSourceToLlm(source: string | null | undefined): LlmProviderKey | null {
  if (!source) return null;
  const normalized = source.trim().toLowerCase();
  for (const { match, llm } of SOURCE_PATTERNS) {
    if (match.test(normalized)) return llm;
  }
  return null;
}
