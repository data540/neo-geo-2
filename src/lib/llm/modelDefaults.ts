import type { LlmProviderKey } from "@/types";

export const DEFAULT_OPENROUTER_MODELS: Record<LlmProviderKey, string> = {
  chatgpt: "openai/gpt-4o",
  gemini: "google/gemini-2.5-flash-lite",
  perplexity: "perplexity/sonar",
};

// "openai/gpt-4o-mini" quedó fuera deliberadamente: fue un default legacy en el
// pasado, pero también es un modelo válido que los workspaces pueden elegir hoy
// para ahorrar coste. Si estuviera en esta lista, cualquier workspace que lo
// configure explícitamente sería revertido en silencio al default actual.
export const LEGACY_DEFAULT_OPENROUTER_MODELS: Record<LlmProviderKey, string[]> = {
  chatgpt: ["openai/gpt-5.5", "openai/gpt-5.4-nano", "openai/gpt-4.1-nano"],
  gemini: ["google/gemini-3.5-flash", "google/gemini-2.0-flash-001"],
  perplexity: ["perplexity/sonar"],
};

export function resolveConfiguredOpenRouterModel(
  provider: LlmProviderKey,
  configuredModel?: string | null,
  fallbackModel: string = DEFAULT_OPENROUTER_MODELS[provider]
): string {
  const model = configuredModel?.trim();
  if (!model) return fallbackModel;
  if (LEGACY_DEFAULT_OPENROUTER_MODELS[provider].includes(model)) return fallbackModel;
  return model;
}
