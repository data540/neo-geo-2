import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ExtractedCitation,
  mergeCitations,
} from "@/lib/detection/extractCitations";
import { extractSourcesFromResponse } from "@/lib/detection/extractSources";

interface PersistSourcesParams {
  supabase: SupabaseClient;
  workspaceId: string;
  promptRunId: string;
  rawResponse: string;
  citations?: ExtractedCitation[];
}

export async function persistSourcesForRun(params: PersistSourcesParams): Promise<number> {
  const { supabase, workspaceId, promptRunId, rawResponse, citations } = params;

  const inline = extractSourcesFromResponse(rawResponse);
  const merged = mergeCitations(inline, citations ?? []);

  await supabase.from("sources").delete().eq("prompt_run_id", promptRunId);

  if (merged.length === 0) return 0;

  const rows = merged.map((c) => ({
    workspace_id: workspaceId,
    prompt_run_id: promptRunId,
    url: c.url,
    domain: c.domain,
    title: c.title,
    cited_by_llm: true,
    source_type: c.sourceType,
    citation_index: c.citationIndex,
    quote_text: c.quote,
  }));

  const { error } = await supabase.from("sources").insert(rows);
  if (error) throw error;

  return rows.length;
}
