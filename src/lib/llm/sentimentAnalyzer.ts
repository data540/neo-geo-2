import { z } from "zod";

export interface SentimentResult {
  brandName: string;
  score: number;
  label: "positive" | "neutral" | "negative";
  confidence: number;
  reason: string;
}

const SENTIMENT_MODEL = process.env.OPENROUTER_MODEL_SENTIMENT?.trim() || "openai/gpt-4o-mini";

const SentimentItemSchema = z.object({
  brand: z.string().min(1),
  score: z.number().min(-1).max(1),
  label: z.enum(["positive", "neutral", "negative"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

const SentimentResponseSchema = z.object({
  results: z.array(SentimentItemSchema),
});

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function buildPrompt(rawResponse: string, brandNames: string[]): string {
  const brandList = brandNames.map((b, i) => `${i + 1}. ${b}`).join("\n");
  const truncated = rawResponse.length > 4000 ? `${rawResponse.slice(0, 4000)}…` : rawResponse;

  return `You are a sentiment analysis classifier. Analyze how the following LLM response talks about each listed brand.

For each brand, return:
- score: a number from -1.0 (very negative) to +1.0 (very positive), 0.0 if neutral or not discussed
- label: "positive" | "neutral" | "negative"
- confidence: 0.0 to 1.0 (your confidence in the assessment)
- reason: a brief explanation in 10 words or less

Consider tone, context, sarcasm, intensifiers ("very good"), negators ("not great"), comparisons, and warnings. Multi-language aware (Spanish, English, etc).

Brands to analyze:
${brandList}

LLM response to analyze:
"""
${truncated}
"""

Return ONLY valid JSON in this exact format (no markdown, no commentary):
{
  "results": [
    {"brand": "BrandName", "score": 0.7, "label": "positive", "confidence": 0.9, "reason": "recommended as best option"}
  ]
}`;
}

export async function analyzeSentimentBatch(
  rawResponse: string,
  brandNames: string[]
): Promise<SentimentResult[]> {
  if (brandNames.length === 0) return [];

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. Sentiment LLM analyzer requiere OpenRouter."
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
      model: SENTIMENT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a precise sentiment analysis JSON API. Return only valid JSON.",
        },
        { role: "user", content: buildPrompt(rawResponse, brandNames) },
      ],
      max_tokens: 400,
      temperature: 0.0,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter sentiment error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Sentiment LLM returned non-JSON: ${content.slice(0, 200)}`);
  }

  const validated = SentimentResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Sentiment LLM JSON invalid: ${validated.error.issues.map((i) => i.message).join(", ")}`
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
    }));
}
