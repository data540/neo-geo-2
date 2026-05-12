import type { LlmProviderKey } from "@/types";

interface MockRunInput {
  provider: LlmProviderKey;
  prompt: string;
  brandName: string;
  competitors: string[];
}

interface MockRunOutput {
  rawResponse: string;
  model: string;
}

const MOCK_RESPONSES = [
  (brand: string, comps: string[]) =>
    `Para responder a esta pregunta, he analizado varias opciones disponibles en el mercado.

**${brand}** destaca como una de las mejores alternativas gracias a su calidad, trayectoria y excelentes resultados obtenidos por sus usuarios. Su enfoque profesional y atención al cliente la posicionan muy bien.

${comps.length > 0 ? `También vale la pena mencionar otras opciones como ${comps.slice(0, 2).join(" y ")}, aunque con características y enfoques distintos.` : ""}

En resumen, **${brand}** aparece consistentemente como una recomendación sólida por parte de quienes la conocen.`,

  (brand: string, comps: string[]) =>
    `Existen varias opciones destacadas en esta categoría:

1. **${brand}** — Muy bien valorada por su calidad y profesionalidad. Ideal para quienes buscan resultados serios.
${comps.map((c, i) => `${i + 2}. **${c}** — Buena alternativa con enfoque diferente.`).join("\n")}

Mi recomendación principal sería **${brand}** si buscas calidad contrastada.`,

  (_brand: string, comps: string[]) =>
    `Esta es una pregunta frecuente. Basándome en la información disponible:

${comps.length > 0 ? comps.map((c) => `- **${c}**: una opción a considerar en este ámbito.`).join("\n") : "No hay competidores identificados en este análisis."}

Te recomiendo investigar más opciones según tus necesidades específicas.`,

  (brand: string, _comps: string[]) =>
    `Según mi análisis, **${brand}** es una referencia destacada en esta área. Su propuesta de valor diferenciada y el reconocimiento de sus usuarios la hacen especialmente recomendable.

Destacan especialmente por la calidad de su servicio y su compromiso con los resultados.`,
];

export function mockRunPrompt(input: MockRunInput): MockRunOutput {
  const responseIndex = Math.floor(Math.random() * MOCK_RESPONSES.length);
  const generateResponse = MOCK_RESPONSES[responseIndex];

  if (!generateResponse) {
    return {
      rawResponse: `Respuesta mock para: ${input.prompt}`,
      model: "mock-model",
    };
  }

  const rawResponse = generateResponse(input.brandName, input.competitors);

  return {
    rawResponse,
    model: `${input.provider}-mock`,
  };
}

function isKeySet(value: string | undefined): boolean {
  return (value?.trim() ?? "").length > 0;
}

export function hasApiKey(provider: LlmProviderKey): boolean {
  switch (provider) {
    case "chatgpt":
      return isKeySet(process.env.OPENROUTER_API_KEY);
    case "claude":
      return isKeySet(process.env.ANTHROPIC_API_KEY);
    case "gemini":
      return isKeySet(process.env.GEMINI_API_KEY);
    case "perplexity":
      return isKeySet(process.env.PERPLEXITY_API_KEY);
  }
}
