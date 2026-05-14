import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { aggregateDailyMetrics } from "@/inngest/functions/aggregateDailyMetrics";
import { extractCompetitorsFromPromptRunsDaily } from "@/inngest/functions/extractCompetitorsFromPromptRunsDaily";
import { runPromptManual } from "@/inngest/functions/runPromptManual";
import { runPromptScheduled } from "@/inngest/functions/runPromptScheduled";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runPromptManual,
    runPromptScheduled,
    aggregateDailyMetrics,
    extractCompetitorsFromPromptRunsDaily,
  ],
});
