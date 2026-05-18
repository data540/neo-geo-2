import type { GeoRecommendation, RecommendationGuide } from "@/types";

interface WorkspaceMetricsSummary {
  brandName: string;
  sector: string;
  country: string;
  visibilityPct: number | null;
  avgPosition: number | null;
  consistencyPct: number | null;
  brandMentionsCount: number;
  activePromptsCount: number;
  topFunnelPct: number;
  midFunnelPct: number;
  bottomFunnelPct: number;
  lowSovPromptsCount: number;
  sourcesCount: number;
}

interface GenerateInput {
  workspace: WorkspaceMetricsSummary;
  guides: RecommendationGuide[];
}

function getMockRecommendations(w: WorkspaceMetricsSummary): GeoRecommendation[] {
  const recs: GeoRecommendation[] = [];

  if (w.visibilityPct !== null && w.visibilityPct < 30) {
    recs.push({
      title: "Visibilidad crítica: tu marca aparece en menos del 30% de consultas",
      description: `Tu Share of Voice actual es ${w.visibilityPct}%. Los LLMs no asocian tu marca de forma sólida a tu categoría. Necesitas ampliar tu presencia en fuentes de autoridad externas.`,
      priority: "high",
      category: "visibility",
      actionItems: [
        "Verifica si tienes artículo propio en Wikipedia o menciones en artículos del sector",
        "Publica notas de prensa en medios especializados del sector",
        "Aumenta el número de prompts monitorizados para tener datos más representativos",
        "Revisa si tu nombre de marca es ambiguo o se confunde con otra entidad",
      ],
    });
  }

  if (w.consistencyPct !== null && w.consistencyPct < 50) {
    recs.push({
      title: "Baja consistencia: los LLMs responden de forma variable sobre tu marca",
      description: `Solo el ${w.consistencyPct}% de tus prompts tienen consistencia alta. Esto indica que los LLMs tienen información contradictoria o insuficiente sobre tu marca.`,
      priority: "high",
      category: "consistency",
      actionItems: [
        "Define 2-3 frases ancla que describan tu marca de forma única y repítelas en todas tus fuentes web",
        "Responde a las reseñas negativas con mensajes estructurados que refuercen tus puntos fuertes",
        "Publica casos de uso reales con datos concretos en tu web corporativa",
        "Revisa si hay información contradictoria entre tu web, redes sociales y medios",
      ],
    });
  }

  if (w.avgPosition !== null && w.avgPosition > 3) {
    recs.push({
      title: "Posición media elevada: apareces pero en lugares secundarios",
      description: `Tu posición media es ${w.avgPosition}. Los LLMs te mencionan pero no como primera opción. Necesitas reforzar tu asociación a los criterios de búsqueda más relevantes.`,
      priority: "medium",
      category: "content",
      actionItems: [
        "Crea páginas de contenido comparativo donde tu marca salga bien posicionada",
        "Publica datos cuantitativos únicos (puntualidad, satisfacción, cobertura de rutas) con fuentes",
        "Optimiza tus páginas FAQ para responder directamente a las preguntas del sector",
        "Aumenta las menciones en fuentes de alta autoridad (medios, informes del sector)",
      ],
    });
  }

  if (w.topFunnelPct < 20) {
    recs.push({
      title: "Cobertura insuficiente en prompts de descubrimiento (top funnel)",
      description: `Solo el ${w.topFunnelPct}% de tus prompts cubren el top del embudo. No estás midiendo si los usuarios te descubren cuando no buscan tu marca directamente.`,
      priority: "medium",
      category: "prompts",
      actionItems: [
        "Añade prompts genéricos de descubrimiento sin mención de marca",
        "Incluye preguntas del tipo '¿cuáles son las mejores opciones para...' en tu categoría",
        "Crea prompts por región geográfica donde operas",
        "Monitoriza prompts de comparación directa con tus principales competidores",
      ],
    });
  }

  if (w.sourcesCount === 0) {
    recs.push({
      title: "Tu dominio no está siendo citado por los LLMs con búsqueda web",
      description: "Ningún prompt ha generado una citación de tu dominio. Los LLMs con acceso a web (Perplexity, SearchGPT) no están usando tu web como fuente.",
      priority: "medium",
      category: "sources",
      actionItems: [
        "Verifica que tu web no bloquea GPTBot, PerplexityBot ni Google-Extended en robots.txt",
        "Crea páginas de contenido específico para cada consulta relevante de tu sector",
        "Asegúrate de que tu web carga rápido y el contenido es accesible sin JavaScript",
        "Publica contenido con datos únicos que solo tú tienes (informes, estadísticas propias)",
      ],
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: "Métricas estables: mantén el ritmo y optimiza en detalle",
      description: "Tus métricas están en rangos aceptables. El siguiente nivel es optimización fina: mejorar posición media, aumentar cobertura de prompts y diversificar fuentes.",
      priority: "low",
      category: "visibility",
      actionItems: [
        "Revisa el set de prompts cada 3 meses para mantener relevancia",
        "Amplía la cobertura de LLMs habilitando más proveedores en Settings",
        "Analiza los prompts donde no apareces y crea contenido específico para esos casos",
        "Monitoriza la evolución de tus competidores en los mismos prompts",
      ],
    });
  }

  return recs;
}

