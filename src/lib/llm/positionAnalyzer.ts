import { z } from "zod";

export interface PositionResult {
  brandName: string;
  rank: number | null;
  confidence: number;
}

const POSITION_MODEL = process.env.OPENROUTER_MODEL_POSITION?.trim() || "openai/gpt-5.4-nano";

const PositionItemSchema = z.object({
  brand: z.string().min(1),
  rank: z.number().int().min(1).max(50).nullable(),
  confidence: z.number().min(0).max(1),
});

const PositionResponseSchema = z.object({
  results: z.array(PositionItemSchema),
});

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function buildPrompt(rawResponse: string, brandNames: string[]): string {
  const brandList = brandNames.map((b, i) => `${i + 1}. ${b}`).join("\n");
  const truncated = rawResponse.length > 4000 ? `${rawResponse.slice(0, 4000)}…` : rawResponse;

  return `You are a ranking extraction classifier. Given an LLM response that discusses several brands, infer the ranking each brand receives as a recommendation.

For each brand listed below, return:
- rank: an integer 1..N where 1 = top recommendation. If the response does not rank the brand (mere mention, comparison, warning, neutral), return rank: null.
- confidence: 0.0 to 1.0

Rules:
- If the response contains an explicit numbered list "1. A 2. B 3. C", honor those numbers.
- If the response uses ordering language ("first choice", "primarily I'd recommend X, then Y"), infer the ranking.
- If the brand is mentioned only as a counter-example or warning, return rank: null.
- Multi-language aware (Spanish, English, etc).

Brands to rank:
${brandList}

LLM response to analyze:
"""
${truncated}
"""

Return ONLY valid JSON in this exact format (no markdown, no commentary):
{
  "results": [
    {"brand": "BrandName", "rank": 1, "confidence": 0.9}
  ]
}`;
}

export async function analyzePositionBatch(
  rawResponse: string,
  brandNames: string[]
): Promise<PositionResult[]> {
  if (brandNames.length === 0) return [];

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. Position LLM analyzer requiere OpenRouter."
    );
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
    },
    body: JSON.stringify({
      model: POSITION_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a precise ranking extraction JSON API. Return only valid JSON.",
        },
        { role: "user", content: buildPrompt(rawResponse, brandNames) },
      ],
      max_tokens: 600,
      temperature: 0.0,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter position error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Position LLM returned non-JSON: ${content.slice(0, 200)}`);
  }

  const validated = PositionResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Position LLM JSON invalid: ${validated.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  const requestedSet = new Set(brandNames.map((b) => b.toLowerCase()));
  return validated.data.results
    .filter((r) => requestedSet.has(r.brand.toLowerCase()))
    .map((r) => ({
      brandName: r.brand,
      rank: r.rank,
      confidence: Math.round(r.confidence * 100) / 100,
    }));
}
