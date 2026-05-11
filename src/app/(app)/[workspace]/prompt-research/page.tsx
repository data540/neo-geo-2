import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { GeoResearchWizard } from "@/components/geo/GeoResearchWizard";
import { createClient } from "@/lib/supabase/server";

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

  const { data: competitors } = await supabase
    .from("brands")
    .select("name")
    .eq("workspace_id", workspace.id)
    .eq("type", "competitor");

  const competitorNames = (competitors ?? []).map((c) => c.name as string);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-slate-900">GEO Research</h1>
        </div>
        <p className="text-sm text-slate-500">
          Genera un mapa de preguntas reales que los usuarios harían a ChatGPT, Gemini o Claude
          antes de elegir una marca en tu categoría.
        </p>
      </div>

      <GeoResearchWizard
        workspaceId={workspace.id}
        workspaceSlug={slug}
        brandName={workspace.brand_name}
        domain={workspace.domain ?? ""}
        brandStatement={workspace.brand_statement ?? ""}
        country={workspace.country ?? "ES"}
        competitors={competitorNames}
      />
    </div>
  );
}
