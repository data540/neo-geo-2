import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type { RetrievedChunk } from "@/types";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const DEFAULT_TOP_K_PER_QUERY = 4;
const DEFAULT_TOTAL_CAP = 10;

export interface RetrievalMetricsInput {
  brandName: string;
  sector: string;
  country: string;
  visibilityPct: number | null;
  consistencyPct: number | null;
  avgPosition: number | null;
  brandMentionsCount: number;
  activePromptsCount: number;
  topFunnelPct: number;
  midFunnelPct: number;
  bottomFunnelPct: number;
  lowSovPromptsCount: number;
  sourcesCount: number;
}

export function buildRetrievalQueries(metrics: RetrievalMetricsInput): string[] {
  const queries: string[] = [];
  const sector = metrics.sector || "su sector";

  if (metrics.visibilityPct !== null && metrics.visibilityPct < 50) {
    queries.push(
      `Cómo aumentar Share of Voice en LLMs para marca con visibilidad ${metrics.visibilityPct}% en sector ${sector}`
    );
  }
  if (metrics.consistencyPct !== null && metrics.consistencyPct < 60) {
    queries.push(
      `Mejorar consistencia de menciones cuando los LLMs responden de forma variable sobre la marca`
    );
  }
  if (metrics.avgPosition !== null && metrics.avgPosition > 3) {
    queries.push(
      `Bajar posición media en respuestas LLM cuando la marca aparece pero no es primera opción`
    );
  }
  if (metrics.sourcesCount === 0) {
    queries.push(`Conseguir que LLMs con búsqueda web citen el dominio de la marca como fuente`);
  }
  if (metrics.topFunnelPct < 20) {
    queries.push(
      `Estrategia de prompts genéricos sin marca para cubrir el top del funnel de descubrimiento en LLMs`
    );
  }
  if (metrics.lowSovPromptsCount > 0) {
    queries.push(
      `Acciones específicas para mejorar SOV en prompts donde la marca aparece pero con baja visibilidad`
    );
  }

  if (queries.length === 0) {
    queries.push(
      `Optimización avanzada de GEO para marca con métricas estables en sector ${sector}`
    );
  }

  return queries.slice(0, 4);
}

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY_EMBEDDINGS ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY for embeddings");
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMS,
  });
  const first = response.data[0];
  if (!first) throw new Error("Empty embedding response");
  return first.embedding;
}

interface MatchRow {
  id: string;
  source_file: string;
  source_title: string;
  heading_path: string[];
  content: string;
  tags: string[];
  similarity: number;
}

export async function retrieveRelevantKnowledge(
  queries: string[],
  topKPerQuery = DEFAULT_TOP_K_PER_QUERY,
  totalCap = DEFAULT_TOTAL_CAP
): Promise<RetrievedChunk[]> {
  if (queries.length === 0) return [];

  const supabase = await createClient();

  let embeddings: number[][];
  try {
    embeddings = await Promise.all(queries.map((q) => embedQuery(q)));
  } catch (err) {
    console.error("[knowledgeRetrieval] embedding failed:", err);
    return [];
  }

  const matchPromises = embeddings.map((embedding) =>
    supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding as unknown as string,
      match_count: topKPerQuery,
      similarity_threshold: 0.25,
    })
  );

  const results = await Promise.all(matchPromises);

  const dedup = new Map<string, RetrievedChunk>();
  for (const { data, error } of results) {
    if (error) {
      console.error("[knowledgeRetrieval] match_knowledge_chunks RPC failed:", error);
      continue;
    }
    const rows = (data ?? []) as MatchRow[];
    for (const row of rows) {
      const existing = dedup.get(row.id);
      if (!existing || row.similarity > existing.similarity) {
        dedup.set(row.id, {
          id: row.id,
          sourceFile: row.source_file,
          sourceTitle: row.source_title,
          headingPath: row.heading_path ?? [],
          content: row.content,
          tags: row.tags ?? [],
          similarity: row.similarity,
        });
      }
    }
  }

  return [...dedup.values()].sort((a, b) => b.similarity - a.similarity).slice(0, totalCap);
}
