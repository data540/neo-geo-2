// Minimal SerpAPI wrapper used by the weekly AI Overview / AI Mode refresh.
// AI Overview is returned by engine=google; AI Mode is a separate surface and
// must be queried with engine=google_ai_mode.

export interface SerpAioResult {
  present: boolean;
  serpPosition: number | null;
  sections: Array<{ name: string; position: number }>;
  aiMode: {
    present: boolean;
    serpPosition: number | null;
  };
}

interface SerpApiBlock {
  type: string;
  title?: string;
  snippet?: string;
}

interface SerpApiResponse {
  error?: string;
  ai_overview?: {
    position?: number;
    blocks?: SerpApiBlock[];
    items?: SerpApiBlock[];
  };
}

interface SerpApiAiModeResponse {
  error?: string;
  search_metadata?: {
    status?: string;
  };
  reconstructed_markdown?: string;
  text_blocks?: unknown[];
  references?: unknown[];
  inline_images?: unknown[];
  inline_products?: unknown[];
  shopping_results?: unknown[];
  local_results?: unknown[];
  quick_results?: unknown[];
}

export async function fetchAiOverviewSerp(
  query: string,
  countryCode: string | null
): Promise<SerpAioResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY no esta configurada");
  }

  const localization = resolveLocalization(countryCode);
  const [aio, aiMode] = await Promise.allSettled([
    fetchAiOverview(query, apiKey, localization),
    fetchAiMode(query, apiKey, localization),
  ]);

  if (aio.status === "rejected" && aiMode.status === "rejected") {
    throw aio.reason instanceof Error ? aio.reason : new Error("SerpAPI requests failed");
  }

  return {
    ...(aio.status === "fulfilled"
      ? aio.value
      : { present: false, serpPosition: null, sections: [] }),
    aiMode: aiMode.status === "fulfilled" ? aiMode.value : { present: false, serpPosition: null },
  };
}

function resolveLocalization(countryCode: string | null) {
  const gl = (countryCode ?? "").trim().toLowerCase();
  return {
    gl: gl || null,
    hl: gl === "es" || gl === "co" ? "es" : "en",
  };
}

async function fetchAiOverview(
  query: string,
  apiKey: string,
  localization: { gl: string | null; hl: string }
): Promise<Omit<SerpAioResult, "aiMode">> {
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: "1",
  });

  if (localization.gl) {
    params.set("gl", localization.gl);
    params.set("hl", localization.hl);
  }

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`SerpAPI HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as SerpApiResponse;

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  if (!data.ai_overview) {
    return { present: false, serpPosition: null, sections: [] };
  }

  const position = data.ai_overview.position ?? null;
  const blocks: SerpApiBlock[] = data.ai_overview.blocks ?? data.ai_overview.items ?? [];

  const sections: Array<{ name: string; position: number }> = blocks
    .filter((block) => block.type === "heading" || block.type === "paragraph_with_header")
    .map((block, idx) => ({
      name: (block.title ?? block.snippet ?? "").trim().replace(/:$/, ""),
      position: idx + 1,
    }))
    .filter((section) => section.name.length > 0 && section.name.length <= 80);

  return {
    present: true,
    serpPosition: typeof position === "number" ? position : 1,
    sections,
  };
}

async function fetchAiMode(
  query: string,
  apiKey: string,
  localization: { gl: string | null; hl: string }
): Promise<SerpAioResult["aiMode"]> {
  const params = new URLSearchParams({
    engine: "google_ai_mode",
    q: query,
    api_key: apiKey,
  });

  if (localization.gl) {
    params.set("gl", localization.gl);
    params.set("hl", localization.hl);
  }

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`SerpAPI AI Mode HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as SerpApiAiModeResponse;

  if (data.error) {
    throw new Error(`SerpAPI AI Mode error: ${data.error}`);
  }

  const present =
    data.search_metadata?.status === "Success" &&
    (hasText(data.reconstructed_markdown) ||
      hasItems(data.text_blocks) ||
      hasItems(data.references) ||
      hasItems(data.inline_images) ||
      hasItems(data.inline_products) ||
      hasItems(data.shopping_results) ||
      hasItems(data.local_results) ||
      hasItems(data.quick_results));

  return {
    present,
    // AI Mode is a separate Google tab, not an organic SERP block. Store #1
    // when it is served so the existing dashboard position card can reflect it.
    serpPosition: present ? 1 : null,
  };
}

function hasItems(value: unknown[] | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function hasText(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
