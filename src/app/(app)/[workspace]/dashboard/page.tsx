import { BarChart3, Eye, Target, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string }>;
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm = "chatgpt" } = await searchParams;

  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: kpis } = await supabase.rpc("get_workspace_kpis", {
    p_workspace_slug: slug,
    p_llm_key: llm,
  });

  // Últimas ejecuciones
  const { data: recentRuns } = await supabase
    .from("prompt_runs")
    .select("id, status, created_at, completed_at, prompts(text), llm_providers(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const k = kpis as {
    active_prompts_count?: number;
    brand_mentions_count?: number;
    avg_position?: number | null;
    brand_consistency?: number;
    avg_sov?: number | null;
  } | null;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Resumen de visibilidad de {workspace.name} en motores de IA
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Prompts activos
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">
                  {k?.active_prompts_count ?? 0}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Menciones
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">
                  {k?.brand_mentions_count ?? 0}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Eye className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Posición media
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">
                  {k?.avg_position != null ? `#${Math.round(k.avg_position)}` : "—"}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Consistencia
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">
                  {k?.brand_consistency != null ? `${Math.round(k.brand_consistency)}%` : "0%"}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Últimas ejecuciones</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {!recentRuns || recentRuns.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">
              Aún no hay ejecuciones. Ejecuta un prompt desde la vista de Prompts.
            </p>
          ) : (
            recentRuns.map((run) => {
              const prompt = run.prompts as unknown as { text: string } | null;
              const provider = run.llm_providers as unknown as { name: string } | null;
              const statusColor =
                run.status === "completed"
                  ? "text-green-600 bg-green-50"
                  : run.status === "failed"
                    ? "text-red-600 bg-red-50"
                    : run.status === "running"
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-500 bg-slate-100";

              return (
                <div key={run.id} className="px-5 py-3 flex items-center gap-4">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${statusColor}`}
                  >
                    {run.status}
                  </span>
                  <span className="text-sm text-slate-700 flex-1 truncate">
                    {prompt?.text ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {provider?.name ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(run.created_at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
