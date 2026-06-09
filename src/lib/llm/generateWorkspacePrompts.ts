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

  return `Eres un experto en GEO (Generative Engine Optimization) y análisis competitivo en LLMs.

Tu tarea: generar exactamente ${count} prompts en español que un usuario realista escribiría en ChatGPT, Claude, Gemini o Perplexity al investigar o comparar opciones, donde la marca "${brandName}" debería poder aparecer como respuesta.

## Contexto de la marca
- Nombre: ${brandName}
- Dominio: ${domain || "(no disponible)"}
- Descripción: ${brandStatement || "(no disponible)"}
- Mercado principal: ${countryLabel}

## Reglas de los prompts
1. Distribución por intent (aproximada):
   - 30% discovery (sin nombrar la marca) — el usuario explora opciones
   - 25% comparison — comparar marcas, precios, servicios
   - 20% branded — preguntas directas sobre ${brandName}
   - 15% decision/conversion — el usuario está cerca de decidir
   - 10% reputation/post-venta — opiniones, quejas, reclamaciones
2. Cubrir funnel: top (descubrimiento), middle (comparación), bottom (decisión).
3. Adapta los prompts al mercado y contexto de la marca en ${countryLabel}.
4. Tono natural, como si los escribiera un usuario real. Sin jerga corporativa.
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

export async function generateWorkspacePrompts(args: GenerateArgs): Promise<string[]> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!openRouterKey) {
    throw new Error(
      "OPENROUTER_API_KEY no está configurada. generateWorkspacePrompts requiere OpenRouter — no hay fallback a heurística."
    );
  }

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
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("OpenRouter devolvió una respuesta vacía al generar prompts de workspace.");
  }

  const jsonStr = extractJson(text);
  const parsed = promptsSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success) {
    throw new Error(
      `JSON inválido en la respuesta de OpenRouter: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`
    );
  }

  return parsed.data.prompts.slice(0, args.count);
}
