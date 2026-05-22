import type {
  PrioritizedPrompt,
  PromptCandidate,
  RetrievedChunk,
  RiskIfBrandAbsent,
} from "@/types";
import { PROMPT_PRIORITIZER_TEMPLATE } from "./masterPrompts";
import { formatKnowledgeBlock } from "./promptResearchSkill";

const MODEL_PRIORITIZER = "openai/gpt-4.1-mini";
const MAX_RETRIES = 2;

async function callPrioritizer(promptText: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
    },
    body: JSON.stringify({
      model: MODEL_PRIORITIZER,
      messages: [{ role: "user", content: promptText }],
      max_tokens: 2048,
      temperature: 0.15,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Prioritizer error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "[]";
}

function parsePrioritized(
  raw: string,
  limit: number,
  fallback: PromptCandidate[]
): PrioritizedPrompt[] | null {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      prompt?: string;
      priorityRank?: number;
      whySelected?: string;
      coverageArea?: string;
      riskIfBrandAbsent?: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    return parsed.slice(0, limit).map((item, i) => ({
      prompt: item.prompt ?? "",
      priorityRank: item.priorityRank ?? i + 1,
      whySelected: item.whySelected ?? "",
      coverageArea: item.coverageArea ?? "",
      riskIfBrandAbsent: (["low", "medium", "high"].includes(item.riskIfBrandAbsent ?? "")
        ? item.riskIfBrandAbsent
        : "medium") as RiskIfBrandAbsent,
    }));
  } catch {
    return null;
  }
}

export async function prioritizePrompts(
  candidates: PromptCandidate[],
  limit: number,
  knowledgeChunks?: RetrievedChunk[]
): Promise<PrioritizedPrompt[]> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. La priorización requiere OpenRouter — no hay fallback a mock."
    );
  }

  if (candidates.length === 0) {
    return [];
  }

  const knowledgeBlock = knowledgeChunks
    ? formatKnowledgeBlock(knowledgeChunks, "CRITERIOS EXPERTOS DE PRIORIZACIÓN GEO")
    : "";

  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      prompt: c.prompt,
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      persona: c.persona,
      includes_brand: c.includes_brand,
      includes_competitor: c.includes_competitor,
      strategic_value: c.strategic_value,
      conversion_intent: c.conversion_intent,
      ai_search_likelihood: c.ai_search_likelihood,
      priority_score: c.priority_score,
    }))
  );

  const basePrompt =
    PROMPT_PRIORITIZER_TEMPLATE.replace("{{limit}}", String(limit))
      .replace("{{candidates_json}}", candidatesJson)
      .replace("{{limit}}", String(limit)) + knowledgeBlock;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const retryNote =
        attempt > 0
          ? `\n\n[CORRECCIÓN REQUERIDA - intento ${attempt}]\nDevuelve SOLO el array JSON con exactamente estos campos: prompt, priorityRank, whySelected, coverageArea, riskIfBrandAbsent.`
          : "";

      const raw = await callPrioritizer(basePrompt + retryNote);
      const result = parsePrioritized(raw, limit, candidates);
      if (result) return result;
    } catch {
      // Continuar al siguiente intento
    }
  }

  throw new Error(
    `Prioritizer (${MODEL_PRIORITIZER}) no devolvió un resultado válido tras ${MAX_RETRIES + 1} intentos.`
  );
}
