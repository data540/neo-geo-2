import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { aggregateDailyMetrics } from "@/inngest/functions/aggregateDailyMetrics";
import { extractCompetitorsFromPromptRunsDaily } from "@/inngest/functions/extractCompetitorsFromPromptRunsDaily";
import { geoResearchPipeline } from "@/inngest/functions/geoResearchPipeline";
import { pipelineCacheCleanup } from "@/inngest/functions/pipelineCacheCleanup";
import { refreshAioSerpData } from "@/inngest/functions/refreshAioSerpData";
import { refreshGoogleAnalytics } from "@/inngest/functions/refreshGoogleAnalytics";
import { runPromptManual } from "@/inngest/functions/runPromptManual";
import { runPromptManualMulti } from "@/inngest/functions/runPromptManualMulti";
import { runPromptScheduled } from "@/inngest/functions/runPromptScheduled";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runPromptManual,
    runPromptManualMulti,
    runPromptScheduled,
    aggregateDailyMetrics,
    extractCompetitorsFromPromptRunsDaily,
    geoResearchPipeline,
    pipelineCacheCleanup,
    refreshAioSerpData,
    refreshGoogleAnalytics,
  ],
});
