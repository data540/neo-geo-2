import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CompanyBioProfile } from "@/types";
import { CompanyBioForm } from "./CompanyBioForm";

interface Props {
  params: Promise<{ workspace: string }>;
}

function splitLegacyList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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

  const fallbackProfile: CompanyBioProfile = {
    company: {
      name: workspace.brand_name,
      website: workspace.domain ?? "",
      category: brandProfile?.positioning ?? "Aerolinea de pasajeros regular y charter",
      industry: "Transporte aereo de pasajeros",
      geography: workspace.country === "CO" ? "Colombia" : "Espana",
      logoHint: null,
    },
    businessOverview: {
      summary:
        brandProfile?.extracted_summary ??
        workspace.brand_statement ??
        "Genera una Company Bio desde la URL para completar la inteligencia de negocio de esta aerolinea.",
      valueProposition: brandProfile?.differentiators ?? null,
    },
    targetAudience:
      brandProfile?.audience ??
      "Pasajeros que necesitan informacion fiable sobre vuelos, check-in, equipaje, cambios, reembolsos, incidencias y asistencia durante su viaje.",
    businessModelRevenue: {
      pricingStrategy: null,
      revenueStreams: [],
    },
    productsServices: splitLegacyList(brandProfile?.products_services),
    technologyPartnerships: {
      technologyStack: [],
      keyPartnerships: [],
    },
    userExperienceContent: {
      userExperience: null,
      contentStrategy: null,
    },
    socialProof: [],
    keyFeatures: splitLegacyList(brandProfile?.differentiators),
    analysisInfo: {
      analyzedAt: brandProfile?.analyzed_at ?? "",
      sourceUrl: brandProfile?.analysis_source_url ?? workspace.domain ?? "",
      pagesAnalyzed: [],
      confidence: "low",
    },
  };

  const profile =
    brandProfile?.profile_data && typeof brandProfile.profile_data === "object"
      ? (brandProfile.profile_data as CompanyBioProfile)
      : fallbackProfile;

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 pb-12 max-w-7xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-slate-600" />
            <h1 className="text-xl font-bold text-slate-900">Company Bio</h1>
          </div>
          <p className="text-sm text-slate-500">
            Inteligencia de negocio de la aerolinea usada para prompts, analisis y seguimiento GEO.
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
