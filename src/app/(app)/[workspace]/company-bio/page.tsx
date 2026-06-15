import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CompanyBioProfile } from "@/types";
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
    .maybeSingle();

  const { count: activePromptsCount } = await supabase
    .from("prompts")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("status", "active");

  const emptyProfile: CompanyBioProfile = {
    company: {
      name: workspace.brand_name,
      website: workspace.domain ?? "",
      category: null,
      industry: null,
      geography: null,
      logoHint: null,
    },
    businessOverview: { summary: "", valueProposition: null },
    targetAudience: "",
    businessModelRevenue: { pricingStrategy: null, revenueStreams: [] },
    productsServices: [],
    technologyPartnerships: { technologyStack: [], keyPartnerships: [] },
    userExperienceContent: { userExperience: null, contentStrategy: null },
    socialProof: [],
    keyFeatures: [],
    analysisInfo: {
      analyzedAt: "",
      sourceUrl: workspace.domain ?? "",
      pagesAnalyzed: [],
      confidence: "low",
    },
  };

  const profile =
    brandProfile?.profile_data && typeof brandProfile.profile_data === "object"
      ? (brandProfile.profile_data as CompanyBioProfile)
      : emptyProfile;

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 pb-12 max-w-7xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-slate-600" />
            <h1 className="text-xl font-bold text-slate-900">Company Bio</h1>
          </div>
          <p className="text-sm text-slate-500">
            Inteligencia de negocio de la marca usada para prompts, analisis y seguimiento GEO.
          </p>
        </div>

        <CompanyBioForm
          workspaceId={workspace.id}
          workspaceSlug={slug}
          activePromptsCount={activePromptsCount ?? 0}
          analysisError={brandProfile?.analysis_error ?? null}
          initialProfile={profile}
        />
      </div>
    </div>
  );
}
