import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import {
  callLlmAndSave,
  type LlmResult,
  postProcessRun,
  prepareRun,
} from "@/lib/llm/promptRunPipeline";
import type { LlmProviderKey } from "@/types";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Consumo de Inngest: cada step.run es una ejecución facturable (plan Hobby:
// 50.000/mes). Antes había 13 pasos (~14 ejecuciones por run → 300 runs/día
// agotaban el plan en 12 días). Ahora 3 pasos (~4 ejecuciones por run).
// La lógica vive en src/lib/llm/promptRunPipeline.ts (compartida con los
// ejecutores sin Inngest).
export const runPromptManual = inngest.createFunction(
  {
    id: "prompt-run-manual",
    name: "Run Prompt Manual",
    triggers: [{ event: "prompt/run.manual" }],
    concurrency: { limit: 5 },
    retries: 2,
  },
  async ({ event, step }) => {
    const input = event.data as {
      promptId: string;
      workspaceId: string;
      llmKey: LlmProviderKey;
    };
    const supabase = getServiceClient();

    // 1. Cap diario + contexto + crear prompt_run
    const prepared = await step.run("prepare", () => prepareRun(supabase, input));
    if (prepared.skipped) {
      return {
        skipped: true,
        reason: `Daily cap reached: ${prepared.runsToday}/${prepared.hardCap} runs for workspace ${input.workspaceId} (${input.llmKey})`,
      };
    }
    const { context, runId } = prepared;

    // 2. Llamada al LLM + guardar respuesta (memoizado: un reintento del paso 3
    // no vuelve a pagar la llamada). Si falla, el run queda como 'failed'.
    const llmResult = (await step.run("call-llm", () =>
      callLlmAndSave(supabase, input.llmKey, context, runId)
    )) as LlmResult;

    // 3. Competidores, marcas, fuentes, menciones, análisis LLM y métricas
    await step.run("post-process", async () => {
      await postProcessRun(supabase, input, context, runId, llmResult);
      revalidatePath(`/${context.workspace.slug as string}/prompts`);
      revalidatePath(`/${context.workspace.slug as string}/dashboard`);
    });

    return { success: true, runId };
  }
);
