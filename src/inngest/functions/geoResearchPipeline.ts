import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { generatePromptCandidates } from "@/lib/geo/conversationalPromptGenerator";
import { normalizeCandidates } from "@/lib/geo/promptNormalizer";
import { auditPromptCoverage } from "@/lib/geo/promptCoverageAuditor";
import { prioritizePrompts } from "@/lib/geo/promptPrioritizer";
import {
  pipelineCacheLookup,
  pipelineCacheSet,
  buildCanonicalInput,
  type CanonicalInput,
} from "@/lib/geo/pipelineCache";
import {
  prepareInitialContext,
  retrievePhaseKnowledge,
} from "@/lib/geo/promptResearchSkill";
import type { GeoResearchInput, PromptCandidate, CoverageAuditResult, PrioritizedPrompt } from "@/types";

export interface GeoResearchStartEvent {
  name: "geo/research.start";
  data: {
    workspaceId: string;
    workspaceSlug: string;
    sessionId: string;
    researchInput: GeoResearchInput;
    kbRevision: string;
    brandProfileRevision: string;
  };
}

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function logPhase(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    workspaceId: string;
    sessionId: string;
    phase: string;
    status: "queued" | "running" | "completed" | "failed" | "cancelled" | "cache_hit";
    modelUsed?: string;
    durationMs?: number;
    cacheHit?: boolean;
    cacheId?: string;
    errorMessage?: string;
  }
) {
  await supabase.from("pipeline_runs").upsert(
    {
      workspace_id: params.workspaceId,
      session_id: params.sessionId,
      phase: params.phase,
      status: params.status,
      model_used: params.modelUsed ?? null,
      duration_ms: params.durationMs ?? null,
      cache_hit: params.cacheHit ?? false,
      cache_id: params.cacheId ?? null,
      error_message: params.errorMessage ?? null,
      started_at: params.status === "running" ? new Date().toISOString() : null,
      completed_at:
        params.status === "completed" || params.status === "cache_hit"
          ? new Date().toISOString()
          : null,
    },
    { onConflict: "workspace_id,session_id,phase" }
  );
}

