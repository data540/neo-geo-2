/**
 * Genera una API key de solo lectura para el servidor MCP de un workspace.
 * Uso:  pnpm mcp:key <workspace-slug> [nombre-de-la-key]
 * Ej.:  pnpm mcp:key air-europa "Claude Desktop de David"
 *
 * La key en claro se muestra UNA sola vez: cópiala y guárdala. En la BD solo
 * queda el hash sha256.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { generateApiKey } from "../src/lib/mcp/auth";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const slug = process.argv[2];
  const name = process.argv[3] ?? "default";
  if (!slug) {
    console.error("Uso: pnpm mcp:key <workspace-slug> [nombre-de-la-key]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: workspace, error: wsErr } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();
  if (wsErr || !workspace) {
    console.error(`No se encontró el workspace con slug "${slug}".`);
    process.exit(1);
  }

  const { key: apiKey, keyHash, keyPrefix } = generateApiKey();
  const { error: insErr } = await supabase.from("mcp_api_keys").insert({
    workspace_id: workspace.id,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
  });
  if (insErr) {
    console.error("Error guardando la key:", insErr.message);
    process.exit(1);
  }

  const base = process.env.MCP_PUBLIC_BASE_URL ?? "https://neogeo-three.vercel.app";
  console.log("\n✅ API key MCP creada para el workspace:", workspace.name, `(${workspace.slug})`);
  console.log("   Nombre:", name);
  console.log("\n🔑 API KEY (se muestra solo una vez, cópiala ahora):\n");
  console.log("   " + apiKey);
  console.log("\n🌐 URL del servidor MCP:\n");
  console.log("   " + base + "/api/mcp");
  console.log(
    "\nConfigura el MCP en Claude/ChatGPT con esa URL y la API key como Bearer token."
  );
  console.log("Ver docs/mcp-server.md para el paso a paso.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
