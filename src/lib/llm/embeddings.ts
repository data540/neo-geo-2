import OpenAI from "openai";

const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMS = 1536;

type EmbeddingInput = string | string[];

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
};

function getOpenRouterHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_NAME ?? "neo-geo",
  };
}

function extractEmbeddings(response: EmbeddingResponse): number[][] {
  const embeddings = response.data?.map((item) => item.embedding).filter(Boolean) as
    | number[][]
    | undefined;
  if (!embeddings || embeddings.length === 0) {
    throw new Error("Empty embedding response");
  }
  return embeddings;
}

async function createOpenRouterEmbeddings(
  input: EmbeddingInput,
  dimensions: number
): Promise<number[][]> {
  const model =
    process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || DEFAULT_OPENROUTER_EMBEDDING_MODEL;

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({ model, input, dimensions }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter embeddings error (${response.status}): ${body}`);
  }

  return extractEmbeddings((await response.json()) as EmbeddingResponse);
}

async function createOpenAiEmbeddings(input: EmbeddingInput, dimensions: number): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY_EMBEDDINGS || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("No OpenAI API key configured for embedding fallback");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_EMBEDDING_MODEL,
    input,
    dimensions,
  });

  return extractEmbeddings(response as EmbeddingResponse);
}

export async function createEmbeddings(
  input: EmbeddingInput,
  dimensions = DEFAULT_EMBEDDING_DIMS
): Promise<number[][]> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  let openRouterError: unknown;

  if (openRouterKey) {
    try {
      return await createOpenRouterEmbeddings(input, dimensions);
    } catch (err) {
      openRouterError = err;
      console.error("[embeddings] OpenRouter failed, falling back to OpenAI:", err);
    }
  }

  try {
    return await createOpenAiEmbeddings(input, dimensions);
  } catch (openAiError) {
    if (openRouterError) {
      throw new Error(
        `Embedding failed with OpenRouter and OpenAI fallback. OpenRouter: ${
          openRouterError instanceof Error ? openRouterError.message : String(openRouterError)
        }. OpenAI: ${openAiError instanceof Error ? openAiError.message : String(openAiError)}`
      );
    }
    throw openAiError;
  }
}

export async function createEmbedding(
  input: string,
  dimensions = DEFAULT_EMBEDDING_DIMS
): Promise<number[]> {
  const [embedding] = await createEmbeddings(input, dimensions);
  if (!embedding) throw new Error("Empty embedding response");
  return embedding;
}
