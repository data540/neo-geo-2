import OpenAI from "openai";
import { z } from "zod";
import type { GeoResearchInput, PromptCandidate, RetrievedChunk } from "@/types";
import { PROMPT_GENERATOR_TEMPLATE } from "./masterPrompts";
import { formatKnowledgeBlock } from "./promptResearchSkill";

export const candidateSchema = z.object({
  prompt: z.string(),
  intent: z
    .enum([
      "discovery",
      "comparison",
      "reputation",
      "branded",
      "decision",
      "local",
      "price",
      "employability",
      "product_specific",
    ])
    .nullable()
    .optional(),
  funnel_stage: z.enum(["top", "middle", "bottom"]).nullable().optional(),
  persona: z.string().nullable().optional(),
  country: z.string().default("ES"),
  includes_brand: z.boolean().default(false),
  includes_competitor: z.boolean().default(false),
  strategic_value: z.number().nullable().optional(),
  conversion_intent: z.number().nullable().optional(),
  ai_search_likelihood: z.number().nullable().optional(),
  priority_score: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
  reason: z.string().nullable().optional(),
  coverage_area: z.string().nullable().optional(),
});

export type CandidateSchemaType = z.infer<typeof candidateSchema>;

// Modelos del pipeline propietario (vía OpenRouter)
const MODEL_VARIANT_A = "anthropic/claude-sonnet-4-5";
const MODEL_VARIANT_B = "openai/gpt-4.1-mini";
// Threshold cosine similarity para dedup
const DEDUP_SIMILARITY_THRESHOLD = 0.88;

function buildPrompt(input: GeoResearchInput): string {
  return PROMPT_GENERATOR_TEMPLATE.replace("{{brand_name}}", input.brandName)
    .replace("{{domain}}", input.domain || "")
    .replace("{{brand_statement}}", input.brandStatement || "")
    .replace("{{country}}", input.country)
    .replace("{{location}}", input.location || input.country)
    .replace("{{category}}", input.category)
    .replace("{{products_services}}", input.productsServices || "")
    .replace("{{target_audience}}", input.targetAudience || "")
    .replace("{{competitors}}", input.competitors.join(", ") || "Sin competidores específicos")
    .replace("{{differentiators}}", input.differentiators || "")
    .replace("{{number_of_prompts}}", String(input.numberOfPrompts));
}

async function callOpenRouter(
  model: string,
  promptText: string,
  temperature = 0.9,
  maxRetries = 2
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptText }],
        max_tokens: 4096,
        temperature,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      lastError = new Error(`OpenRouter error (${response.status}): ${body}`);
      continue;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "[]";
  }

  throw lastError ?? new Error("OpenRouter: max retries exceeded");
}

function parseCandidatesFromText(raw: string, prefix: string): PromptCandidate[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonMatch[0]) as unknown[];
  } catch {
    return [];
  }

  const candidates: PromptCandidate[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const result = candidateSchema.safeParse(parsed[i]);
    if (result.success) {
      candidates.push({
        id: `${prefix}-${i}`,
        workspace_id: "",
        session_id: "",
        prompt: result.data.prompt,
        intent: result.data.intent ?? null,
        funnel_stage: result.data.funnel_stage ?? null,
        persona: result.data.persona ?? null,
        country: result.data.country,
        includes_brand: result.data.includes_brand,
        includes_competitor: result.data.includes_competitor,
        strategic_value: result.data.strategic_value ?? null,
        conversion_intent: result.data.conversion_intent ?? null,
        ai_search_likelihood: result.data.ai_search_likelihood ?? null,
        priority_score: result.data.priority_score ?? null,
        priority_rank: null,
        reason: result.data.reason ?? null,
        coverage_area: result.data.coverage_area ?? null,
        risk_if_brand_absent: null,
        tags: result.data.tags,
        selected: true,
        activated: false,
        created_at: new Date().toISOString(),
      });
    }
  }
  return candidates;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function deduplicateByEmbedding(candidates: PromptCandidate[]): Promise<PromptCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY_EMBEDDINGS || process.env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) return candidates;

  const client = new OpenAI({ apiKey });
  const texts = candidates.map((c) => c.prompt);

  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
      dimensions: 1536,
    });
    const embeddings = response.data.map((d) => d.embedding);

    const kept: PromptCandidate[] = [];
    const keptEmbeddings: number[][] = [];

    for (let i = 0; i < candidates.length; i++) {
      const emb = embeddings[i];
      const candidate = candidates[i];
      if (!emb || !candidate) continue;
      let isDup = false;
      for (const keptEmb of keptEmbeddings) {
        if (cosineSimilarity(emb, keptEmb) >= DEDUP_SIMILARITY_THRESHOLD) {
          isDup = true;
          break;
        }
      }
      if (!isDup) {
        kept.push(candidate);
        keptEmbeddings.push(emb);
      }
    }
    return kept;
  } catch {
    // Si falla el embedding, devolvemos todos sin dedup
    return candidates;
  }
}

export async function generatePromptCandidates(
  input: GeoResearchInput,
  knowledgeChunks?: RetrievedChunk[]
): Promise<PromptCandidate[]> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. El pipeline GEO requiere OpenRouter — no hay fallback a mock."
    );
  }

  const knowledgeBlock = knowledgeChunks
    ? formatKnowledgeBlock(knowledgeChunks, "BASE DE CONOCIMIENTO EXPERTA GEO")
    : "";
  const promptText = buildPrompt(input) + knowledgeBlock;

  // Micro-ensemble: 2 variantes en paralelo con modelos distintos
  const [rawA, rawB] = await Promise.allSettled([
    callOpenRouter(MODEL_VARIANT_A, promptText, 0.9),
    callOpenRouter(MODEL_VARIANT_B, promptText, 0.8),
  ]);

  const candidatesA = rawA.status === "fulfilled" ? parseCandidatesFromText(rawA.value, "a") : [];
  const candidatesB = rawB.status === "fulfilled" ? parseCandidatesFromText(rawB.value, "b") : [];

  // Combinar: A primero (mayor creatividad), luego B para diversidad
  const combined = [...candidatesA, ...candidatesB];

  if (combined.length === 0) {
    const errorA = rawA.status === "rejected" ? String(rawA.reason) : "";
    const errorB = rawB.status === "rejected" ? String(rawB.reason) : "";
    throw new Error(
      `OpenRouter no devolvió candidatos en ninguna variante (${MODEL_VARIANT_A}, ${MODEL_VARIANT_B}). ${errorA} ${errorB}`.trim()
    );
  }

  // Dedup semántico por embedding
  const deduplicated = await deduplicateByEmbedding(combined);

  // Limitar al número solicitado
  return deduplicated.slice(0, input.numberOfPrompts * 2);
}
