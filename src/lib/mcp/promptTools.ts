import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { remainingRunsToday } from "@/lib/llm/dailyCap";
import {
  filterBlockedTexts,
  isBrandRestrictedWorkspace,
  loadBlockedBrands,
} from "@/lib/prompts/brandGuardrail";
import { bool, num, rpcOrThrow, str, strList } from "./args";
import type { McpTool } from "./tools";

// Tools MCP de gestión, ejecución y detalle de prompts. Todas acotadas al
// workspace de la credencial: cualquier prompt_id ajeno se descarta en silencio
// porque el filtro por workspace_id va siempre en la query.

const WRITE = "mcp:write";
const MAX_PROMPTS_PER_CALL = 100;
/** Tope de runs por llamada MCP, además del cap diario del workspace. */
const MAX_RUNS_PER_CALL = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const promptIdsProp = {
  prompt_ids: {
    type: "array",
    items: { type: "string" },
    description: `IDs de prompt (de list_prompts). Máximo ${MAX_PROMPTS_PER_CALL}.`,
  },
};

function promptIdsArg(args: Record<string, unknown>): string[] {
  const ids = strList(args, "prompt_ids").filter((id) => UUID_RE.test(id));
  if (ids.length === 0) throw new Error("prompt_ids vacío o sin UUIDs válidos");
  if (ids.length > MAX_PROMPTS_PER_CALL) {
    throw new Error(`Máximo ${MAX_PROMPTS_PER_CALL} prompts por llamada`);
  }
  return ids;
}

