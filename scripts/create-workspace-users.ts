/**
 * Crea un usuario dedicado e independiente por workspace.
 *
 * Cada usuario se asocia como `owner` SOLO a su workspace, de modo que el layout
 * y las políticas RLS (que filtran por `workspace_members`) le muestran
 * únicamente ese workspace. No toca la membresía de tester@gmail.com ni ningún
 * dato del workspace (todo está ligado a workspace_id, no al usuario).
 *
 * Idempotente: si el usuario o la membresía ya existen, no los duplica.
 *
 * Uso:  pnpm exec tsx scripts/create-workspace-users.ts
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const USERS: Array<{ email: string; password: string; workspaceSlug: string }> = [
  { email: "aireuropa@neogeo.app", password: "AirEuropa2026!", workspaceSlug: "air-europa" },
  { email: "foodbox@neogeo.app", password: "Foodbox2026!", workspaceSlug: "foodbox" },
];

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  // listUsers pagina de 50 en 50; recorremos hasta encontrarlo o agotar páginas.
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("Error al listar usuarios:", error.message);
      process.exit(1);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id };
    if (data.users.length < 1000) break;
  }
  return null;
}

async function main() {
  console.log("👤 Creando usuarios dedicados por workspace…\n");

  for (const entry of USERS) {
    console.log(`→ ${entry.email}  (workspace: ${entry.workspaceSlug})`);

    // 1. Resolver workspace por slug
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", entry.workspaceSlug)
      .single();
    if (wsError || !ws) {
      console.error(`  ✗ Workspace '${entry.workspaceSlug}' no encontrado. Saltando.`);
      continue;
    }

    // 2. Buscar usuario; si no existe, crearlo
    let userId: string;
    const existing = await findUserByEmail(entry.email);
    if (existing) {
      userId = existing.id;
      console.log(`  ✓ Usuario ya existía (${userId})`);
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: entry.email,
        password: entry.password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        console.error(`  ✗ Error al crear usuario: ${createError?.message}`);
        continue;
      }
      userId = created.user.id;
      console.log(`  ✓ Usuario creado (${userId}) — contraseña temporal: ${entry.password}`);
    }

    // 3. Asociar como owner SOLO a su workspace (idempotente)
    const { error: memberError } = await supabase
      .from("workspace_members")
      .upsert(
        { workspace_id: ws.id, user_id: userId, role: "owner" },
        { onConflict: "workspace_id,user_id" }
      );
    if (memberError) {
      console.error(`  ✗ Error al asignar membership: ${memberError.message}`);
      continue;
    }
    console.log(`  ✓ Membership 'owner' asignada en '${entry.workspaceSlug}'\n`);
  }

  console.log("Hecho. tester@gmail.com no se ha modificado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
