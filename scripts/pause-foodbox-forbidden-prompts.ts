// Pausa los prompts existentes de un workspace restringido que mencionen
// marcas competidoras (solo se permite la marca propia). Reutiliza el mismo
// helper que el guardrail de creación, así que el criterio es idéntico.
//
// Uso:
//   tsx scripts/pause-foodbox-forbidden-prompts.ts            (dry-run: solo lista)
//   tsx scripts/pause-foodbox-forbidden-prompts.ts --apply    (aplica el pausado)
//   tsx scripts/pause-foodbox-forbidden-prompts.ts --slug=foo (otro workspace)

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  firstBlockedBrandInText,
  isBrandRestrictedWorkspace,
  loadBlockedBrands,
} from "../src/lib/prompts/brandGuardrail";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

interface PromptRow {
  id: string;
  text: string;
  status: string;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const slug = slugArg?.split("=")[1] || "foodbox";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!isBrandRestrictedWorkspace(slug)) {
    console.error(
      `El workspace «${slug}» no está en la lista de workspaces restringidos (BRAND_RESTRICTED_SLUGS).`
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, slug, brand_name")
    .eq("slug", slug)
    .single();
  if (wsError || !workspace) {
    console.error(`No se encontró el workspace «${slug}»:`, wsError?.message);
    process.exit(1);
  }
  const workspaceId = workspace.id as string;

  console.log(`Workspace: ${workspace.slug} (marca propia: ${workspace.brand_name})`);
  console.log(`Modo: ${apply ? "APPLY (se pausarán)" : "DRY-RUN (solo lista)"}\n`);

  const blocked = await loadBlockedBrands(supabase, workspaceId);
  console.log(`Marcas competidoras cargadas: ${blocked.length}`);

  const { data: prompts, error: pError } = await supabase
    .from("prompts")
    .select("id, text, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  if (pError) {
    console.error("Error cargando prompts:", pError.message);
    process.exit(1);
  }

  const rows = (prompts ?? []) as PromptRow[];
  console.log(`Prompts activos: ${rows.length}\n`);

  const toPause: { id: string; text: string; brand: string }[] = [];
  for (const p of rows) {
    const brand = firstBlockedBrandInText(p.text, blocked);
    if (brand) toPause.push({ id: p.id, text: p.text, brand });
  }

  if (toPause.length === 0) {
    console.log("No hay prompts activos que mencionen marcas competidoras. Nada que pausar.");
    return;
  }

  console.log(`=== ${toPause.length} prompt(s) mencionan otras marcas ===`);
  for (const p of toPause) {
    console.log(`  [${p.brand}] ${p.text}`);
  }

  if (!apply) {
    console.log("\nDry-run: no se modificó nada. Ejecuta con --apply para pausarlos.");
    return;
  }

  const ids = toPause.map((p) => p.id);
  const { error: updError } = await supabase
    .from("prompts")
    .update({ status: "paused" })
    .in("id", ids);
  if (updError) {
    console.error("\nError al pausar:", updError.message);
    process.exit(1);
  }
  console.log(`\n✓ Pausados ${ids.length} prompt(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
