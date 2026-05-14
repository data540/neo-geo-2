import { BarChart3, Eye, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ llm?: string; range?: string }>;
}

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `M 0 ${height / 2} L ${width} ${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({ values, colorClass }: { values: number[]; colorClass: string }) {
  const width = 220;
  const height = 38;
  const path = buildSparklinePath(values, width, height);

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10">
        {path ? (
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2.2" className={colorClass} />
        ) : (
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} className={colorClass} />
        )}
      </svg>
    </div>
  );
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { llm = "chatgpt", range = "30" } = await searchParams;

  const supabase = await createClient();
  const days = range === "7" || range === "90" ? Number(range) : 30;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (days - 1));
  const fromIso = fromDate.toISOString().slice(0, 10);

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", llm)
    .single();

  if (!provider) notFound();

  const { data: trendRows } = await supabase
    .from("daily_workspace_metrics")
    .select(
      "date, active_prompts_count, brand_mentions_count, avg_position, brand_consistency, avg_sov"
    )
    .eq("workspace_id", workspace.id)
    .eq("llm_provider_id", provider.id)
    .gte("date", fromIso)
    .order("date", { ascending: false });

  const rows = trendRows ?? [];
  const mentionsTotal = rows.reduce((acc, row) => acc + (row.brand_mentions_count ?? 0), 0);

  const avgPositionValues = rows
    .map((r) => r.avg_position)
    .filter((v): v is number => typeof v === "number");
  const avgPosition =
    avgPositionValues.length > 0
      ? Math.round((avgPositionValues.reduce((a, b) => a + b, 0) / avgPositionValues.length) * 10) /
        10
      : null;

  const visibilityValues = rows.map((r) => r.avg_sov).filter((v): v is number => typeof v === "number");
  const visibility =
    visibilityValues.length > 0
      ? Math.round((visibilityValues.reduce((a, b) => a + b, 0) / visibilityValues.length) * 10) /
        10
      : null;

  const consistencyValues = rows
    .map((r) => r.brand_consistency)
    .filter((v): v is number => typeof v === "number");
  const consistency =
    consistencyValues.length > 0
      ? Math.round((consistencyValues.reduce((a, b) => a + b, 0) / consistencyValues.length) * 10) /
        10
      : 0;

  const visibilitySeries = [...rows].reverse().map((r) => r.avg_sov ?? 0);
  const mentionsSeries = [...rows].reverse().map((r) => r.brand_mentions_count ?? 0);
  const avgPositionSeries = [...rows]
    .reverse()
    .map((r) => (r.avg_position != null ? Math.max(0, 100 - r.avg_position * 8) : 0));
  const consistencySeries = [...rows].reverse().map((r) => r.brand_consistency ?? 0);

  const { data: recentRuns } = await supabase
    .from("prompt_runs")
    .select("id, status, created_at, completed_at, prompts(text), llm_providers(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Resumen de visibilidad de {workspace.name} en motores de IA
        </p>
      </div>

      <div className="flex items-center gap-2">
        {[7, 30, 90].map((d) => {
          const active = days === d;
          return (
            <Link
              key={d}
              href={`/${slug}/dashboard?llm=${llm}&range=${d}`}
              className={[
                "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {d}D
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Visibilidad</p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">
                  {visibility != null ? `${visibility}%` : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Últimos {days} días</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <Sparkline values={visibilitySeries} colorClass="text-indigo-500" />
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Menciones de marca
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">{mentionsTotal}</p>
                <p className="text-xs text-slate-400 mt-1">Últimos {days} días</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Eye className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <Sparkline values={mentionsSeries} colorClass="text-green-500" />
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Posición media</p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">
                  {avgPosition != null ? `#${avgPosition}` : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Últimos {days} días</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <Sparkline values={avgPositionSeries} colorClass="text-blue-500" />
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Consistencia</p>
                <p className="text-3xl font-bold text-slate-900 mt-1.5">{consistency}%</p>
                <p className="text-xs text-slate-400 mt-1">Últimos {days} días</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <Sparkline values={consistencySeries} colorClass="text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Tendencia diaria ({days} días)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Un registro por día y motor IA en <code>daily_workspace_metrics</code>.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Prompts activos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Menciones
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Posición media
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Visibilidad (SOV)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Consistencia
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    No hay registros diarios en este rango.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(`${r.date}T00:00:00`).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.active_prompts_count ?? 0}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.brand_mentions_count ?? 0}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.avg_position != null ? `#${r.avg_position}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.avg_sov != null ? `${r.avg_sov}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.brand_consistency != null ? `${r.brand_consistency}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
              const providerRow = run.llm_providers as unknown as { name: string } | null;
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${statusColor}`}>
                    {run.status}
                  </span>
                  <span className="text-sm text-slate-700 flex-1 truncate">{prompt?.text ?? "—"}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">{providerRow?.name ?? "—"}</span>
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
