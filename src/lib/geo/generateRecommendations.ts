import type { GeoRecommendation, RetrievedChunk } from "@/types";

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
  chunks: RetrievedChunk[];
}

const SYSTEM_PROMPT = `Eres un experto senior en GEO (Generative Engine Optimization) — el posicionamiento de marcas en motores de búsqueda basados en IA como ChatGPT, Gemini, Claude y Perplexity.

Tu tarea es analizar los datos de rendimiento de una marca en LLMs y generar recomendaciones accionables y específicas, fundamentadas en la base de conocimiento experta que se te proporciona en el contexto.

Reglas estrictas:
1. **Cada recomendación debe estar respaldada por al menos una fuente** de la base de conocimiento (campo "sources" con los slugs source_file).
2. **No inventes tácticas**: si la base de conocimiento no cubre un tema, no des recomendaciones especulativas sobre ese tema.
3. **Sé específico**: usa los números reales del workspace (SOV, posición, etc.) en las descripciones.
4. **Acciones concretas**: cada actionItem debe ser ejecutable en <2 semanas. Nada de "mejora tu SEO" — di exactamente qué hacer.
5. **Devuelve SOLO un array JSON válido**. Sin texto adicional, sin markdown, solo el JSON.`;

function buildPrompt(input: GenerateInput): string {
  const { workspace: w, chunks } = input;

  const knowledgeBlock =
    chunks.length === 0
      ? "(No se encontraron fragmentos relevantes en la base de conocimiento. Genera recomendaciones generales basadas solo en las métricas.)"
      : chunks
          .map((c, idx) => {
            const breadcrumb =
              c.headingPath.length > 0
                ? `${c.sourceTitle} › ${c.headingPath.join(" › ")}`
                : c.sourceTitle;
            return `### Fuente [${idx + 1}] · ${breadcrumb}\n**source_file:** \`${c.sourceFile}\`\n\n${c.content}`;
          })
          .join("\n\n---\n\n");

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

# Base de conocimiento experta (extractos relevantes)

${knowledgeBlock}

---

# Instrucciones

Analiza los datos anteriores y genera entre 3 y 6 recomendaciones personalizadas y accionables para mejorar el posicionamiento GEO de esta marca.

Cada recomendación debe incluir:
- **title**: título corto y directo (máx 10 palabras)
- **description**: explicación en 2-3 frases usando los datos reales del workspace
- **priority**: "high" | "medium" | "low"
- **category**: "visibility" | "content" | "prompts" | "consistency" | "sources"
- **actionItems**: array de 3-5 acciones concretas y específicas
- **sources**: array de slugs source_file de las fuentes que respaldan esta recomendación (ej: ["${chunks[0]?.sourceFile ?? "ejemplo.md"}"]). Mínimo 1 fuente por recomendación.

Devuelve SOLO el JSON, sin explicaciones adicionales:
[
  {
    "title": "...",
    "description": "...",
    "priority": "high",
    "category": "visibility",
    "actionItems": ["...", "..."],
    "sources": ["..."]
  }
]`;
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function generateRecommendations(input: GenerateInput): Promise<GeoRecommendation[]> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. La generación de recomendaciones requiere OpenRouter — no hay fallback a mock."
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
      model: "anthropic/claude-3.5-haiku",
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const rawText = data.choices?.[0]?.message?.content ?? "[]";

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(
      "OpenRouter no devolvió un array JSON válido en la respuesta de recomendaciones."
    );
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeoRecommendation[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("La respuesta del modelo no contiene recomendaciones válidas.");
  }

  const validSources = new Set(input.chunks.map((c) => c.sourceFile));
  return parsed.map((rec) => ({
    ...rec,
    sources: Array.isArray(rec.sources)
      ? rec.sources.filter((s) => typeof s === "string" && validSources.has(s))
      : [],
  }));
}
