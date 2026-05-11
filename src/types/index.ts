// =============================================================================
// Tipos compartidos de neo-geo — sin any
// =============================================================================

// ── Auth / Users ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  brand_name: string;
  domain: string | null;
  brand_statement: string | null;
  country: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  created_at: string;
}

// ── Brands ────────────────────────────────────────────────────────────────────

export type BrandType = "own" | "competitor";

export interface Brand {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  aliases: string[];
  type: BrandType;
  created_at: string;
  updated_at: string;
}

export interface BrandProfile {
  id: string;
  workspace_id: string;
  extracted_summary: string | null;
  positioning: string | null;
  audience: string | null;
  products_services: string | null;
  differentiators: string | null;
  created_at: string;
  updated_at: string;
}

// ── LLM Providers ─────────────────────────────────────────────────────────────

export type LlmProviderKey = "chatgpt" | "claude" | "gemini" | "perplexity";

export interface LlmProvider {
  id: string;
  key: LlmProviderKey;
  name: string;
  enabled: boolean;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

export type PromptStatus = "active" | "paused";
export type PromptIntent =
  | "discovery"
  | "comparison"
  | "reputation"
  | "branded"
  | "decision"
  | "local"
  | "price"
  | "employability"
  | "product_specific";
export type FunnelStage = "top" | "middle" | "bottom";

export interface Prompt {
  id: string;
  workspace_id: string;
  text: string;
  country: string;
  status: PromptStatus;
  // GEO Research metadata
  intent: PromptIntent | null;
  funnel_stage: FunnelStage | null;
  persona: string | null;
  includes_brand: boolean;
  includes_competitor: boolean;
  strategic_value: number | null;
  conversion_intent: number | null;
  ai_search_likelihood: number | null;
  priority_score: number | null;
  research_reason: string | null;
  coverage_area: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptTag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

// ── Runs & Monitoring ─────────────────────────────────────────────────────────

export type RunStatus = "queued" | "running" | "completed" | "failed";
export type Sentiment = "positive" | "neutral" | "negative" | "no_data";

export interface PromptRun {
  id: string;
  workspace_id: string;
  prompt_id: string;
  llm_provider_id: string | null;
  status: RunStatus;
  raw_response: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Mention {
  id: string;
  workspace_id: string;
  prompt_run_id: string;
  brand_id: string | null;
  brand_name_detected: string | null;
  brand_type: BrandType | null;
  position: number | null;
  sentiment: Sentiment | null;
  confidence: number;
  created_at: string;
}

export interface Source {
  id: string;
  workspace_id: string;
  prompt_run_id: string;
  url: string | null;
  domain: string | null;
  title: string | null;
  cited_by_llm: boolean;
  created_at: string;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface DailyPromptMetric {
  id: string;
  workspace_id: string;
  prompt_id: string;
  llm_provider_id: string | null;
  date: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitor_count: number;
  sov: number | null;
  sentiment: string | null;
  consistency_score: number | null;
  created_at: string;
}

export interface DailyWorkspaceMetric {
  id: string;
  workspace_id: string;
  llm_provider_id: string | null;
  date: string;
  active_prompts_count: number;
  brand_mentions_count: number;
  avg_position: number | null;
  brand_consistency: number | null;
  avg_sov: number | null;
  created_at: string;
}

// ── Performance view (resultado de get_workspace_prompt_performance) ──────────

export interface PromptPerformanceRow {
  prompt_id: string;
  prompt_text: string;
  prompt_status: PromptStatus;
  prompt_country: string;
  prompt_intent: PromptIntent | null;
  prompt_funnel_stage: FunnelStage | null;
  prompt_persona: string | null;
  includes_brand: boolean;
  priority_score: number | null;
  brand_mentioned: boolean;
  brand_position: number | null;
  competitor_count: number;
  sov: number | null;
  sentiment: Sentiment;
  consistency_score: number;
  last_run_at: string | null;
  rank: number;
  // Joined: tags
  tags?: PromptTag[];
}

export type VisibilityStatus = "top" | "mentioned" | "competitors_only" | "no_data";

export function getVisibilityStatus(row: PromptPerformanceRow): VisibilityStatus {
  if (row.brand_mentioned && row.brand_position === 1) return "top";
  if (row.brand_mentioned) return "mentioned";
  if (row.competitor_count > 0) return "competitors_only";
  return "no_data";
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface WorkspaceKpis {
  activePromptsCount: number;
  brandMentionsCount: number;
  avgPosition: number | null;
  brandConsistency: number;
  avgSov: number | null;
}

// ── GEO Research ──────────────────────────────────────────────────────────────

export type RiskIfBrandAbsent = "low" | "medium" | "high";

export interface PromptCandidate {
  id: string;
  workspace_id: string;
  session_id: string;
  prompt: string;
  intent: PromptIntent | null;
  funnel_stage: FunnelStage | null;
  persona: string | null;
  country: string;
  includes_brand: boolean;
  includes_competitor: boolean;
  strategic_value: number | null;
  conversion_intent: number | null;
  ai_search_likelihood: number | null;
  priority_score: number | null;
  priority_rank: number | null;
  reason: string | null;
  coverage_area: string | null;
  risk_if_brand_absent: RiskIfBrandAbsent | null;
  tags: string[];
  selected: boolean;
  activated: boolean;
  created_at: string;
}

export interface GeoResearchInput {
  brandName: string;
  domain: string;
  brandStatement: string;
  country: string;
  location: string;
  category: string;
  productsServices: string;
  targetAudience: string;
  competitors: string[];
  differentiators: string;
  numberOfPrompts: number;
}

export interface CoverageAuditResult {
  coverageScore: number;
  mainGaps: string[];
  duplicatedOrWeakPrompts: string[];
  recommendedNewPrompts: string[];
  promptsToRemove: string[];
  finalRecommendation: string;
}

export interface PrioritizedPrompt {
  prompt: string;
  priorityRank: number;
  whySelected: string;
  coverageArea: string;
  riskIfBrandAbsent: RiskIfBrandAbsent;
}

// ── Action results ────────────────────────────────────────────────────────────

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}
