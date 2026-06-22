// Wrapper mínimo para SerpAPI — solo se usa en el CRON semanal de AI Overview.
// Una llamada por prompt por semana → coste ~$0.01/prompt/semana.
//
// Docs: https://serpapi.com/ai-overview

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
    // SerpAPI devuelve la posición del bloque AIO en la SERP (1 = primero)
    position?: number;
    // Bloques internos del AI Overview (headings, snippets, listas…)
    blocks?: SerpApiBlock[];
    // Algunos campos alternativos según versión de la API
    items?: SerpApiBlock[];
  };
  // Google AI Mode: pestaña conversacional de Google Search (2025+)
  // El fieldname exacto puede variar — ajustar si SerpAPI lo llama diferente
  ai_mode?: {
    position?: number;
    blocks?: SerpApiBlock[];
  };
}

export async function fetchAiOverviewSerp(
  query: string,
  countryCode: string | null
): Promise<SerpAioResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY no está configurada");
  }

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    // Desactivar resultados orgánicos para ahorrar ancho de banda
    num: "1",
  });

  // País: código ISO 2 letras → parámetro gl de SerpAPI
  if (countryCode) {
    params.set("gl", countryCode.toLowerCase());
    params.set("hl", countryCode.toLowerCase() === "es" ? "es" : "en");
  }

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    // Timeout generoso — SerpAPI puede tardar 2-5s
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
    return { present: false, serpPosition: null, sections: [], aiMode: { present: false, serpPosition: null } };
  }

  const position = data.ai_overview.position ?? null;
  const blocks: SerpApiBlock[] = data.ai_overview.blocks ?? data.ai_overview.items ?? [];

  const sections: Array<{ name: string; position: number }> = blocks
    .filter((b) => b.type === "heading" || b.type === "paragraph_with_header")
    .map((b, idx) => ({
      name: (b.title ?? b.snippet ?? "").trim().replace(/:$/, ""),
      position: idx + 1,
    }))
    .filter((s) => s.name.length > 0 && s.name.length <= 80);

  return {
    present: true,
    serpPosition: typeof position === "number" ? position : 1,
    sections,
    aiMode: {
      present: !!data.ai_mode,
      serpPosition: typeof data.ai_mode?.position === "number" ? data.ai_mode.position : null,
    },
  };
}
