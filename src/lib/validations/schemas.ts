import { z } from "zod";

// ── Workspace ─────────────────────────────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  brandName: z.string().min(2, "Mínimo 2 caracteres").max(100),
  domain: z.string().max(200).optional().or(z.literal("")),
  brandStatement: z.string().max(500).optional().or(z.literal("")),
  country: z.string().length(2, "Código de país de 2 letras").default("ES"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

// ── Prompts ───────────────────────────────────────────────────────────────────

export const createPromptSchema = z.object({
  text: z.string().min(10, "El prompt debe tener al menos 10 caracteres").max(500),
  country: z.string().length(2, "Código de país de 2 letras").default("ES"),
  workspaceId: z.string().uuid(),
});

export const bulkCreatePromptsSchema = z.object({
  workspaceId: z.string().uuid(),
  country: z.string().length(2, "Código de país de 2 letras").default("ES"),
  prompts: z.array(z.string().min(10).max(500)).min(1).max(500),
});

export type CreatePromptInput = z.infer<typeof createPromptSchema>;

export const updatePromptSchema = z.object({
  promptId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  text: z.string().min(10).max(500).optional(),
  country: z.string().length(2, "Código de país de 2 letras").optional(),
  status: z.enum(["active", "paused"]).optional(),
});

export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;

export const togglePromptStatusSchema = z.object({
  promptId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: z.enum(["active", "paused"]),
});

export type TogglePromptStatusInput = z.infer<typeof togglePromptStatusSchema>;

export const runPromptSchema = z.object({
  promptId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  llmKey: z.enum(["chatgpt", "claude", "gemini", "perplexity"]).default("chatgpt"),
});

export type RunPromptInput = z.infer<typeof runPromptSchema>;

// ── Teams / Workspace management ──────────────────────────────────────────────

export const inviteWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.email("Email inválido").max(320),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const removeWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(2).max(100),
  confirmationText: z.string().min(2).max(100),
});

// ── Tags ──────────────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido")
    .default("#6366f1"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const assignTagSchema = z.object({
  promptId: z.string().uuid(),
  tagId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export type AssignTagInput = z.infer<typeof assignTagSchema>;

// ── Competitors ───────────────────────────────────────────────────────────────

export const createCompetitorSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(2).max(100),
  domain: z.string().url().optional().or(z.literal("")),
  aliases: z.array(z.string()).default([]),
});

export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;

export const updateCompetitorSchema = z.object({
  brandId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(2).max(100).optional(),
  domain: z.string().url().optional().or(z.literal("")),
  aliases: z.array(z.string()).optional(),
});

export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;

// ── GEO Research ──────────────────────────────────────────────────────────────

export const geoResearchInputSchema = z.object({
  workspaceId: z.string().uuid(),
  brandName: z.string().min(2).max(100),
  domain: z.string().max(200).default(""),
  brandStatement: z.string().max(500).default(""),
  country: z.string().length(2, "Código de país de 2 letras").default("ES"),
  location: z.string().max(100).default(""),
  category: z.string().min(2).max(100).default("Vuelos comerciales de pasajeros"),
  productsServices: z.string().max(300).default(""),
  targetAudience: z.string().max(300).default(""),
  competitors: z.array(z.string()).default([]),
  differentiators: z.string().max(300).default(""),
  numberOfPrompts: z.number().int().min(5).max(100).default(10),
});

export type GeoResearchFormInput = z.infer<typeof geoResearchInputSchema>;

export const promptCandidateSchema = z.object({
  prompt: z.string().min(10).max(500),
  intent: z
    .enum([
      "discovery",
      "comparison",
      "reputation",
      "branded",
      "decision",
      "local",
      "price",
      "employability",
      "product_specific",
    ])
    .nullable(),
  funnel_stage: z.enum(["top", "middle", "bottom"]).nullable(),
  persona: z.string().nullable(),
  country: z.string().default("ES"),
  includes_brand: z.boolean().default(false),
  includes_competitor: z.boolean().default(false),
  strategic_value: z.number().int().min(1).max(10).nullable(),
  conversion_intent: z.number().int().min(1).max(10).nullable(),
  ai_search_likelihood: z.number().int().min(1).max(10).nullable(),
  priority_score: z.number().int().min(1).max(100).nullable(),
  tags: z.array(z.string()).default([]),
  reason: z.string().nullable(),
  coverage_area: z.string().nullable(),
});

export type PromptCandidateInput = z.infer<typeof promptCandidateSchema>;

export const acceptPromptsSchema = z.object({
  workspaceId: z.string().uuid(),
  sessionId: z.string().uuid(),
  selectedIds: z.array(z.string().uuid()),
});

export type AcceptPromptsInput = z.infer<typeof acceptPromptsSchema>;
