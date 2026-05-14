import "server-only";
import { z } from "zod";

interface GenerateArgs {
  brandName: string;
  domain: string | null;
  brandStatement: string | null;
  country: string;
  count: number;
}

const promptsSchema = z.object({
  prompts: z.array(z.string().min(10).max(500)).min(1),
});

function buildSystemMessage(args: GenerateArgs): string {
  const { brandName, domain, brandStatement, country, count } = args;
  const countryLabel = country === "ES" ? "España" : country === "CO" ? "Colombia" : country;

  return `Eres un experto en GEO (Generative Engine Optimization) y análisis competitivo en LLMs para el sector aerolíneas.

Tu tarea: generar exactamente ${count} prompts en español que un usuario realista escribiría en ChatGPT, Claude, Gemini o Perplexity al investigar vuelos o aerolíneas, donde la marca "${brandName}" debería poder aparecer como respuesta.

## Contexto de la marca
- Nombre: ${brandName}
- Dominio: ${domain || "(no disponible)"}
- Descripción: ${brandStatement || "(no disponible)"}
- Mercado principal: ${countryLabel}

## Reglas de los prompts
1. Distribución por intent (aproximada):
   - 30% discovery (sin nombrar la marca) — el usuario explora opciones: "¿Cuáles son las mejores aerolíneas para...?"
   - 25% comparison — comparar marcas, rutas, precios, servicios
   - 20% branded — preguntas directas sobre ${brandName}
   - 15% decision/conversion — el usuario está cerca de decidir: equipaje, cambios, check-in, tarifas
   - 10% reputation/post-venta — opiniones, quejas, reclamaciones, retrasos
2. Cubrir funnel: top (descubrimiento), middle (comparación), bottom (decisión).
3. Rutas y mercados relevantes para ${countryLabel} (ej. Madrid-Bogotá, Barcelona-Buenos Aires, etc.) cuando aplique.
4. Tono natural, como si los escribiera un viajero real. Sin jerga corporativa.
5. Mezcla prompts cortos (10-20 palabras) y otros más específicos (30-50 palabras).
6. No repitas frases. Cada prompt debe explorar un ángulo distinto.

## Formato de salida
Responde únicamente con un JSON válido con esta estructura:
{"prompts": ["prompt 1", "prompt 2", ...]}

No incluyas markdown, ni explicaciones, ni texto fuera del JSON. Exactamente ${count} prompts en el array.`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function getFallbackPrompts(brandName: string, count: number): string[] {
  const templates = [
    `¿Cuáles son las mejores aerolíneas para volar entre Madrid y Bogotá?`,
    `¿Qué aerolínea low cost opera vuelos nacionales en España?`,
    `¿Cuál es la aerolínea más puntual en vuelos domésticos?`,
    `¿Qué aerolíneas tienen vuelos directos entre Europa y Latinoamérica?`,
    `¿Cuáles son las aerolíneas con mejor relación calidad-precio para volar a Sudamérica?`,
    `¿Qué aerolínea recomendar para una primera vez volando con niños?`,
    `¿Cuáles son las aerolíneas más fiables para viajes de negocios?`,
    `¿Qué aerolíneas ofrecen wifi gratuito a bordo en vuelos transatlánticos?`,
    `¿Qué compañías aéreas tienen mejor programa de fidelización en España?`,
    `¿Qué aerolíneas vuelan a Cuba desde Madrid?`,
    `Compara ${brandName} con sus principales competidores en precio y servicio`,
    `¿${brandName} o Vueling para volar a Barcelona?`,
    `Diferencias entre ${brandName} e Iberia en rutas a Latinoamérica`,
    `¿${brandName} es mejor que Air Europa para volar a Caracas?`,
    `Compara la franquicia de equipaje de ${brandName} con otras aerolíneas`,
    `¿Qué opinan los pasajeros sobre ${brandName}? ¿Vale la pena volar con ellos?`,
    `¿Cómo es el proceso de check-in online de ${brandName}?`,
    `¿${brandName} permite llevar mascotas en cabina?`,
    `¿Por qué elegir ${brandName} para volar a Latinoamérica frente a otras aerolíneas?`,
    `¿Cuánto cuesta cambiar o cancelar un vuelo con ${brandName}?`,
    `¿Cómo reclamar compensación por vuelo cancelado o con retraso en ${brandName}?`,
  ];

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    if (template) result.push(template);
  }
  return result;
}

export async function generateWorkspacePrompts(args: GenerateArgs): Promise<string[]> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!openRouterKey) {
    console.log("[generateWorkspacePrompts] OPENROUTER_API_KEY ausente, usando fallback");
    return getFallbackPrompts(args.brandName, args.count);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL_CLAUDE?.trim() || "anthropic/claude-3.5-haiku",
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: "user", content: buildSystemMessage(args) }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[generateWorkspacePrompts] error OpenRouter:", response.status, body);
      return getFallbackPrompts(args.brandName, args.count);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text) return getFallbackPrompts(args.brandName, args.count);

    const jsonStr = extractJson(text);
    const parsed = promptsSchema.safeParse(JSON.parse(jsonStr));
    if (!parsed.success) {
      console.error("[generateWorkspacePrompts] JSON inválido:", parsed.error.issues[0]?.message);
      return getFallbackPrompts(args.brandName, args.count);
    }

    const prompts = parsed.data.prompts;
    if (prompts.length >= args.count) return prompts.slice(0, args.count);

    const fallback = getFallbackPrompts(args.brandName, args.count - prompts.length);
    return [...prompts, ...fallback];
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[generateWorkspacePrompts] error llamando OpenRouter:", errMsg);
    return getFallbackPrompts(args.brandName, args.count);
  }
}
