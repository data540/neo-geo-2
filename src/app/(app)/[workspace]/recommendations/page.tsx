import { notFound } from "next/navigation";
import { getRecommendationsCacheAction, generateRecommendationsAction } from "@/actions/recommendations";
import { RecommendationsPanel } from "@/components/workspace/RecommendationsPanel";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function RecommendationsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name, brand_name, country")
    .eq("slug", slug)
    .single();
  if (!workspace) notFound();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) notFound();

  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY?.trim();

  // ── Leer caché ───────────────────────────────────────────────────────────
  const cacheResult = await getRecommendationsCacheAction(workspace.id);

  let initialRecommendations = cacheResult.success && cacheResult.data ? cacheResult.data.recommendations : [];
  let retrievedChunks = cacheResult.success && cacheResult.data ? cacheResult.data.chunks : [];
  let generatedAt: string | null = cacheResult.success && cacheResult.data ? cacheResult.data.generatedAt : null;
  let canRegenerate = cacheResult.success && cacheResult.data ? cacheResult.data.canRegenerate : true;

  // ── Primera vez: generar y guardar en caché ───────────────────────────────
  if (!cacheResult.success && hasOpenRouterKey) {
    const generated = await generateRecommendationsAction(workspace.id);
    if (generated.success && generated.data) {
      initialRecommendations = generated.data;
      generatedAt = new Date().toISOString();
      canRegenerate = false; // acaba de regenerarse hoy
      // chunks se recuperan en la próxima visita desde caché
      retrievedChunks = [];
    }
  }

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recomendaciones GEO</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acciones para mejorar la visibilidad de{" "}
            <span className="font-medium text-slate-700">{workspace.brand_name}</span> en motores de
            búsqueda de IA.
          </p>
        </div>

        <RecommendationsPanel
          workspaceId={workspace.id}
          initialRecommendations={initialRecommendations}
          retrievedChunks={retrievedChunks}
          hasApiKey={hasOpenRouterKey}
          generatedAt={generatedAt}
          canRegenerate={canRegenerate}
        />
      </div>
    </div>
  );
}
