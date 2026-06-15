import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { extractPotentialCompetitorsFromResponse } from "@/lib/detection/detectBrands";

// Palabras genéricas que nunca son nombres de marca (normalizadas)
const GENERIC_EXCLUSIONS = new Set([
  "espana", "colombia", "mexico", "argentina", "chile", "peru", "brasil",
  "madrid", "bogota", "barcelona", "bilbao", "valencia", "sevilla",
  "alicante", "mallorca", "salamanca", "barajas", "aeropuerto", "ciudad",
  "latam", "emea", "apac", "mena", "dach", "ue", "eeuu",
  "empresa", "compania", "servicio", "servicios", "producto", "productos",
  "cadena", "red", "grupo", "marca", "sector", "mercado", "modelo",
  "formato", "concepto", "tipo", "negocio", "retail", "marketing",
  "publicidad", "roi", "rentabilidad", "canon", "inversion", "costes",
  "abrir", "analiza", "buscas", "considerar", "consultar", "decidir",
  "determinar", "invertir", "investiga", "ofrece", "ofrecen", "puede",
  "revisa", "suele", "suelen", "visitar",
  "algunas", "algunos", "especializada", "especializado", "excelente",
  "ideal", "populares", "similar", "principal", "principales", "estas",
  "acceso", "apoyo", "asesoramiento", "calidad", "competencia", "demanda",
  "diversidad", "factores", "formacion", "franquicia", "franquicias",
  "innovacion", "objetivo", "parte", "perfil", "proveedores",
  "restauracion", "soporte", "tendencias", "tiendas", "ubicacion",
  "aunque", "dentro", "dicho", "entre", "incluso", "pero", "sin", "tambien",
  "salud", "belleza", "barrio", "tapas", "taberna", "casual",
]);

const GENERIC_PHRASE_PATTERN =
  /(^|\s)(compara|comparar|elige|elegir|busca|buscar|mejor|opcion|opciones|precio|precios|oferta|ofertas|reserva|reservar|descuento|analiza|considera|incluye|permite|ofrece)($|\s)/i;

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function shouldKeepCompetitorCandidate(name: string): boolean {
  const normalized = normalizeName(name);
  if (normalized.length < 4) return false;
  if (GENERIC_EXCLUSIONS.has(normalized)) return false;
  if (GENERIC_PHRASE_PATTERN.test(normalized)) return false;
  if (!/^[A-ZÀ-ɏ]/i.test(name.trim())) return false;
  return true;
}

interface WorkspaceRow {
  id: string;
  slug: string;
}

interface RunRow {
  raw_response: string | null;
}

async function processWorkspace(
  workspaceId: string,
  slug: string
): Promise<{
  analyzedRuns: number;
  extractedCandidates: number;
  insertedCompetitors: number;
}> {
  const supabase = getServiceClient();

  const [{ data: ownBrands }, { data: existingCompetitors }] = await Promise.all([
    supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "own"),
    supabase.from("brands").select("name").eq("workspace_id", workspaceId).eq("type", "competitor"),
  ]);

  const existingNames = new Set(
    [
      ...(ownBrands ?? []).map((b) => normalizeName(String(b.name ?? ""))),
      ...(existingCompetitors ?? []).map((b) => normalizeName(String(b.name ?? ""))),
    ].filter(Boolean)
  );

  const candidateMap = new Map<string, { name: string; count: number }>();
  const pageSize = 500;
  let analyzedRuns = 0;
  let offset = 0;

  while (true) {
    const { data } = await supabase
      .from("prompt_runs")
      .select("raw_response")
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .not("raw_response", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const chunk = (data ?? []) as RunRow[];
    if (chunk.length === 0) break;
    analyzedRuns += chunk.length;

    for (const run of chunk) {
      const candidates = extractPotentialCompetitorsFromResponse(String(run.raw_response ?? ""));
      for (const candidate of candidates) {
        const normalized = normalizeName(candidate);
        if (!normalized || existingNames.has(normalized)) continue;
        if (!shouldKeepCompetitorCandidate(candidate)) continue;

        const existing = candidateMap.get(normalized);
        if (!existing) {
          candidateMap.set(normalized, { name: candidate.trim(), count: 1 });
        } else {
          existing.count += 1;
          if (candidate.length > existing.name.length) {
            existing.name = candidate.trim();
          }
        }
      }
    }

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const candidates = Array.from(candidateMap.values());
  const toInsert = candidates.filter((entry) => entry.count >= 2);

  if (toInsert.length === 0) {
    return { analyzedRuns, extractedCandidates: candidates.length, insertedCompetitors: 0 };
  }

  const { error } = await supabase.from("brands").insert(
    toInsert.map((entry) => ({
      workspace_id: workspaceId,
      name: entry.name,
      aliases: [],
      type: "competitor",
    }))
  );

  if (error) {
    console.error(`[extractCompetitorsFromPromptRunsDaily] ${slug} insert failed:`, error.message);
    return { analyzedRuns, extractedCandidates: candidates.length, insertedCompetitors: 0 };
  }

  return {
    analyzedRuns,
    extractedCandidates: candidates.length,
    insertedCompetitors: toInsert.length,
  };
}

export const extractCompetitorsFromPromptRunsDaily = inngest.createFunction(
  {
    id: "extract-competitors-from-prompt-runs-daily",
    name: "Extract Competitors From Prompt Runs Daily",
    triggers: [{ cron: "30 3 * * *" }],
  },
  async ({ step }) => {
    const supabase = getServiceClient();

    const workspaces = await step.run("fetch-workspaces", async () => {
      const { data } = await supabase.from("workspaces").select("id, slug").order("created_at", {
        ascending: true,
      });
      return (data ?? []) as WorkspaceRow[];
    });

    let totalRuns = 0;
    let totalCandidates = 0;
    let totalInserted = 0;

    for (const workspace of workspaces) {
      const result = await step.run(`process-workspace-${workspace.slug}`, async () =>
        processWorkspace(workspace.id, workspace.slug)
      );

      totalRuns += result.analyzedRuns;
      totalCandidates += result.extractedCandidates;
      totalInserted += result.insertedCompetitors;
    }

    return {
      workspaces: workspaces.length,
      analyzedRuns: totalRuns,
      extractedCandidates: totalCandidates,
      insertedCompetitors: totalInserted,
    };
  }
);
