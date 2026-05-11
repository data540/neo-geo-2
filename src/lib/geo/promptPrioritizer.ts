import Anthropic from "@anthropic-ai/sdk";
import type { PrioritizedPrompt, PromptCandidate, RiskIfBrandAbsent } from "@/types";
import { PROMPT_PRIORITIZER_TEMPLATE } from "./masterPrompts";

function mockPrioritize(candidates: PromptCandidate[], limit: number): PrioritizedPrompt[] {
  const sorted = [...candidates]
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    .slice(0, limit);

  return sorted.map((c, i) => ({
    prompt: c.prompt,
    priorityRank: i + 1,
    whySelected: c.reason ?? "Prompt con alta probabilidad de uso en motores de IA",
    coverageArea: c.coverage_area ?? c.intent ?? "general",
    riskIfBrandAbsent: (i < 3 ? "high" : i < 6 ? "medium" : "low") as RiskIfBrandAbsent,
  }));
}

export async function prioritizePrompts(
  candidates: PromptCandidate[],
  limit: number
): Promise<PrioritizedPrompt[]> {
  if (!process.env.ANTHROPIC_API_KEY || candidates.length === 0) {
    return mockPrioritize(candidates, limit);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      prompt: c.prompt,
      intent: c.intent,
      funnel_stage: c.funnel_stage,
      persona: c.persona,
      includes_brand: c.includes_brand,
      includes_competitor: c.includes_competitor,
      strategic_value: c.strategic_value,
      conversion_intent: c.conversion_intent,
      ai_search_likelihood: c.ai_search_likelihood,
      priority_score: c.priority_score,
    }))
  );

  const promptText = PROMPT_PRIORITIZER_TEMPLATE.replace("{{limit}}", String(limit))
    .replace("{{candidates_json}}", candidatesJson)
    .replace("{{limit}}", String(limit));

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: promptText }],
  });

  const firstContent = response.content[0];
  const rawText = firstContent?.type === "text" ? firstContent.text : "[]";

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return mockPrioritize(candidates, limit);

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    prompt?: string;
    priorityRank?: number;
    whySelected?: string;
    coverageArea?: string;
    riskIfBrandAbsent?: string;
  }>;

  return parsed.slice(0, limit).map((item, i) => ({
    prompt: item.prompt ?? "",
    priorityRank: item.priorityRank ?? i + 1,
    whySelected: item.whySelected ?? "",
    coverageArea: item.coverageArea ?? "",
    riskIfBrandAbsent: (["low", "medium", "high"].includes(item.riskIfBrandAbsent ?? "")
      ? item.riskIfBrandAbsent
      : "medium") as RiskIfBrandAbsent,
  }));
}