/** Filtra los IDs a los que pertenecen al workspace. */
async function ownPromptIds(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<string[]> {
  const { data, error } = await supabase
    .from("prompts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => p.id as string);
}

async function findTag(supabase: SupabaseClient, workspaceId: string, name: string) {
  const { data } = await supabase
    .from("prompt_tags")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .maybeSingle();
  return data as { id: string; name: string } | null;
}

/** Crea runs queued (prompt × LLM habilitado) y los encola en Inngest. */
async function queueRuns(supabase: SupabaseClient, workspaceId: string, promptIds: string[]) {
  const { data: llmConfigs } = await supabase
    .from("workspace_llm_config")
    .select("llm_provider_id")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);
  const providerIds = (llmConfigs ?? []).map((c) => c.llm_provider_id as string);
  if (providerIds.length === 0) throw new Error("No hay LLMs habilitados en este workspace");

  const remaining = await remainingRunsToday(supabase, workspaceId);
  if (remaining <= 0) throw new Error("Límite diario de ejecuciones alcanzado. Inténtalo mañana.");

  const requested = promptIds.length * providerIds.length;
  const allowed = Math.min(remaining, MAX_RUNS_PER_CALL);
  const runRows = promptIds
    .flatMap((promptId) =>
      providerIds.map((llmProviderId) => ({
        workspace_id: workspaceId,
        prompt_id: promptId,
        llm_provider_id: llmProviderId,
        status: "queued",
      }))
    )
    .slice(0, allowed);

  const { data: createdRuns, error } = await supabase
    .from("prompt_runs")
    .insert(runRows)
    .select("id, prompt_id");
  if (error || !createdRuns || createdRuns.length === 0) {
    throw new Error("No se pudieron crear los runs");
  }

  const events = promptIds
    .map((promptId) => ({
      name: "prompt/run.multi" as const,
      data: {
        promptId,
        workspaceId,
        runIds: createdRuns.filter((r) => r.prompt_id === promptId).map((r) => r.id as string),
      },
    }))
    .filter((e) => e.data.runIds.length > 0);

  try {
    await inngest.send(events);
  } catch (err) {
    // Sin evento los runs quedarían queued para siempre: se borran y se avisa.
    await supabase
      .from("prompt_runs")
      .delete()
      .in(
        "id",
        createdRuns.map((r) => r.id as string)
      );
    throw new Error(
      `No se pudieron encolar las ejecuciones: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    prompts: events.length,
    runsQueued: createdRuns.length,
    runsRequested: requested,
    truncated: createdRuns.length < requested,
    remainingToday: remaining - createdRuns.length,
  };
}

export const PROMPT_TOOLS: McpTool[] = [
  // ── Bloque 1: gestión de prompts ──────────────────────────────────────────
  {
    name: "create_prompts_bulk",
    description:
      "Crea varios prompts a la vez en este workspace. Omite duplicados (mismo texto ya " +
      "existente) y textos fuera de 10-500 caracteres. Por defecto se crean en pausa; " +
      "pasa status 'active' para que entren en el cron diario. Requiere mcp:write.",
    requiredScope: WRITE,
    inputSchema: {
      type: "object",
      properties: {
        prompts: {
          type: "array",
          items: { type: "string" },
          description: `Textos de los prompts. Máximo ${MAX_PROMPTS_PER_CALL}.`,
        },
        country: { type: "string", description: "Código de país ISO de 2 letras (default 'ES')." },
        status: {
          type: "string",
          enum: ["paused", "active"],
          description: "Estado inicial (default 'paused').",
        },
      },
      required: ["prompts"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const texts = strList(args, "prompts");
      if (texts.length === 0) throw new Error("prompts vacío");
      if (texts.length > MAX_PROMPTS_PER_CALL) {
        throw new Error(`Máximo ${MAX_PROMPTS_PER_CALL} prompts por llamada`);
      }
      const country = (str(args, "country") ?? "ES").toUpperCase();
      if (country.length !== 2) throw new Error("Código de país de 2 letras");
      const status = str(args, "status") === "active" ? "active" : "paused";

      const invalid = texts.filter((t) => t.length < 10 || t.length > 500);
      let candidates = texts.filter((t) => t.length >= 10 && t.length <= 500);

      const { data: existing } = await supabase
        .from("prompts")
        .select("text")
        .eq("workspace_id", workspace.workspaceId);
      const existingSet = new Set((existing ?? []).map((p) => (p.text as string).toLowerCase()));
      const duplicates = candidates.filter((t) => existingSet.has(t.toLowerCase()));
      candidates = candidates.filter((t) => !existingSet.has(t.toLowerCase()));

      let blocked: { text: string; brand: string }[] = [];
      if (isBrandRestrictedWorkspace(workspace.slug)) {
        const blockedBrands = await loadBlockedBrands(supabase, workspace.workspaceId);
        const res = filterBlockedTexts(candidates, blockedBrands);
        candidates = res.allowed;
        blocked = res.blocked;
      }

      let created: { id: string; text: string }[] = [];
      if (candidates.length > 0) {
        const { data, error } = await supabase
          .from("prompts")
          .insert(
            candidates.map((text) => ({
              workspace_id: workspace.workspaceId,
              text,
              country,
              status,
            }))
          )
          .select("id, text");
        if (error) throw new Error(error.message);
        created = (data ?? []) as { id: string; text: string }[];
        revalidatePath(`/${workspace.slug}/prompts`);
      }

      return {
        created,
        status,
        skipped: {
          duplicates,
          invalidLength: invalid,
          blockedByBrandGuardrail: blocked,
        },
      };
    },
  },
  {
    name: "set_prompt_status",
    description:
      "Activa o pausa prompts. Los activos entran en el cron diario de ejecución (coste en " +
      "OpenRouter); los pausados dejan de ejecutarse. Requiere mcp:write.",
    requiredScope: WRITE,
    inputSchema: {
      type: "object",
      properties: {
        ...promptIdsProp,
        status: { type: "string", enum: ["active", "paused"] },
      },
      required: ["prompt_ids", "status"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const status = str(args, "status");
      if (status !== "active" && status !== "paused") {
        throw new Error("status debe ser 'active' o 'paused'");
      }
      const { data, error } = await supabase
        .from("prompts")
        .update({ status })
        .eq("workspace_id", workspace.workspaceId)
        .in("id", promptIdsArg(args))
        .select("id");
      if (error) throw new Error(error.message);
      revalidatePath(`/${workspace.slug}/prompts`);
      return { updated: data?.length ?? 0, status };
    },
  },
  {
    name: "delete_prompts",
    description:
      "Elimina prompts DEFINITIVAMENTE junto con su histórico de ejecuciones y menciones. " +
      "Es irreversible: confirma con el usuario antes y pasa confirm=true. Si solo quieres " +
      "dejar de ejecutarlos, usa set_prompt_status con 'paused'. Requiere mcp:write.",
    requiredScope: WRITE,
    inputSchema: {
      type: "object",
      properties: {
        ...promptIdsProp,
        confirm: {
          type: "boolean",
          description: "Debe ser true tras confirmar con el usuario.",
        },
      },
      required: ["prompt_ids", "confirm"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      if (!bool(args, "confirm")) {
        throw new Error("Borrado no confirmado: pasa confirm=true tras confirmarlo con el usuario");
      }
      const { data, error } = await supabase
        .from("prompts")
        .delete()
        .eq("workspace_id", workspace.workspaceId)
        .in("id", promptIdsArg(args))
        .select("id");
      if (error) throw new Error(error.message);
      revalidatePath(`/${workspace.slug}/prompts`);
      return { deleted: data?.length ?? 0 };
    },
  },
  {
    name: "list_tags",
    description: "Lista las etiquetas de prompts del workspace con el nº de prompts de cada una.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler(_args, { supabase, workspace }) {
      const { data, error } = await supabase
        .from("prompt_tags")
        .select("id, name, color, prompt_tag_assignments(count)")
        .eq("workspace_id", workspace.workspaceId)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        prompts: (t.prompt_tag_assignments as { count: number }[] | null)?.[0]?.count ?? 0,
      }));
    },
  },
  {
    name: "tag_prompts",
    description:
      "Asigna una etiqueta (por nombre) a varios prompts. Si la etiqueta no existe, la crea. " +
      "Requiere mcp:write.",
    requiredScope: WRITE,
    inputSchema: {
      type: "object",
      properties: {
        tag_name: { type: "string", description: "Nombre de la etiqueta (1-50 caracteres)." },
        color: {
          type: "string",
          description: "Color hex (#RRGGBB) si hay que crearla. Default #6366f1.",
        },
        ...promptIdsProp,
      },
      required: ["tag_name", "prompt_ids"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const name = str(args, "tag_name");
      if (!name || name.length > 50) throw new Error("tag_name debe tener entre 1 y 50 caracteres");
      const ids = await ownPromptIds(supabase, workspace.workspaceId, promptIdsArg(args));
      if (ids.length === 0) throw new Error("Ningún prompt_id pertenece a este workspace");

      let tag = await findTag(supabase, workspace.workspaceId, name);
      let tagCreated = false;
      if (!tag) {
        const color = str(args, "color") ?? "#6366f1";
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Color hex inválido");
        const { data, error } = await supabase
          .from("prompt_tags")
          .insert({ workspace_id: workspace.workspaceId, name, color })
          .select("id, name")
          .single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo crear la etiqueta");
        tag = data as { id: string; name: string };
        tagCreated = true;
      }

      const { error } = await supabase.from("prompt_tag_assignments").upsert(
        ids.map((promptId) => ({ prompt_id: promptId, tag_id: tag.id })),
        { onConflict: "prompt_id,tag_id", ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
      revalidatePath(`/${workspace.slug}/prompts`);
      return { tag: tag.name, tagCreated, prompts: ids.length };
    },
  },
  {
    name: "untag_prompts",
    description: "Quita una etiqueta (por nombre) de varios prompts. Requiere mcp:write.",
    requiredScope: WRITE,
    inputSchema: {
      type: "object",
      properties: {
        tag_name: { type: "string" },
        ...promptIdsProp,
      },
      required: ["tag_name", "prompt_ids"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const name = str(args, "tag_name");
      if (!name) throw new Error("tag_name vacío");
      const tag = await findTag(supabase, workspace.workspaceId, name);
      if (!tag) throw new Error(`No existe la etiqueta «${name}» en este workspace`);
      const ids = await ownPromptIds(supabase, workspace.workspaceId, promptIdsArg(args));
      const { data, error } = await supabase
        .from("prompt_tag_assignments")
        .delete()
        .eq("tag_id", tag.id)
        .in("prompt_id", ids)
        .select("prompt_id");
      if (error) throw new Error(error.message);
      revalidatePath(`/${workspace.slug}/prompts`);
      return { tag: tag.name, removed: data?.length ?? 0 };
    },
  },

  // ── Bloque 2: ejecución ───────────────────────────────────────────────────
  {
    name: "run_prompts",
    description:
      "Ejecuta prompts AHORA contra todos los LLMs habilitados del workspace (1 run por " +
      "prompt × LLM, con coste real en OpenRouter). Pasa prompt_ids, o all_active=true " +
      `para todos los prompts activos. Máximo ${MAX_RUNS_PER_CALL} runs por llamada y ` +
      "respeta el límite diario del workspace. Las respuestas tardan 1-3 minutos: consulta " +
      "el progreso con get_runs_status. Requiere mcp:write.",
    requiredScope: WRITE,
    inputSchema: {
      type: "object",
      properties: {
        ...promptIdsProp,
        all_active: {
          type: "boolean",
          description: "true para ejecutar todos los prompts activos (ignora prompt_ids).",
        },
      },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      let ids: string[];
      if (bool(args, "all_active")) {
        const { data, error } = await supabase
          .from("prompts")
          .select("id")
          .eq("workspace_id", workspace.workspaceId)
          .eq("status", "active");
        if (error) throw new Error(error.message);
        ids = (data ?? []).map((p) => p.id as string);
        if (ids.length === 0) throw new Error("No hay prompts activos en este workspace");
      } else {
        ids = await ownPromptIds(supabase, workspace.workspaceId, promptIdsArg(args));
        if (ids.length === 0) throw new Error("Ningún prompt_id pertenece a este workspace");
      }
      const result = await queueRuns(supabase, workspace.workspaceId, ids);
      revalidatePath(`/${workspace.slug}/prompts`);
      return result;
    },
  },
  {
    name: "get_runs_status",
    description:
      "Estado de las ejecuciones recientes (queued, running, completed, failed) para seguir " +
      "un run_prompts. Filtra opcionalmente por prompt_ids.",
    inputSchema: {
      type: "object",
      properties: {
        since_minutes: {
          type: "integer",
          description: "Ventana hacia atrás en minutos (default 60, máx 1440).",
          default: 60,
        },
        ...promptIdsProp,
      },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const minutes = Math.min(Math.max(num(args, "since_minutes", 60), 1), 1440);
      const since = new Date(Date.now() - minutes * 60_000).toISOString();
      let query = supabase
        .from("prompt_runs")
        .select("prompt_id, status, error_message, created_at, completed_at, llm_providers(key)")
        .eq("workspace_id", workspace.workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      const ids = strList(args, "prompt_ids").filter((id) => UUID_RE.test(id));
      if (ids.length > 0) query = query.in("prompt_id", ids);
      const rows = rpcOrThrow(await query) ?? [];

      const byStatus: Record<string, number> = {};
      for (const r of rows) byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1;
      const failed = rows
        .filter((r) => r.status === "failed")
        .slice(0, 20)
        .map((r) => ({
          promptId: r.prompt_id,
          llm: (r.llm_providers as unknown as { key: string } | null)?.key ?? null,
          error: r.error_message,
        }));
      return { sinceMinutes: minutes, total: rows.length, byStatus, failed };
    },
  },

  // ── Bloque 3: detalle y tendencia ─────────────────────────────────────────
  {
    name: "get_prompt_detail",
    description:
      "Detalle de un prompt: la última respuesta completada de cada LLM (texto), las marcas " +
      "mencionadas en ella (con posición, tipo y sentiment) y las fuentes citadas.",
    inputSchema: {
      type: "object",
      properties: {
        prompt_id: { type: "string" },
        max_chars: {
          type: "integer",
          description: "Recorta cada respuesta a este nº de caracteres (default 4000).",
          default: 4000,
        },
      },
      required: ["prompt_id"],
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const promptId = str(args, "prompt_id");
      if (!promptId || !UUID_RE.test(promptId)) throw new Error("prompt_id inválido");
      const maxChars = Math.max(num(args, "max_chars", 4000), 200);

      const { data: prompt } = await supabase
        .from("prompts")
        .select("id, text, country, status, intent, funnel_stage")
        .eq("workspace_id", workspace.workspaceId)
        .eq("id", promptId)
        .maybeSingle();
      if (!prompt) throw new Error("El prompt no existe en este workspace");

      const { data: runs, error } = await supabase
        .from("prompt_runs")
        .select("id, llm_provider_id, model, completed_at, raw_response, llm_providers(key, name)")
        .eq("workspace_id", workspace.workspaceId)
        .eq("prompt_id", promptId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);

      // Último run completado por proveedor.
      const latest = new Map<string, NonNullable<typeof runs>[number]>();
      for (const r of runs ?? []) {
        if (!latest.has(r.llm_provider_id as string)) latest.set(r.llm_provider_id as string, r);
      }
      const runIds = [...latest.values()].map((r) => r.id as string);
      if (runIds.length === 0) return { prompt, runs: [] };

      const [{ data: mentions }, { data: sources }] = await Promise.all([
        supabase
          .from("mentions")
          .select(
            "prompt_run_id, brand_name_detected, brand_type, position, mention_type, sentiment"
          )
          .in("prompt_run_id", runIds)
          .order("position", { ascending: true, nullsFirst: false }),
        supabase
          .from("sources")
          .select("prompt_run_id, domain, url, title, cited_by_llm")
          .in("prompt_run_id", runIds),
      ]);

      return {
        prompt,
        runs: [...latest.values()].map((r) => {
          const provider = r.llm_providers as unknown as { key: string; name: string } | null;
          const raw = (r.raw_response as string | null) ?? "";
          return {
            llm: provider?.key ?? null,
            llmLabel: provider?.name ?? null,
            model: r.model,
            completedAt: r.completed_at,
            response: raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw,
            responseTruncated: raw.length > maxChars,
            mentions: (mentions ?? [])
              .filter((m) => m.prompt_run_id === r.id)
              .map(({ prompt_run_id: _, ...m }) => m),
            sources: (sources ?? [])
              .filter((s) => s.prompt_run_id === r.id)
              .map(({ prompt_run_id: _, ...s }) => s),
          };
        }),
      };
    },
  },
  {
    name: "get_daily_trend",
    description:
      "Serie diaria de métricas del workspace (prompts activos, menciones de la marca, " +
      "posición media, consistencia y SOV medio) por proveedor LLM, para gráficos de tendencia.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Ventana en días (default 30, máx 365).",
          default: 30,
        },
        llm_provider: {
          type: "string",
          enum: ["chatgpt", "gemini", "perplexity"],
          description: "Filtra por proveedor. Omitir para todos (una fila por día y LLM).",
        },
      },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const days = Math.min(Math.max(num(args, "days", 30), 1), 365);
      const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      let query = supabase
        .from("daily_workspace_metrics")
        .select(
          "date, active_prompts_count, brand_mentions_count, avg_position, brand_consistency, avg_sov, llm_providers!inner(key)"
        )
        .eq("workspace_id", workspace.workspaceId)
        .gte("date", from)
        .order("date", { ascending: true });
      const llm = str(args, "llm_provider");
      if (llm) query = query.eq("llm_providers.key", llm);
      const rows = rpcOrThrow(await query) ?? [];
      return rows.map(({ llm_providers, ...r }) => ({
        ...r,
        llm: (llm_providers as unknown as { key: string } | null)?.key ?? null,
      }));
    },
  },
];
