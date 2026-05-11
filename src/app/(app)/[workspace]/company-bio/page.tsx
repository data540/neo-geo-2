import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyBioForm } from "./CompanyBioForm";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function CompanyBioPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, brand_name, domain, brand_statement, country")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("workspace_id", workspace.id)
    .single();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-bold text-slate-900">Perfil de marca</h1>
        </div>
        <p className="text-sm text-slate-500">
          Información sobre tu marca que se usa para generar prompts y analizar respuestas de IA.
        </p>
      </div>

      <CompanyBioForm
        workspaceId={workspace.id}
        initialData={{
          brandName: workspace.brand_name,
          domain: workspace.domain ?? "",
          brandStatement: workspace.brand_statement ?? "",
          country: workspace.country ?? "ES",
          extractedSummary: brandProfile?.extracted_summary ?? "",
          positioning: brandProfile?.positioning ?? "",
          audience: brandProfile?.audience ?? "",
          productsServices: brandProfile?.products_services ?? "",
          differentiators: brandProfile?.differentiators ?? "",
        }}
      />
    </div>
  );
}
