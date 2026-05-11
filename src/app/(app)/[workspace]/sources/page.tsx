import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function SourcesPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: sources } = await supabase
    .from("sources")
    .select(
      "id, url, domain, title, cited_by_llm, created_at, prompt_runs(prompts(text), llm_providers(name))"
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Fuentes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          URLs citadas por los motores de IA en las respuestas a tus prompts.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Dominio
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Título
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-28">
                Citada
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Prompt
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-24">
                Motor IA
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-32">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!sources || sources.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                  No hay fuentes todavía. Las fuentes se detectan automáticamente al ejecutar
                  prompts.
                </td>
              </tr>
            ) : (
              sources.map((source) => {
                const run = source.prompt_runs as unknown as {
                  prompts: { text: string } | null;
                  llm_providers: { name: string } | null;
                } | null;
                return (
                  <tr key={source.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700">{source.domain ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-indigo-600 truncate max-w-xs"
                        >
                          <span className="truncate">{source.title ?? source.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {source.cited_by_llm ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-400">
                          Detectada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-xs">
                      {run?.prompts?.text ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{run?.llm_providers?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(source.created_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
