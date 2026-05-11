import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { DeleteCompetitorButton } from "./DeleteCompetitorButton";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function CompetitorsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!workspace) notFound();

  const { data: competitors } = await supabase
    .from("brands")
    .select("id, name, domain, aliases")
    .eq("workspace_id", workspace.id)
    .eq("type", "competitor")
    .order("name");

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Competidores</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Marcas que tu IA monitoriza en las respuestas junto a la tuya.
        </p>
      </div>

      <AddCompetitorForm workspaceId={workspace.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!competitors || competitors.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            Aún no has añadido competidores.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {competitors.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  {c.domain && <p className="text-xs text-slate-400 mt-0.5">{c.domain}</p>}
                  {Array.isArray(c.aliases) && c.aliases.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Alias: {(c.aliases as string[]).join(", ")}
                    </p>
                  )}
                </div>
                <DeleteCompetitorButton
                  competitorId={c.id}
                  workspaceId={workspace.id}
                  name={c.name}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
