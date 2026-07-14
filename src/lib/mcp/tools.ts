import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedWorkspace } from "./auth";

export interface ToolContext {
  supabase: SupabaseClient;
  workspace: ResolvedWorkspace;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

// ── helpers de argumentos ────────────────────────────────────────────────────
function num(args: Record<string, unknown>, key: string, def: number): number {
  const v = args[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return def;
}
function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function rpcOrThrow<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const LLM_ENUM = ["chatgpt", "gemini", "perplexity"];
const daysProp = {
  days: { type: "integer", description: "Ventana en días (default 30).", default: 30 },
};
const llmProp = {
  llm_provider: {
    type: "string",
    enum: LLM_ENUM,
    description:
      "Filtra por proveedor LLM: chatgpt (ChatGPT), gemini (AI Overviews) o perplexity. Omitir para agregado global.",
  },
};
const countryProp = {
  country: {
    type: "string",
    description: "Código de país ISO para filtrar (p. ej. 'ES', 'CO'). Omitir para todos.",
  },
};

// ── definición de tools ──────────────────────────────────────────────────────
export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_workspace_overview",
    description:
      "Resumen del workspace conectado: nombre de marca, dominio, país, marca propia, nº de competidores y nº de prompts activos. Empieza siempre por aquí para orientarte.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler(_args, { supabase, workspace }) {
      const [{ data: ownBrand }, { count: competitors }, { count: activePrompts }] =
        await Promise.all([
          supabase
            .from("brands")
            .select("name")
            .eq("workspace_id", workspace.workspaceId)
            .eq("type", "own")
            .maybeSingle(),
          supabase
            .from("brands")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", workspace.workspaceId)
            .eq("type", "competitor"),
          supabase
            .from("prompts")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", workspace.workspaceId)
            .eq("status", "active"),
        ]);
      return {
        name: workspace.name,
        slug: workspace.slug,
        brand: workspace.brandName ?? (ownBrand?.name as string | undefined) ?? null,
        domain: workspace.domain,
        country: workspace.country,
        competitorsTracked: competitors ?? 0,
        activePrompts: activePrompts ?? 0,
      };
    },
  },
  {
    name: "get_dashboard_kpis",
    description:
      "KPIs principales del dashboard GEO: visibilidad, share of voice, sentiment y posición media de la marca en respuestas de IA.",
    inputSchema: {
      type: "object",
      properties: { ...llmProp, ...countryProp },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_kpis", {
          p_workspace_slug: workspace.slug,
          p_llm_key: str(args, "llm_provider") ?? "chatgpt",
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "get_market_share",
    description:
      "Cuota de mercado (share of voice) de la marca propia frente a competidores en las respuestas de IA, normalizada.",
    inputSchema: {
      type: "object",
      properties: { ...daysProp, ...llmProp, ...countryProp },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_market_share", {
          workspace_slug: workspace.slug,
          days: num(args, "days", 30),
          llm_key: str(args, "llm_provider"),
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "get_top_competitors",
    description:
      "Ranking de los competidores más mencionados por los LLMs, con tendencia respecto al período anterior.",
    inputSchema: {
      type: "object",
      properties: {
        ...daysProp,
        limit: { type: "integer", description: "Nº de competidores (default 10).", default: 10 },
        ...llmProp,
        ...countryProp,
      },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_top_competitors", {
          workspace_slug: workspace.slug,
          days: num(args, "days", 30),
          limit_n: num(args, "limit", 10),
          llm_key: str(args, "llm_provider"),
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "get_top_sources",
    description:
      "Dominios/fuentes más citados por los LLMs con búsqueda web (source power ranking).",
    inputSchema: {
      type: "object",
      properties: {
        ...daysProp,
        limit: { type: "integer", description: "Nº de fuentes (default 10).", default: 10 },
        ...llmProp,
        ...countryProp,
      },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_top_sources", {
          workspace_slug: workspace.slug,
          days: num(args, "days", 30),
          limit_n: num(args, "limit", 10),
          llm_key: str(args, "llm_provider"),
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "get_mention_breakdown",
    description:
      "Distribución de las menciones de la marca por tipo (recomendación primaria, opción en lista, comparación, mención general, advertencia).",
    inputSchema: {
      type: "object",
      properties: { ...daysProp, ...llmProp, ...countryProp },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_mention_breakdown", {
          workspace_slug: workspace.slug,
          days: num(args, "days", 30),
          llm_key: str(args, "llm_provider"),
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "get_llm_comparison",
    description:
      "Comparativa de visibilidad de la marca entre los distintos proveedores LLM (siempre global, sin filtro por LLM).",
    inputSchema: {
      type: "object",
      properties: { ...daysProp, ...countryProp },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_llm_comparison", {
          workspace_slug: workspace.slug,
          days: num(args, "days", 30),
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "get_prompt_performance",
    description:
      "Rendimiento por prompt: visibilidad, SOV y posición de la marca en cada prompt monitorizado.",
    inputSchema: {
      type: "object",
      properties: { ...llmProp, ...countryProp },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      return rpcOrThrow(
        await supabase.rpc("get_workspace_prompt_performance", {
          p_workspace_slug: workspace.slug,
          p_llm_key: str(args, "llm_provider"),
          p_country_filter: str(args, "country"),
        })
      );
    },
  },
  {
    name: "list_prompts",
    description: "Lista los prompts monitorizados del workspace (texto, país, intención, estado).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "paused", "all"],
          description: "Filtra por estado (default 'active').",
        },
        limit: { type: "integer", description: "Máximo de prompts (default 100).", default: 100 },
      },
      additionalProperties: false,
    },
    async handler(args, { supabase, workspace }) {
      const status = str(args, "status") ?? "active";
      let query = supabase
        .from("prompts")
        .select("id, text, country, status, intent, funnel_stage, persona, priority_score")
        .eq("workspace_id", workspace.workspaceId)
        .order("priority_score", { ascending: false, nullsFirst: false })
        .limit(num(args, "limit", 100));
      if (status !== "all") query = query.eq("status", status);
      return rpcOrThrow(await query);
    },
  },
  {
    name: "get_recommendations",
    description:
      "Recomendaciones GEO accionables generadas para el workspace (con fuentes de la base de conocimiento y fecha de generación).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler(_args, { supabase, workspace }) {
      const { data } = await supabase
        .from("workspace_recommendations_cache")
        .select("recommendations, generated_at")
        .eq("workspace_id", workspace.workspaceId)
        .maybeSingle();
      if (!data) return { recommendations: [], generatedAt: null };
      return { recommendations: data.recommendations, generatedAt: data.generated_at };
    },
  },
  {
    name: "get_company_bio",
    description:
      "Company Bio: inteligencia de negocio de la marca (resumen, propuesta de valor, productos, audiencia, alianzas, modelo de negocio).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler(_args, { supabase, workspace }) {
      const { data } = await supabase
        .from("brand_profiles")
        .select("profile_data, analyzed_at")
        .eq("workspace_id", workspace.workspaceId)
        .maybeSingle();
      if (!data) return null;
      return { profile: data.profile_data, analyzedAt: data.analyzed_at };
    },
  },
];

export const MCP_TOOLS_BY_NAME = new Map(MCP_TOOLS.map((t) => [t.name, t]));
