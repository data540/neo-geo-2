const STATIC_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-3.5-turbo": { input: 0.0000005, output: 0.0000015 },
  "gpt-3.5-turbo-0125": { input: 0.0000005, output: 0.0000015 },
  "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  "gpt-4o-mini-2024-07-18": { input: 0.00000015, output: 0.0000006 },
  "gpt-4o": { input: 0.000005, output: 0.000015 },
  "gpt-4.1-mini": { input: 0.0000004, output: 0.0000016 },
  "gpt-4.1-nano": { input: 0.0000001, output: 0.0000004 },
  "openai/gpt-5.4-nano": { input: 0.0000002, output: 0.00000125 },
  "gpt-5.4-nano": { input: 0.0000002, output: 0.00000125 },
  "openai/gpt-5.5": { input: 0.000005, output: 0.00003 },
  "gpt-5.5": { input: 0.000005, output: 0.00003 },
  "claude-haiku-4-5-20251001": { input: 0.00000025, output: 0.00000125 },
  "claude-sonnet-4-5": { input: 0.000003, output: 0.000015 },
  "google/gemini-2.0-flash-001": { input: 0.0000001, output: 0.0000004 },
  "google/gemini-2.5-flash-lite": { input: 0.0000001, output: 0.0000004 },
  "gemini-2.5-flash-lite": { input: 0.0000001, output: 0.0000004 },
  "google/gemini-3.5-flash": { input: 0.0000015, output: 0.000009 },
  "gemini-3.5-flash": { input: 0.0000015, output: 0.000009 },
  "perplexity/sonar": { input: 0.000001, output: 0.000001 },
  sonar: { input: 0.000001, output: 0.000001 },
  "deepseek/deepseek-chat-v3-0324": { input: 0.00000027, output: 0.0000011 },
};

let catalogCache: Record<string, { input: number; output: number }> | null = null;
let catalogFetchedAt = 0;
const CATALOG_TTL_MS = 60 * 60 * 1000;

function addModelPrice(
  target: Record<string, { input: number; output: number }>,
  model: string,
  input: number,
  output: number
) {
  target[model] = { input, output };
  const slashIndex = model.indexOf("/");
  if (slashIndex > -1) {
    const withoutVendor = model.slice(slashIndex + 1);
    if (!(withoutVendor in target)) {
      target[withoutVendor] = { input, output };
    }
  }
}

async function loadOpenRouterCatalog(): Promise<Record<
  string,
  { input: number; output: number }
> | null> {
  const now = Date.now();
  if (catalogCache && now - catalogFetchedAt < CATALOG_TTL_MS) {
    return catalogCache;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return catalogCache;

    const json = (await response.json()) as {
      data?: Array<{
        id?: string;
        pricing?: { prompt?: string | number; completion?: string | number };
      }>;
    };

    const nextCache: Record<string, { input: number; output: number }> = {
      ...STATIC_MODEL_PRICING,
    };
    for (const model of json.data ?? []) {
      const id = model.id?.trim();
      if (!id) continue;

      const promptPrice = Number(model.pricing?.prompt);
      const completionPrice = Number(model.pricing?.completion);
      if (!Number.isFinite(promptPrice) || !Number.isFinite(completionPrice)) continue;

      addModelPrice(nextCache, id, promptPrice, completionPrice);
    }

    catalogCache = nextCache;
    catalogFetchedAt = now;
    return catalogCache;
  } catch {
    return catalogCache;
  }
}

function modelVariants(model: string): string[] {
  const variants: string[] = [model];

  // Strip vendor prefix: "openai/gpt-4.1-nano-2025-04-14" → "gpt-4.1-nano-2025-04-14"
  const slashIdx = model.indexOf("/");
  const withoutVendor = slashIdx > -1 ? model.slice(slashIdx + 1) : null;
  if (withoutVendor) variants.push(withoutVendor);

  // Strip trailing date suffix: "-2025-04-14" or "-20251001" etc.
  const datePattern = /-\d{4}-\d{2}-\d{2}$|-\d{8}$/;
  const withoutDate = model.replace(datePattern, "");
  if (withoutDate !== model) variants.push(withoutDate);
  if (withoutVendor) {
    const withoutVendorDate = withoutVendor.replace(datePattern, "");
    if (withoutVendorDate !== withoutVendor) variants.push(withoutVendorDate);
  }

  return [...new Set(variants)];
}

export async function estimateCostForModel(
  model: string,
  inputTokens?: number,
  outputTokens?: number
): Promise<number | null> {
  if (inputTokens === undefined || outputTokens === undefined) return null;

  const variants = modelVariants(model);

  // Try static pricing first (no network)
  for (const v of variants) {
    const p = STATIC_MODEL_PRICING[v];
    if (p) return p.input * inputTokens + p.output * outputTokens;
  }

  // Fall back to OpenRouter catalog
  const catalog = await loadOpenRouterCatalog();
  if (!catalog) return null;

  for (const v of variants) {
    const p = catalog[v];
    if (p) return p.input * inputTokens + p.output * outputTokens;
  }

  return null;
}