export const geoResearchPipeline = inngest.createFunction(
  {
    id: "geo-research-pipeline",
    name: "GEO Research Pipeline",
    triggers: [{ event: "geo/research.start" as const }],
    concurrency: { limit: 3, key: "event.data.workspaceId" },
    retries: 2,
    cancelOn: [
      {
        event: "geo/research.cancel" as const,
        if: "async.data.sessionId == event.data.sessionId",
      },
    ],
  },
  async ({ event, step }) => {
    const { workspaceId, workspaceSlug, sessionId, researchInput, kbRevision, brandProfileRevision } =
      event.data as GeoResearchStartEvent["data"];

    const supabase = getServiceClient();

    const canonical: CanonicalInput = buildCanonicalInput({
      brandName: researchInput.brandName,
      category: researchInput.category,
      country: researchInput.country,
      competitors: researchInput.competitors,
      differentiators: researchInput.differentiators,
      productsServices: researchInput.productsServices,
      targetAudience: researchInput.targetAudience,
      kbRevision,
      brandProfileRevision,
    });

    // FASE 0: Init
    await step.run("init-session", async () => {
      await logPhase(supabase, {
        workspaceId,
        sessionId,
        phase: "init",
        status: "completed",
      });
    });

    // FASE 1: RAG retrieval (paralelo para las 3 fases)
    const knowledge = await step.run("retrieve-knowledge", async () => {
      const [genChunks, auditChunks, priorityChunks] = await Promise.all([
        retrievePhaseKnowledge("generator", researchInput),
        retrievePhaseKnowledge("auditor", researchInput),
        retrievePhaseKnowledge("prioritizer", researchInput),
      ]);
      await logPhase(supabase, { workspaceId, sessionId, phase: "retrieve_knowledge", status: "completed" });
      return { genChunks, auditChunks, priorityChunks };
    });

    // FASE 2: Generación con caché + micro-ensemble
    const candidates: PromptCandidate[] = await step.run("generate-candidates", async () => {
      const t0 = Date.now();

      // Lookup caché
      const cached = await pipelineCacheLookup<PromptCandidate[]>(workspaceId, "generation", canonical);
      if (cached.hit && cached.data) {
        await logPhase(supabase, {
          workspaceId,
          sessionId,
          phase: "generation_a",
          status: "cache_hit",
          cacheHit: true,
          cacheId: cached.cacheId,
          durationMs: Date.now() - t0,
        });
        return cached.data;
      }

      await logPhase(supabase, { workspaceId, sessionId, phase: "generation_a", status: "running", modelUsed: "anthropic/claude-sonnet-4-5 + openai/gpt-4.1-mini" });

      const result = await generatePromptCandidates(researchInput, knowledge.genChunks);

      await pipelineCacheSet({
        workspaceId,
        phase: "generation",
        canonicalInput: canonical,
        output: result,
        modelUsed: "anthropic/claude-sonnet-4-5+openai/gpt-4.1-mini",
      });

      await logPhase(supabase, {
        workspaceId,
        sessionId,
        phase: "generation_a",
        status: "completed",
        modelUsed: "anthropic/claude-sonnet-4-5 + openai/gpt-4.1-mini",
        durationMs: Date.now() - t0,
      });

      return result;
    });

    // FASE 3: Normalización con Gemini Flash
    const normalized: PromptCandidate[] = await step.run("normalize-candidates", async () => {
      const t0 = Date.now();

      const cached = await pipelineCacheLookup<PromptCandidate[]>(workspaceId, "normalize", canonical);
      if (cached.hit && cached.data) {
        await logPhase(supabase, { workspaceId, sessionId, phase: "normalize", status: "cache_hit", cacheHit: true, cacheId: cached.cacheId, durationMs: Date.now() - t0 });
        return cached.data;
      }

      await logPhase(supabase, { workspaceId, sessionId, phase: "normalize", status: "running", modelUsed: "google/gemini-2.0-flash-001" });

      const result = await normalizeCandidates(candidates, knowledge.genChunks);

      await pipelineCacheSet({
        workspaceId,
        phase: "normalize",
        canonicalInput: canonical,
        output: result,
        modelUsed: "google/gemini-2.0-flash-001",
      });

      await logPhase(supabase, { workspaceId, sessionId, phase: "normalize", status: "completed", modelUsed: "google/gemini-2.0-flash-001", durationMs: Date.now() - t0 });

      return result;
    });

    // FASE 4: Persistir candidatos
    await step.run("persist-candidates", async () => {
      if (normalized.length === 0) return;

      await supabase.from("prompt_candidates").insert(
        normalized.map((c) => ({
          workspace_id: workspaceId,
          session_id: sessionId,
          prompt: c.prompt,
          intent: c.intent,
          funnel_stage: c.funnel_stage,
          persona: c.persona,
          country: c.country || researchInput.country,
          includes_brand: c.includes_brand,
          includes_competitor: c.includes_competitor,
          strategic_value: c.strategic_value,
          conversion_intent: c.conversion_intent,
          ai_search_likelihood: c.ai_search_likelihood,
          priority_score: c.priority_score,
          reason: c.reason,
          coverage_area: c.coverage_area,
          selected: true,
        }))
      );
    });

    // Leer candidatos persistidos para tener IDs reales
    const { data: savedCandidates } = await supabase
      .from("prompt_candidates")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    const savedList = (savedCandidates ?? []) as PromptCandidate[];

    // FASE 5: Auditoría de cobertura
    const audit: CoverageAuditResult = await step.run("audit-coverage", async () => {
      const t0 = Date.now();

      const cached = await pipelineCacheLookup<CoverageAuditResult>(workspaceId, "audit", canonical);
      if (cached.hit && cached.data) {
        await logPhase(supabase, { workspaceId, sessionId, phase: "audit", status: "cache_hit", cacheHit: true, cacheId: cached.cacheId, durationMs: Date.now() - t0 });
        return cached.data;
      }

      await logPhase(supabase, { workspaceId, sessionId, phase: "audit", status: "running", modelUsed: "anthropic/claude-sonnet-4-5" });

      const result = await auditPromptCoverage({
        brandName: researchInput.brandName,
        category: researchInput.category,
        country: researchInput.country,
        targetAudience: researchInput.targetAudience,
        competitors: researchInput.competitors,
        candidates: savedList,
        knowledgeChunks: knowledge.auditChunks,
      });

      await pipelineCacheSet({
        workspaceId,
        phase: "audit",
        canonicalInput: canonical,
        output: result,
        modelUsed: "anthropic/claude-sonnet-4-5",
      });

      await logPhase(supabase, { workspaceId, sessionId, phase: "audit", status: "completed", modelUsed: "anthropic/claude-sonnet-4-5", durationMs: Date.now() - t0 });

      return result;
    });

    // FASE 6: Priorización
    const prioritized: PrioritizedPrompt[] = await step.run("prioritize-candidates", async () => {
      const t0 = Date.now();
      const limit = Math.min(15, savedList.length);

      await logPhase(supabase, { workspaceId, sessionId, phase: "prioritize", status: "running", modelUsed: "openai/gpt-4.1-mini" });

      const result = await prioritizePrompts(savedList, limit, knowledge.priorityChunks);

      // Persistir priority_rank y risk_if_brand_absent (en paralelo)
      await Promise.all(
        result.map((p) => {
          const match = savedList.find((c) => c.prompt === p.prompt);
          if (!match) return null;
          return supabase
            .from("prompt_candidates")
            .update({ priority_rank: p.priorityRank, risk_if_brand_absent: p.riskIfBrandAbsent })
            .eq("id", match.id)
            .eq("session_id", sessionId);
        })
      );

      await logPhase(supabase, { workspaceId, sessionId, phase: "prioritize", status: "completed", modelUsed: "openai/gpt-4.1-mini", durationMs: Date.now() - t0 });

      return result;
    });

    // FASE 7: Finalizar
    await step.run("finalize", async () => {
      await logPhase(supabase, { workspaceId, sessionId, phase: "finalize", status: "completed" });
    });

    return { success: true, sessionId, candidateCount: savedList.length, audit, prioritized };
  }
);
