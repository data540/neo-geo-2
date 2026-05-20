import { createClient } from "@/lib/supabase/server";
import type { GeoResearchInput, RetrievedChunk } from "@/types";
import { retrieveRelevantKnowledge } from "./knowledgeRetrieval";

export type ResearchPhase = "generator" | "auditor" | "prioritizer";

export interface InitialContext {
  brandName: string;
  domain: string;
  brandStatement: string;
  country: string;
  location: string;
  category: string;
  productsServices: string;
  targetAudience: string;
  differentiators: string;
  competitors: string[];
}

const DEFAULT_LOCATION_BY_COUNTRY: Record<string, string> = {
  ES: "Madrid",
  CO: "Bogotá",
};

const DEFAULT_CONTEXT: InitialContext = {
  brandName: "",
  domain: "",
  brandStatement: "",
  country: "ES",
  location: "",
  category: "Vuelos comerciales de pasajeros",
  productsServices: "",
  targetAudience: "",
  differentiators: "",
  competitors: [],
};

export async function prepareInitialContext(workspaceId: string): Promise<InitialContext> {
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, brand_name, domain, brand_statement, country")
    .eq("id", workspaceId)
    .single();

  if (!workspace) return DEFAULT_CONTEXT;

  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("extracted_summary, positioning, audience, products_services, differentiators")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { data: competitorRows } = await supabase
    .from("brands")
    .select("name")
    .eq("workspace_id", workspaceId)
    .eq("type", "competitor")
    .order("name");

  const country = (workspace.country as string) ?? "ES";
  const competitors = (competitorRows ?? []).map((r) => r.name as string);

  const category = (profile?.positioning as string | null) || DEFAULT_CONTEXT.category;
  const brandStatement =
    (workspace.brand_statement as string | null) ||
    (profile?.extracted_summary as string | null) ||
    "";

  return {
    brandName: (workspace.brand_name as string) || (workspace.name as string) || "",
    domain: (workspace.domain as string) || "",
    brandStatement,
    country,
    location: DEFAULT_LOCATION_BY_COUNTRY[country] ?? "",
    category,
    productsServices: (profile?.products_services as string | null) ?? "",
    targetAudience: (profile?.audience as string | null) ?? "",
    differentiators: (profile?.differentiators as string | null) ?? "",
    competitors,
  };
}

export async function hasKnowledgeChunks(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

function buildPhaseQueries(phase: ResearchPhase, input: GeoResearchInput): string[] {
  const sector = input.category || "su sector";
  const country = input.country === "CO" ? "Colombia" : "España";

  if (phase === "generator") {
    return [
      `Tipos de prompts conversacionales que los usuarios hacen a ChatGPT, Gemini y Perplexity en ${sector}`,
      `Categorías de intent en queries de answer engine optimization: discovery, comparison, decision, branded, local, price`,
      `Distribución óptima de funnel stages top middle bottom para investigación de visibilidad de marca en LLMs`,
      `Importancia de personas con necesidades especiales y geografía concreta como ${country} en prompts de GEO`,
    ];
  }

  if (phase === "auditor") {
    return [
      `Checklist de cobertura ideal de prompts GEO: gaps comunes y antipatrones a evitar`,
      `Cómo evaluar si un set de prompts permite medir visibilidad real de marca frente a competidores en LLMs`,
      `Balance óptimo entre prompts con marca y sin marca branded vs unbranded en answer engine optimization`,
    ];
  }

  // prioritizer
  return [
    `Criterios para priorizar prompts en GEO según probabilidad de búsqueda real y valor estratégico`,
    `Prompts de alto riesgo: bottom funnel con alta intención comercial donde la marca puede no aparecer`,
    `Cómo medir el riesgo de no estar presente en respuestas de LLMs por categoría de prompt y funnel stage`,
  ];
}

export async function retrievePhaseKnowledge(
  phase: ResearchPhase,
  input: GeoResearchInput
): Promise<RetrievedChunk[]> {
  const queries = buildPhaseQueries(phase, input);
  try {
    return await retrieveRelevantKnowledge(queries, 3, 8);
  } catch (err) {
    console.error(`[promptResearchSkill] retrieval ${phase} failed:`, err);
    return [];
  }
}

export function formatKnowledgeBlock(
  chunks: RetrievedChunk[],
  blockTitle = "BASE DE CONOCIMIENTO EXPERTA"
): string {
  if (chunks.length === 0) return "";
  const sections = chunks.map((c, idx) => {
    const breadcrumb =
      c.headingPath.length > 0 ? `${c.sourceTitle} › ${c.headingPath.join(" › ")}` : c.sourceTitle;
    return `## [${idx + 1}] ${breadcrumb}\n(fuente: ${c.sourceFile})\n\n${c.content}`;
  });
  return `\n\n---\n\n# ${blockTitle} (extractos relevantes)\n\nUsa los siguientes extractos como contexto experto al razonar. No es necesario citarlos en el output, pero sí debes incorporar sus principios y buenas prácticas.\n\n${sections.join("\n\n")}\n\n---\n\n`;
}
