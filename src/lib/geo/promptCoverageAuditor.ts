import Anthropic from "@anthropic-ai/sdk";
import type { CoverageAuditResult, PromptCandidate } from "@/types";
import { COVERAGE_AUDITOR_TEMPLATE } from "./masterPrompts";

interface AuditInput {
  brandName: string;
  category: string;
  country: string;
  targetAudience: string;
  competitors: string[];
  candidates: PromptCandidate[];
}

function getMockAuditResult(candidates: PromptCandidate[]): CoverageAuditResult {
  const brandedCount = candidates.filter((c) => c.includes_brand).length;
  const total = candidates.length;
  const brandedPercent = total > 0 ? (brandedCount / total) * 100 : 0;

  const gaps: string[] = [];
  if (brandedPercent > 40)
    gaps.push("Demasiados prompts con la marca (>40%). Añade más prompts genéricos sin marca.");
  if (!candidates.some((c) => c.intent === "comparison"))
    gaps.push("Faltan prompts comparativos entre opciones.");
  if (!candidates.some((c) => c.intent === "local"))
    gaps.push("Faltan prompts con criterio geográfico/local.");
  if (!candidates.some((c) => c.intent === "price"))
    gaps.push("Faltan prompts de precio y relación calidad-precio.");

  const score = Math.max(40, 100 - gaps.length * 15);

  return {
    coverageScore: score,
    mainGaps: gaps,
    duplicatedOrWeakPrompts: [],
    recommendedNewPrompts:
      gaps.length > 0 ? ["¿Qué alternativas existen en el mercado para esta categoría?"] : [],
    promptsToRemove: [],
    finalRecommendation:
      gaps.length === 0
        ? "El set tiene buena cobertura. Puedes proceder a priorizar y activar los prompts."
        : `El set tiene ${gaps.length} hueco(s) de cobertura. Considera añadir los tipos de prompts que faltan.`,
  };
}

export async function auditPromptCoverage(input: AuditInput): Promise<CoverageAuditResult> {
  if (!process.env.ANTHROPIC_API_KEY || input.candidates.length === 0) {
    return getMockAuditResult(input.candidates);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const promptsJson = JSON.stringify(
    input.candidates.map((c) => ({
      prompt: c.prompt,
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      includes_brand: c.includes_brand,
    }))
  );

  const promptText = COVERAGE_AUDITOR_TEMPLATE.replace("{{brand_name}}", input.brandName)
    .replace("{{category}}", input.category)
    .replace("{{country}}", input.country)
    .replace("{{target_audience}}", input.targetAudience)
    .replace("{{competitors}}", input.competitors.join(", "))
    .replace("{{prompts_json}}", promptsJson);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: promptText }],
  });

  const firstContent = response.content[0];
  const rawText = firstContent?.type === "text" ? firstContent.text : "{}";

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return getMockAuditResult(input.candidates);

  const parsed = JSON.parse(jsonMatch[0]) as Partial<CoverageAuditResult>;
  return {
    coverageScore: parsed.coverageScore ?? 50,
    mainGaps: parsed.mainGaps ?? [],
    duplicatedOrWeakPrompts: parsed.duplicatedOrWeakPrompts ?? [],
    recommendedNewPrompts: parsed.recommendedNewPrompts ?? [],
    promptsToRemove: parsed.promptsToRemove ?? [],
    finalRecommendation: parsed.finalRecommendation ?? "",
  };
}
