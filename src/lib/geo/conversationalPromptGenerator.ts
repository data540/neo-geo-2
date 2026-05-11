import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { GeoResearchInput, PromptCandidate } from "@/types";
import { PROMPT_GENERATOR_TEMPLATE } from "./masterPrompts";

const candidateSchema = z.object({
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

function getMockCandidates(input: GeoResearchInput): PromptCandidate[] {
  const { brandName, category, location, country, numberOfPrompts } = input;
  const loc = location || country;

  const examples = [
    {
      prompt: `¿Cuáles son las mejores opciones en ${loc} para ${category}?`,
      intent: "discovery" as const,
      funnel_stage: "top" as const,
      persona: "Usuario que empieza a investigar opciones",
      includes_brand: false,
      strategic_value: 8,
      priority_score: 80,
      reason: "Prompt de descubrimiento sin marca con alta demanda",
      coverage_area: "discovery-generic",
    },
    {
      prompt: `¿Qué opiniones hay sobre ${brandName}? ¿Vale la pena?`,
      intent: "reputation" as const,
      funnel_stage: "middle" as const,
      persona: "Usuario en fase de evaluación que ya conoce la marca",
      includes_brand: true,
      strategic_value: 9,
      priority_score: 85,
      reason: "Prompt reputacional con marca que mide sentiment directo",
      coverage_area: "reputation-branded",
    },
    {
      prompt: `Compara las principales opciones de ${category} en ${loc} y dime cuál es mejor`,
      intent: "comparison" as const,
      funnel_stage: "middle" as const,
      persona: "Usuario en fase de comparación entre alternativas",
      includes_brand: false,
      strategic_value: 9,
      priority_score: 90,
      reason: "Prompt comparativo de alta intención de conversión",
      coverage_area: "comparison-generic",
    },
    {
      prompt: `¿Qué debo tener en cuenta al elegir entre distintas opciones de ${category} en ${loc}?`,
      intent: "decision" as const,
      funnel_stage: "middle" as const,
      persona: "Usuario buscando criterios de decisión",
      includes_brand: false,
      strategic_value: 7,
      priority_score: 70,
      reason: "Prompt de criterios de decisión sin marca",
      coverage_area: "decision-criteria",
    },
    {
      prompt: `¿Merece la pena ${brandName} si quiero resultados profesionales?`,
      intent: "branded" as const,
      funnel_stage: "bottom" as const,
      persona: "Usuario a punto de decidir",
      includes_brand: true,
      strategic_value: 10,
      priority_score: 88,
      reason: "Prompt bottom-funnel con marca para medir visibilidad de decisión",
      coverage_area: "branded-decision",
    },
    {
      prompt: `¿Qué precio tienen las opciones de ${category} en ${loc} y cuál tiene mejor relación calidad-precio?`,
      intent: "price" as const,
      funnel_stage: "middle" as const,
      persona: "Usuario con criterio económico como prioridad",
      includes_brand: false,
      strategic_value: 7,
      priority_score: 72,
      reason: "Prompt de precio que revela competencia en valor",
      coverage_area: "price-value",
    },
    {
      prompt: `¿Cuáles son las salidas profesionales después de elegir un servicio de ${category}?`,
      intent: "employability" as const,
      funnel_stage: "top" as const,
      persona: "Usuario que prioriza resultados laborales o profesionales",
      includes_brand: false,
      strategic_value: 6,
      priority_score: 65,
      reason: "Prompt de empleabilidad sin marca",
      coverage_area: "employability",
    },
    {
      prompt: `Busco ${category} en ${loc}, ¿dónde puedo encontrar la mejor opción cerca del centro?`,
      intent: "local" as const,
      funnel_stage: "top" as const,
      persona: "Usuario con criterio geográfico",
      includes_brand: false,
      strategic_value: 6,
      priority_score: 60,
      reason: "Prompt local que mide visibilidad geográfica",
      coverage_area: "local-search",
    },
    {
      prompt: `Soy padre/madre y busco ${category} de calidad en ${loc} para mi hijo/a, ¿qué opciones recomiendas?`,
      intent: "decision" as const,
      funnel_stage: "middle" as const,
      persona: "Padre o madre con rol de decisor",
      includes_brand: false,
      strategic_value: 8,
      priority_score: 75,
      reason: "Prompt con perfil de decisor familiar, alta conversión",
      coverage_area: "persona-parent",
    },
    {
      prompt: `¿Qué diferencia a ${brandName} de otras opciones similares en el mercado?`,
      intent: "comparison" as const,
      funnel_stage: "middle" as const,
      persona: "Usuario evaluando diferenciadores de la marca",
      includes_brand: true,
      includes_competitor: true,
      strategic_value: 9,
      priority_score: 82,
      reason: "Prompt comparativo con marca que mide diferenciación",
      coverage_area: "branded-comparison",
    },
  ];

  const count = Math.min(numberOfPrompts, examples.length);
  const selected = examples.slice(0, count);

  return selected.map((ex, i) => ({
    id: `mock-${i}`,
    workspace_id: "",
    session_id: "",
    country,
    includes_competitor: false,
    conversion_intent: null,
    ai_search_likelihood: null,
    priority_rank: null,
    risk_if_brand_absent: null,
    tags: [],
    selected: true,
    activated: false,
    created_at: new Date().toISOString(),
    ...ex,
  }));
}

export async function generatePromptCandidates(
  input: GeoResearchInput
): Promise<PromptCandidate[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getMockCandidates(input);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const promptText = buildPrompt(input);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: promptText }],
  });

  const firstContent = response.content[0];
  const rawText = firstContent?.type === "text" ? firstContent.text : "[]";

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return getMockCandidates(input);

  const parsed = JSON.parse(jsonMatch[0]) as unknown[];
  const candidates: PromptCandidate[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const result = candidateSchema.safeParse(item);
    if (result.success) {
      candidates.push({
        id: `gen-${i}`,
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

  return candidates.length > 0 ? candidates : getMockCandidates(input);
}
