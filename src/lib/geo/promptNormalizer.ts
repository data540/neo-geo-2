import { z } from "zod";
import type { PromptCandidate, RetrievedChunk } from "@/types";
import { candidateSchema } from "./conversationalPromptGenerator";
import { formatKnowledgeBlock } from "./promptResearchSkill";

const MODEL_NORMALIZER = "google/gemini-2.0-flash-001";
const MAX_RETRIES = 2;

const NORMALIZER_TEMPLATE = `Eres un editor experto en GEO (Generative Engine Optimization).
Recibes un array JSON de candidatos de prompts y debes:
1. Corregir gramática y ortografía (español natural, sin tildes forzadas).
2. Normalizar el campo "persona" a una descripción corta en español.
3. Asegurarte de que "includes_brand" sea true solo si el texto del prompt menciona explícitamente el nombre de la marca.
4. Mantener todos los demás campos intactos.
5. Devuelve SOLO el array JSON válido, sin texto adicional.

CANDIDATOS:
{{candidates_json}}
`;

async function callNormalizerWithRetry(promptText: string, attempt: number): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
    },
    body: JSON.stringify({
      model: MODEL_NORMALIZER,
      messages: [{ role: "user", content: promptText }],
      max_tokens: 8192,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Normalizer error attempt ${attempt} (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "[]";
}

function validateAndParseCandidates(
  raw: string,
  originals: PromptCandidate[]
): { valid: boolean; candidates: PromptCandidate[]; errors: string[] } {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return { valid: false, candidates: [], errors: ["No se encontró array JSON en el output"] };
  }

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonMatch[0]) as unknown[];
  } catch (e) {
    return { valid: false, candidates: [], errors: [`JSON inválido: ${String(e)}`] };
  }

  const errors: string[] = [];
  const candidates: PromptCandidate[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const result = candidateSchema.safeParse(parsed[i]);
    if (result.success) {
      const orig = originals[i];
      candidates.push({
        ...(orig ?? {}),
        prompt: result.data.prompt,
        intent: result.data.intent ?? orig?.intent ?? null,
        funnel_stage: result.data.funnel_stage ?? orig?.funnel_stage ?? null,
        persona: result.data.persona ?? orig?.persona ?? null,
        country: result.data.country ?? orig?.country ?? "ES",
        includes_brand: result.data.includes_brand,
        includes_competitor: result.data.includes_competitor,
        strategic_value: result.data.strategic_value ?? orig?.strategic_value ?? null,
        conversion_intent: result.data.conversion_intent ?? orig?.conversion_intent ?? null,
        ai_search_likelihood:
          result.data.ai_search_likelihood ?? orig?.ai_search_likelihood ?? null,
        priority_score: result.data.priority_score ?? orig?.priority_score ?? null,
        tags: result.data.tags ?? orig?.tags ?? [],
        reason: result.data.reason ?? orig?.reason ?? null,
        coverage_area: result.data.coverage_area ?? orig?.coverage_area ?? null,
      } as PromptCandidate);
    } else {
      errors.push(`Item ${i}: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
  }

  const valid = errors.length === 0 && candidates.length > 0;
  return { valid, candidates, errors };
}

export async function normalizeCandidates(
  candidates: PromptCandidate[],
  knowledgeChunks?: RetrievedChunk[]
): Promise<PromptCandidate[]> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. La normalización requiere OpenRouter — no hay fallback a mock."
    );
  }

  if (candidates.length === 0) {
    return candidates;
  }

  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      prompt: c.prompt,
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      persona: c.persona,
      country: c.country,
      includes_brand: c.includes_brand,
      includes_competitor: c.includes_competitor,
      strategic_value: c.strategic_value,
      conversion_intent: c.conversion_intent,
      ai_search_likelihood: c.ai_search_likelihood,
      priority_score: c.priority_score,
      tags: c.tags,
      reason: c.reason,
      coverage_area: c.coverage_area,
    }))
  );

  const knowledgeBlock = knowledgeChunks
    ? formatKnowledgeBlock(knowledgeChunks, "GUÍA DE NORMALIZACIÓN GEO")
    : "";

  let promptText =
    NORMALIZER_TEMPLATE.replace("{{candidates_json}}", candidatesJson) + knowledgeBlock;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callNormalizerWithRetry(promptText, attempt);
      const { valid, candidates: normalized, errors } = validateAndParseCandidates(raw, candidates);

      if (valid && normalized.length > 0) {
        return normalized;
      }

      lastErrors = errors;
      // Re-prompt con errores específicos
      promptText =
        NORMALIZER_TEMPLATE.replace("{{candidates_json}}", candidatesJson) +
        knowledgeBlock +
        `\n\n[CORRECCIÓN REQUERIDA - intento ${attempt + 1}]\nTu output anterior falló validación:\n${errors.join("\n")}\nDevuelve SOLO el array JSON estricto.`;
    } catch {
      // Continuar al siguiente intento
    }
  }

  console.error("[promptNormalizer] failed after retries:", lastErrors);
  // Fallback: devolver candidatos originales sin normalizar
  return candidates;
}
