"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspaceSchema } from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

function generateSlug(brandName: string): string {
  return brandName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

const EXAMPLE_PROMPTS = (brandName: string) => [
  `¿Cuáles son las mejores opciones para conocer ${brandName} y marcas similares?`,
  `¿Qué opiniones hay sobre ${brandName}? ¿Vale la pena?`,
  `Compara ${brandName} con sus principales competidores`,
  `¿Por qué elegir ${brandName} frente a otras alternativas del mercado?`,
  `Busco información sobre ${brandName}: precios, calidad y experiencias de clientes`,
];

export async function createWorkspaceAction(
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const raw = {
    brandName: formData.get("brandName") as string,
    domain: formData.get("domain") as string,
    brandStatement: formData.get("brandStatement") as string,
    country: (formData.get("country") as string) || "ES",
  };

  const parsed = createWorkspaceSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message ?? "Datos inválidos" };
  }

  const { brandName, domain, brandStatement, country } = parsed.data;

  let slug = generateSlug(brandName);

  // Verificar unicidad del slug y añadir sufijo si ya existe
  const { data: existing } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("slug", slug)
    .single();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // 1. Crear workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      slug,
      name: brandName,
      brand_name: brandName,
      domain: domain || null,
      brand_statement: brandStatement || null,
      country,
    })
    .select()
    .single();

  if (wsError || !workspace) {
    console.error("[createWorkspace] wsError:", wsError?.message, wsError?.code, wsError?.details);
    return { success: false, error: `Error al crear workspace: ${wsError?.message ?? "desconocido"}` };
  }

  // 2. Crear membresía como owner
  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  // 3. Crear brand propia
  await supabase.from("brands").insert({
    workspace_id: workspace.id,
    name: brandName,
    domain: domain || null,
    aliases: [],
    type: "own",
  });

  // 4. Crear brand profile vacío
  await supabase.from("brand_profiles").insert({
    workspace_id: workspace.id,
  });

  // 5. Crear prompts de ejemplo
  const examplePrompts = EXAMPLE_PROMPTS(brandName);
  await supabase.from("prompts").insert(
    examplePrompts.map((text) => ({
      workspace_id: workspace.id,
      text,
      country,
      status: "active",
    }))
  );

  return { success: true, data: { slug } };
}
