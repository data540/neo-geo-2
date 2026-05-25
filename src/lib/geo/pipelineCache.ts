import crypto from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export type PipelineCachePhase = "generation" | "normalize" | "audit" | "prioritize";

interface CacheLookupResult<T> {
  hit: boolean;
  cacheId?: string;
  data?: T;
  modelUsed?: string;
}

interface CacheSetInput<T> {
  workspaceId: string;
  phase: PipelineCachePhase;
  canonicalInput: CanonicalInput;
  output: T;
  modelUsed: string;
  costUsd?: number;
}

export interface CanonicalInput {
  brandName: string;
  category: string;
  country: string;
  competitors: string[];
  differentiators?: string;
  productsServices?: string;
  targetAudience?: string;
  kbRevision?: string;
  brandProfileRevision?: string;
}

function buildCanonicalString(input: CanonicalInput): string {
  return JSON.stringify({
    brandName: input.brandName.trim(),
    category: input.category.trim(),
    country: input.country.trim(),
    competitors: [...input.competitors].sort(),
    differentiators: (input.differentiators ?? "").trim(),
    productsServices: (input.productsServices ?? "").trim(),
    targetAudience: (input.targetAudience ?? "").trim(),
    kbRevision: input.kbRevision ?? "v0",
    brandProfileRevision: input.brandProfileRevision ?? "",
  });
}

function sha256(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function getEmbeddingClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY_EMBEDDINGS || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No OpenAI API key for embeddings");
  return new OpenAI({ apiKey });
}

async function embedText(text: string): Promise<number[]> {
  const client = getEmbeddingClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

export async function pipelineCacheLookup<T>(
  workspaceId: string,
  phase: PipelineCachePhase,
  canonicalInput: CanonicalInput
): Promise<CacheLookupResult<T>> {
  const supabase = await createClient();
  const canonical = buildCanonicalString(canonicalInput);
  const hash = sha256(canonical);

  // 1) Lookup exacto por hash
  const { data: exact } = await supabase
    .from("pipeline_cache")
    .select("id, output_jsonb, model_used, hit_count")
    .eq("workspace_id", workspaceId)
    .eq("phase", phase)
    .eq("input_hash", hash)
    .is("invalidated_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (exact) {
    // Incrementar hit_count
    await supabase
      .from("pipeline_cache")
      .update({ hit_count: ((exact.hit_count as number) ?? 0) + 1 })
      .eq("id", exact.id);

    return {
      hit: true,
      cacheId: exact.id as string,
      data: exact.output_jsonb as T,
      modelUsed: exact.model_used as string,
    };
  }

  // 2) Lookup semántico por embedding (threshold 0.95)
  try {
    const embedding = await embedText(canonical);
    const { data: semantic } = await supabase.rpc("match_pipeline_cache", {
      p_workspace_id: workspaceId,
      p_phase: phase,
      p_query_embedding: embedding,
      p_threshold: 0.95,
    });

    if (semantic && semantic.length > 0) {
      const hit = semantic[0];
      await supabase
        .from("pipeline_cache")
        .update({ hit_count: hit.hit_count + 1 })
        .eq("id", hit.id);

      return {
        hit: true,
        cacheId: hit.id as string,
        data: hit.output_jsonb as T,
        modelUsed: hit.model_used as string,
      };
    }
  } catch {
    // Si falla el embedding no bloqueamos el pipeline
  }

  return { hit: false };
}

export async function pipelineCacheSet<T>(input: CacheSetInput<T>): Promise<string | null> {
  const { workspaceId, phase, canonicalInput, output, modelUsed } = input;

  const canonical = buildCanonicalString(canonicalInput);
  const hash = sha256(canonical);
  const summary = canonical.slice(0, 300);

  let embedding: number[];
  try {
    embedding = await embedText(canonical);
  } catch {
    return null;
  }

  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("pipeline_cache")
    .upsert(
      {
        workspace_id: workspaceId,
        phase,
        input_hash: hash,
        input_embedding: embedding,
        input_summary: summary,
        output_jsonb: output,
        model_used: modelUsed,
        expires_at: expiresAt,
        invalidated_at: null,
        hit_count: 0,
        cost_saved_usd: 0,
      },
      { onConflict: "workspace_id,phase,input_hash", ignoreDuplicates: false }
    )
    .select("id")
    .maybeSingle();

  return (data?.id as string) ?? null;
}

export async function pipelineCacheInvalidate(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("pipeline_cache")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .is("invalidated_at", null);
}

export function buildCanonicalInput(
  params: CanonicalInput & { kbRevision?: string; brandProfileRevision?: string }
): CanonicalInput {
  return {
    brandName: params.brandName,
    category: params.category,
    country: params.country,
    competitors: params.competitors,
    differentiators: params.differentiators,
    productsServices: params.productsServices,
    targetAudience: params.targetAudience,
    kbRevision: params.kbRevision ?? "v0",
    brandProfileRevision: params.brandProfileRevision ?? "",
  };
}
