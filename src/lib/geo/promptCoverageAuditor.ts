import type { CoverageAuditResult, PromptCandidate, RetrievedChunk } from "@/types";
import { COVERAGE_AUDITOR_TEMPLATE } from "./masterPrompts";
import { formatKnowledgeBlock } from "./promptResearchSkill";

const MODEL_AUDITOR = "anthropic/claude-sonnet-4-5";
const MAX_RETRIES = 2;

interface AuditInput {
  brandName: string;
  category: string;
  country: string;
  targetAudience: string;
  competitors: string[];
  candidates: PromptCandidate[];
  knowledgeChunks?: RetrievedChunk[];
}

async function callAuditor(promptText: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
    },
    body: JSON.stringify({
      model: MODEL_AUDITOR,
      messages: [{ role: "user", content: promptText }],
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Auditor error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "{}";
}

function parseAuditResult(raw: string): CoverageAuditResult | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<CoverageAuditResult>;
    return {
      coverageScore: parsed.coverageScore ?? 50,
      mainGaps: parsed.mainGaps ?? [],
      duplicatedOrWeakPrompts: parsed.duplicatedOrWeakPrompts ?? [],
      recommendedNewPrompts: parsed.recommendedNewPrompts ?? [],
      promptsToRemove: parsed.promptsToRemove ?? [],
      finalRecommendation: parsed.finalRecommendation ?? "",
    };
  } catch {
    return null;
  }
}

export async function auditPromptCoverage(input: AuditInput): Promise<CoverageAuditResult> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. La auditoría de cobertura requiere OpenRouter — no hay fallback a mock."
    );
  }

  if (input.candidates.length === 0) {
    return {
      coverageScore: 0,
      mainGaps: [],
      duplicatedOrWeakPrompts: [],
      recommendedNewPrompts: [],
      promptsToRemove: [],
      finalRecommendation: "Sin candidatos para auditar.",
    };
  }

  const promptsJson = JSON.stringify(
    input.candidates.map((c) => ({
      prompt: c.prompt,
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      includes_brand: c.includes_brand,
    }))
  );

  const knowledgeBlock = input.knowledgeChunks
    ? formatKnowledgeBlock(input.knowledgeChunks, "GUÍA EXPERTA DE AUDITORÍA DE COBERTURA GEO")
    : "";

  const basePrompt =
    COVERAGE_AUDITOR_TEMPLATE.replace("{{brand_name}}", input.brandName)
      .replace("{{category}}", input.category)
      .replace("{{country}}", input.country)
      .replace("{{target_audience}}", input.targetAudience)
      .replace("{{competitors}}", input.competitors.join(", "))
      .replace("{{prompts_json}}", promptsJson) + knowledgeBlock;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const retryNote =
        attempt > 0
          ? `\n\n[CORRECCIÓN REQUERIDA - intento ${attempt}]\nDevuelve SOLO el objeto JSON estricto con coverageScore, mainGaps, duplicatedOrWeakPrompts, recommendedNewPrompts, promptsToRemove, finalRecommendation.`
          : "";

      const raw = await callAuditor(basePrompt + retryNote);
      const result = parseAuditResult(raw);
      if (result) return result;
    } catch {
      // Continuar al siguiente intento
    }
  }

  throw new Error(
    `Auditor (${MODEL_AUDITOR}) no devolvió un resultado válido tras ${MAX_RETRIES + 1} intentos.`
  );
}
