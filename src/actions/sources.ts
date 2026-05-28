"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, SourceDetail } from "@/types";

interface GetSourceDetailParams {
  workspaceSlug: string;
  workspaceId: string;
  domain: string;
  days?: number;
  llmKey?: string | null;
  country?: string | null;
}

interface RawSourceDetail {
  brand_presence?: {
    urls_with_own_brand?: number;
    total_urls?: number;
    pct?: number;
  };
  top_competitors?: Array<{ brand_id: string; name: string; count: number }>;
  cited_by_llms?: Array<{ key: string; name: string }>;
  cited_urls?: Array<{
    url: string;
    title: string | null;
    mention_count: number;
    own_brand_present: boolean;
    competitor_count: number;
    llm_keys: string[] | null;
    used_in_prompts: string[] | null;
  }>;
}

export async function getSourceDetailAction({
  workspaceSlug,
  workspaceId,
  domain,
  days = 30,
  llmKey = null,
  country = null,
}: GetSourceDetailParams): Promise<ActionResult<SourceDetail>> {
  const supabase = await createClient();

  const { data: isMember } = await supabase.rpc("is_workspace_member", {
    p_workspace_id: workspaceId,
  });
  if (!isMember) return { success: false, error: "Sin permisos" };

  const { data, error } = await supabase.rpc("get_workspace_source_detail", {
    workspace_slug: workspaceSlug,
    p_domain: domain,
    days,
    llm_key: llmKey,
    p_country_filter: country,
  });

  if (error) return { success: false, error: error.message };

  const raw = (data ?? {}) as RawSourceDetail;

  const detail: SourceDetail = {
    brandPresence: {
      urlsWithOwnBrand: raw.brand_presence?.urls_with_own_brand ?? 0,
      totalUrls: raw.brand_presence?.total_urls ?? 0,
      pct: raw.brand_presence?.pct ?? 0,
    },
    topCompetitors: (raw.top_competitors ?? []).map((c) => ({
      brandId: c.brand_id,
      name: c.name,
      count: c.count,
    })),
    citedByLlms: (raw.cited_by_llms ?? []).map((l) => ({ key: l.key, name: l.name })),
    citedUrls: (raw.cited_urls ?? []).map((u) => ({
      url: u.url,
      title: u.title,
      mentionCount: u.mention_count,
      ownBrandPresent: u.own_brand_present,
      competitorCount: u.competitor_count,
      llmKeys: u.llm_keys ?? [],
      usedInPrompts: u.used_in_prompts ?? [],
    })),
  };

  return { success: true, data: detail };
}
