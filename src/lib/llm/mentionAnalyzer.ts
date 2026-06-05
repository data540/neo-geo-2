import { z } from "zod";

// Analizador combinado: en UNA sola llamada a OpenRouter obtiene el sentiment y
// el ranking de cada marca. Sustituye a las dos llamadas separadas
// (sentimentAnalyzer + positionAnalyzer) en el pipeline de ejecución de prompts,
// reduciendo de 3 a 2 llamadas LLM por prompt_run.

export interface MentionAnalysis {
  brandName: string;
  score: number;
  label: "positive" | "neutral" | "negative";
  confidence: number;
  reason: string;
  rank: number | null;
}

// Por defecto gpt-4o-mini (barato y suficiente). Override con OPENROUTER_MODEL_ANALYSIS.
const ANALYSIS_MODEL = process.env.OPENROUTER_MODEL_ANALYSIS?.trim() || "openai/gpt-4o-mini";

const MentionItemSchema = z.object({
  brand: z.string().min(1),
  score: z.number().min(-1).max(1),
  label: z.enum(["positive", "neutral", "negative"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
  rank: z.number().int().min(1).max(50).nullable(),
});

const MentionResponseSchema = z.object({
  results: z.array(MentionItemSchema),
});

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function buildPrompt(rawResponse: string, brandNames: string[]): string {
  const brandList = brandNames.map((b, i) => `${i + 1}. ${b}`).join("\n");
  const truncated = rawResponse.length > 4000 ? `${rawResponse.slice(0, 4000)}…` : rawResponse;

  return `You analyze how an LLM response talks about a set of brands. For each brand return BOTH its sentiment and its recommendation ranking.

For each brand, return:
- score: number from -1.0 (very negative) to +1.0 (very positive), 0.0 if neutral or not discussed
- label: "positive" | "neutral" | "negative"
- confidence: 0.0 to 1.0 (your confidence in the sentiment assessment)
- reason: brief explanation in 10 words or less
- rank: integer 1..N where 1 = top recommendation. Return null if the response does not rank the brand (mere mention, comparison, warning, neutral).

Ranking rules:
- If the response has an explicit numbered list "1. A 2. B 3. C", honor those numbers.
- If it uses ordering language ("first choice", "primarily X, then Y"), infer the ranking.
- If the brand appears only as a counter-example or warning, rank: null.

Consider tone, context, sarcasm, intensifiers ("very good"), negators ("not great"), comparisons and warnings. Multi-language aware (Spanish, English, etc).

Brands to analyze:
${brandList}

LLM response to analyze:
"""
${truncated}
"""

Return ONLY valid JSON in this exact format (no markdown, no commentary):
{
  "results": [
    {"brand": "BrandName", "score": 0.7, "label": "positive", "confidence": 0.9, "reason": "recommended as best option", "rank": 1}
  ]
}`;
}

export async function analyzeMentionsBatch(
  rawResponse: string,
  brandNames: string[]
): Promise<MentionAnalysis[]> {
  if (brandNames.length === 0) return [];

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. El analizador de menciones requiere OpenRouter."
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
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a precise brand sentiment + ranking analysis JSON API. Return only valid JSON.",
        },
        { role: "user", content: buildPrompt(rawResponse, brandNames) },
      ],
      max_tokens: 700,
      temperature: 0.0,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter mention analysis error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Mention analysis LLM returned non-JSON: ${content.slice(0, 200)}`);
  }

  const validated = MentionResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Mention analysis JSON invalid: ${validated.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  const requestedSet = new Set(brandNames.map((b) => b.toLowerCase()));
  return validated.data.results
    .filter((r) => requestedSet.has(r.brand.toLowerCase()))
    .map((r) => ({
      brandName: r.brand,
      score: Math.round(r.score * 100) / 100,
      label: r.label,
      confidence: Math.round(r.confidence * 100) / 100,
      reason: r.reason,
      rank: r.rank,
    }));
}