const SYSTEM_PROMPT = `Eres un experto en GEO (Generative Engine Optimization) — el posicionamiento de marcas en motores de búsqueda basados en IA como ChatGPT, Gemini, Claude y Perplexity.

Tu tarea es analizar los datos de rendimiento de una marca en LLMs y generar recomendaciones accionables y específicas para mejorar su visibilidad, consistencia y posicionamiento.

Devuelve SOLO un array JSON válido de recomendaciones. Sin texto adicional, sin markdown, solo el JSON.`;

function buildPrompt(input: GenerateInput): string {
  const { workspace: w, guides } = input;

  const guidesText = guides
    .map((g) => `### ${g.title}\n${g.content.slice(0, 800)}`)
    .join("\n\n");

  return `# Datos del workspace

Marca: ${w.brandName}
Sector: ${w.sector}
País: ${w.country}

## Métricas actuales (últimos 7 días)
- Visibilidad (SOV): ${w.visibilityPct !== null ? `${w.visibilityPct}%` : "sin datos"}
- Posición media: ${w.avgPosition !== null ? w.avgPosition : "sin datos"}
- Consistencia: ${w.consistencyPct !== null ? `${w.consistencyPct}%` : "sin datos"}
- Menciones de marca: ${w.brandMentionsCount}
- Prompts activos: ${w.activePromptsCount}
- Cobertura top-funnel: ${w.topFunnelPct}%
- Cobertura mid-funnel: ${w.midFunnelPct}%
- Cobertura bottom-funnel: ${w.bottomFunnelPct}%
- Prompts con SOV bajo (<30%): ${w.lowSovPromptsCount}
- Dominios citados por LLMs: ${w.sourcesCount}

---

# Base de conocimiento GEO

${guidesText}

---

# Instrucciones

Analiza los datos anteriores y genera entre 3 y 6 recomendaciones personalizadas y accionables para mejorar el posicionamiento GEO de esta marca.

Cada recomendación debe incluir:
- title: título corto y directo (máx 10 palabras)
- description: explicación en 2-3 frases usando los datos reales del workspace
- priority: "high" | "medium" | "low"
- category: "visibility" | "content" | "prompts" | "consistency" | "sources"
- actionItems: array de 3-5 acciones concretas y específicas

Devuelve SOLO el JSON, sin explicaciones adicionales:
[
  {
    "title": "...",
    "description": "...",
    "priority": "high",
    "category": "visibility",
    "actionItems": ["...", "..."]
  }
]`;
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function generateRecommendations(input: GenerateInput): Promise<GeoRecommendation[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    return getMockRecommendations(input.workspace);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        max_tokens: 2048,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(input) },
        ],
      }),
    });

    if (!response.ok) return getMockRecommendations(input.workspace);

    const data = (await response.json()) as OpenRouterResponse;
    const rawText = data.choices?.[0]?.message?.content ?? "[]";

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return getMockRecommendations(input.workspace);

    const parsed = JSON.parse(jsonMatch[0]) as GeoRecommendation[];
    if (!Array.isArray(parsed) || parsed.length === 0) return getMockRecommendations(input.workspace);

    return parsed;
  } catch {
    return getMockRecommendations(input.workspace);
  }
}
