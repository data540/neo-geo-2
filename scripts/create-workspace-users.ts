/**
 * Crea un usuario dedicado e independiente por workspace.
 *
 * Cada usuario se asocia como `owner` solo a su workspace, de modo que el layout
 * y las politicas RLS (que filtran por `workspace_members`) le muestran
 * unicamente ese workspace. No toca la membresia de tester@gmail.com ni ningun
 * dato del workspace (todo esta ligado a workspace_id, no al usuario).
 *
 * Idempotente: si el usuario o la membresia ya existen, no los duplica.
 *
 * Uso:
 *   WORKSPACE_USER_PASSWORD='...' pnpm exec tsx scripts/create-workspace-users.ts
 *
 * Opcionalmente se puede definir una password por workspace:
 *   WORKSPACE_USER_PASSWORD_AIR_EUROPA='...'
 *   WORKSPACE_USER_PASSWORD_FOODBOX='...'
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

const USERS: Array<{ email: string; workspaceSlug: string }> = [
  { email: "aireuropa@neogeo.app", workspaceSlug: "air-europa" },
  { email: "foodbox@neogeo.app", workspaceSlug: "foodbox" },
];

function passwordEnvName(workspaceSlug: string) {
  return `WORKSPACE_USER_PASSWORD_${workspaceSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

function passwordForWorkspace(workspaceSlug: string) {
  const specificEnvName = passwordEnvName(workspaceSlug);
  return process.env[specificEnvName]?.trim() || process.env.WORKSPACE_USER_PASSWORD?.trim();
}

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  // listUsers pagina de 50 en 50; recorremos hasta encontrarlo o agotar paginas.
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
  console.log("Creando usuarios dedicados por workspace...\n");

  for (const entry of USERS) {
    console.log(`-> ${entry.email}  (workspace: ${entry.workspaceSlug})`);

    // 1. Resolver workspace por slug.
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", entry.workspaceSlug)
      .single();
    if (wsError || !ws) {
      console.error(`  x Workspace '${entry.workspaceSlug}' no encontrado. Saltando.`);
      continue;
    }

    // 2. Buscar usuario; si no existe, crearlo.
    let userId: string;
    const existing = await findUserByEmail(entry.email);
    if (existing) {
      userId = existing.id;
      console.log(`  ok Usuario ya existia (${userId})`);
    } else {
      const password = passwordForWorkspace(entry.workspaceSlug);
      if (!password) {
        console.error(
          `  x Falta ${passwordEnvName(entry.workspaceSlug)} o WORKSPACE_USER_PASSWORD. No se creara este usuario.`
        );
        continue;
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: entry.email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        console.error(`  x Error al crear usuario: ${createError?.message}`);
        continue;
      }
      userId = created.user.id;
      console.log(`  ok Usuario creado (${userId}) - contrasena temporal leida desde env`);
    }

    // 3. Asociar como owner solo a su workspace (idempotente).
    const { error: memberError } = await supabase
      .from("workspace_members")
      .upsert(
        { workspace_id: ws.id, user_id: userId, role: "owner" },
        { onConflict: "workspace_id,user_id" }
      );
    if (memberError) {
      console.error(`  x Error al asignar membership: ${memberError.message}`);
      continue;
    }
    console.log(`  ok Membership 'owner' asignada en '${entry.workspaceSlug}'\n`);
  }

  console.log("Hecho. tester@gmail.com no se ha modificado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
