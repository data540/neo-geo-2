import type { ExtractedBrandProfile } from "@/types";

const SYSTEM_PROMPT = `Eres un experto en análisis de marcas y marketing digital. A partir del contenido web de una empresa, extrae información estructurada. Responde ÚNICAMENTE con un JSON válido, sin texto adicional antes ni después.`;

const EMPTY: ExtractedBrandProfile = {
  extractedSummary: null,
  positioning: null,
  audience: null,
  productsServices: null,
  differentiators: null,
};

function normalizeDomain(domain: string): string {
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain;
  return `https://${domain}`;
}

export async function extractBrandProfile(domain: string): Promise<ExtractedBrandProfile> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return EMPTY;

  // 1. Obtener contenido de la web vía Jina Reader (devuelve Markdown limpio)
  let pageContent = "";
  try {
    const url = normalizeDomain(domain);
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(10_000),
    });
    if (jinaRes.ok) pageContent = await jinaRes.text();
  } catch {
    return EMPTY;
  }

  if (!pageContent || pageContent.length < 100) return EMPTY;

  // 2. Extracción estructurada vía LLM
  const userPrompt = `Analiza el siguiente contenido de la web "${domain}" y devuelve un JSON con exactamente estos campos:
- extractedSummary: resumen de 2-3 frases de qué hace la empresa
- positioning: cómo se posiciona en el mercado (propuesta de valor, segmento)
- audience: descripción del público objetivo
- productsServices: principales productos o servicios que ofrece
- differentiators: qué la hace única o diferente de la competencia

Si no puedes inferir algún campo con certeza, usa null. No añadas campos adicionales.

Contenido web:
${pageContent.slice(0, 8000)}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        max_tokens: 1024,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return EMPTY;

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const rawText = json.choices?.[0]?.message?.content ?? "";

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return EMPTY;

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    return {
      extractedSummary: typeof parsed.extractedSummary === "string" ? parsed.extractedSummary : null,
      positioning: typeof parsed.positioning === "string" ? parsed.positioning : null,
      audience: typeof parsed.audience === "string" ? parsed.audience : null,
      productsServices: typeof parsed.productsServices === "string" ? parsed.productsServices : null,
      differentiators: typeof parsed.differentiators === "string" ? parsed.differentiators : null,
    };
  } catch {
    return EMPTY;
  }
}
