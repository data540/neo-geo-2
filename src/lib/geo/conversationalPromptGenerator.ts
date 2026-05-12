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
  const { brandName, location, country, numberOfPrompts } = input;
  const loc = location || country;

  const examples = [
    {
      prompt: `Voy a volar desde ${loc}, ¿que aerolineas suelen ser mas puntuales y fiables?`,
      intent: "discovery" as const,
      funnel_stage: "top" as const,
      persona: "Pasajero que empieza a investigar opciones de vuelo",
      includes_brand: false,
      strategic_value: 8,
      priority_score: 80,
      reason: "Prompt de descubrimiento sin marca para comparar aerolineas por fiabilidad",
      coverage_area: "discovery-generic",
    },
    {
      prompt: `¿Que opiniones recientes hay sobre ${brandName} en vuelos nacionales por Espana?`,
      intent: "reputation" as const,
      funnel_stage: "middle" as const,
      persona: "Pasajero en fase de evaluacion que ya conoce la aerolinea",
      includes_brand: true,
      strategic_value: 9,
      priority_score: 85,
      reason: "Prompt reputacional con marca para medir confianza en rutas reales",
      coverage_area: "reputation-branded",
    },
    {
      prompt: `Compara las principales aerolineas para volar Madrid-Barcelona y dime cual conviene por puntualidad y equipaje`,
      intent: "comparison" as const,
      funnel_stage: "middle" as const,
      persona: "Pasajero comparando alternativas para una ruta frecuente",
      includes_brand: false,
      strategic_value: 9,
      priority_score: 90,
      reason: "Prompt comparativo con alta intencion de compra en ruta concreta",
      coverage_area: "comparison-generic",
    },
    {
      prompt: `Si necesito cambiar mi vuelo sin pagar mucho, ¿que tarifa o aerolinea me da mas flexibilidad?`,
      intent: "decision" as const,
      funnel_stage: "middle" as const,
      persona: "Pasajero que prioriza flexibilidad ante cambios",
      includes_brand: false,
      strategic_value: 7,
      priority_score: 70,
      reason: "Prompt de decision con criterio operativo claro",
      coverage_area: "decision-criteria",
    },
    {
      prompt: `¿Merece la pena ${brandName} para volar a Bogota desde Madrid con equipaje facturado?`,
      intent: "branded" as const,
      funnel_stage: "bottom" as const,
      persona: "Pasajero a punto de comprar un vuelo internacional",
      includes_brand: true,
      strategic_value: 10,
      priority_score: 88,
      reason: "Prompt bottom-funnel con marca para medir conversion en ruta ES-CO",
      coverage_area: "branded-decision",
    },
    {
      prompt: `¿Que aerolinea ofrece mejor relacion calidad-precio para volar de Barcelona a Medellin con una maleta?`,
      intent: "price" as const,
      funnel_stage: "middle" as const,
      persona: "Pasajero sensible a precio total incluyendo equipaje",
      includes_brand: false,
      strategic_value: 7,
      priority_score: 72,
      reason: "Prompt de precio que mide competitividad real puerta a puerta",
      coverage_area: "price-value",
    },
    {
      prompt: "Mi vuelo se cancelo hoy, ¿que pasos debo seguir para reembolso o reubicacion rapida?",
      intent: "product_specific" as const,
      funnel_stage: "top" as const,
      persona: "Pasajero afectado por una cancelacion con urgencia",
      includes_brand: false,
      strategic_value: 10,
      priority_score: 92,
      reason: "Prompt de incidencia critica muy frecuente en soporte aerolinea",
      coverage_area: "disruption-cancellation",
    },
    {
      prompt: `Llego tarde al aeropuerto en ${loc}, ¿hasta cuando puedo hacer check-in y embarcar sin perder el vuelo?`,
      intent: "local" as const,
      funnel_stage: "top" as const,
      persona: "Pasajero con urgencia operativa en aeropuerto",
      includes_brand: false,
      strategic_value: 9,
      priority_score: 86,
      reason: "Prompt local-operativo para medir visibilidad en situaciones reales",
      coverage_area: "local-airport-operations",
    },
    {
      prompt: "Viajo con un menor no acompanado entre Espana y Colombia, ¿que aerolineas gestionan mejor este servicio?",
      intent: "decision" as const,
      funnel_stage: "middle" as const,
      persona: "Padre o madre con necesidad especial de viaje",
      includes_brand: false,
      strategic_value: 8,
      priority_score: 75,
      reason: "Prompt de necesidad especial de alto valor para soporte",
      coverage_area: "persona-parent",
    },
    {
      prompt: `¿Que diferencia a ${brandName} de otras aerolineas en gestion de equipaje y compensaciones por demora?`,
      intent: "comparison" as const,
      funnel_stage: "middle" as const,
      persona: "Pasajero evaluando diferenciales de servicio postventa",
      includes_brand: true,
      includes_competitor: true,
      strategic_value: 9,
      priority_score: 82,
      reason: "Prompt comparativo de diferenciales operativos clave",
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
