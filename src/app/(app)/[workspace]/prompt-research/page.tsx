import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { GeoResearchWizard } from "@/components/geo/GeoResearchWizard";
import { hasKnowledgeChunks, prepareInitialContext } from "@/lib/geo/promptResearchSkill";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function PromptResearchPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, brand_name, domain, brand_statement, country")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const [initialContext, hasKb] = await Promise.all([
    prepareInitialContext(workspace.id),
    hasKnowledgeChunks(),
  ]);

  const preFilled = Boolean(
    initialContext.productsServices ||
      initialContext.targetAudience ||
      initialContext.differentiators ||
      initialContext.competitors.length > 0
  );

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">GEO Research</h1>
          </div>
          <p className="text-sm text-slate-500">
            Genera un mapa de preguntas reales que los usuarios harían a ChatGPT, Gemini o Claude
            antes de elegir una marca en tu categoría.{" "}
            {hasKb && (
              <span className="text-indigo-700 font-medium">
                Recomendaciones respaldadas por base de conocimiento experta.
              </span>
            )}
          </p>
        </div>

        <GeoResearchWizard
          workspaceId={workspace.id}
          workspaceSlug={slug}
          brandName={initialContext.brandName || workspace.brand_name}
          domain={initialContext.domain || (workspace.domain ?? "")}
          brandStatement={initialContext.brandStatement || (workspace.brand_statement ?? "")}
          country={initialContext.country}
          location={initialContext.location}
          category={initialContext.category}
          productsServices={initialContext.productsServices}
          targetAudience={initialContext.targetAudience}
          differentiators={initialContext.differentiators}
          competitors={initialContext.competitors}
          hasKnowledgeBase={hasKb}
          preFilled={preFilled}
        />
      </div>
    </div>
  );
}
