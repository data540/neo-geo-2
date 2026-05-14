"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { executeRunsInBackground } from "@/lib/llm/enqueueWorkspaceRuns";
import { generateWorkspacePrompts } from "@/lib/llm/generateWorkspacePrompts";
import { createClient } from "@/lib/supabase/server";
import {
  createWorkspaceSchema,
  inviteWorkspaceMemberSchema,
  removeWorkspaceSchema,
} from "@/lib/validations/schemas";
import type { ActionResult } from "@/types";

const PROMPTS_PER_WORKSPACE = 10;

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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
    return {
      success: false,
      error: `Error al crear workspace: ${wsError?.message ?? "desconocido"}`,
    };
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

  // 5. Generar prompts personalizados con Claude (~3-5s)
  const promptTexts = await generateWorkspacePrompts({
    brandName,
    domain: domain || null,
    brandStatement: brandStatement || null,
    country,
    count: PROMPTS_PER_WORKSPACE,
  });

  // 6. Bulk insert prompts (con service role para evitar latencia de RLS)
  const service = getServiceClient();
  const { data: insertedPrompts, error: promptsError } = await service
    .from("prompts")
    .insert(
      promptTexts.map((text) => ({
        workspace_id: workspace.id,
        text,
        country,
        status: "active",
      }))
    )
    .select("id");

  if (promptsError || !insertedPrompts) {
    console.error("[createWorkspace] prompts insert error:", promptsError?.message);
    return { success: true, data: { slug } };
  }

  // 7. Obtener provider id (chatgpt)
  const { data: provider } = await service
    .from("llm_providers")
    .select("id")
    .eq("key", "chatgpt")
    .single();

  if (!provider) {
    console.error("[createWorkspace] provider chatgpt no encontrado");
    return { success: true, data: { slug } };
  }

  // 8. Bulk insert 50 prompt_runs en status='queued'
  const { data: runs } = await service
    .from("prompt_runs")
    .insert(
      insertedPrompts.map((p) => ({
        workspace_id: workspace.id,
        prompt_id: p.id,
        llm_provider_id: provider.id,
        status: "queued",
      }))
    )
    .select("id");

  // 9. Disparar workers en background (fire & forget, contexto compartido)
  if (runs && runs.length > 0) {
    executeRunsInBackground(
      workspace.id,
      runs.map((r) => r.id as string)
    );
  }

  return { success: true, data: { slug } };
}

export async function inviteWorkspaceMemberByEmailAction(
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    workspaceId: formData.get("workspaceId") as string,
    email: formData.get("email") as string,
    role: ((formData.get("role") as string) || "member") as "admin" | "member" | "viewer",
  };

  const parsed = inviteWorkspaceMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, email, role } = parsed.data;
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const normalizedEmail = email.trim().toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .single();

  if (!profile) {
    return {
      success: false,
      error:
        "No existe un usuario registrado con ese correo. Pidele que cree su cuenta primero para poder anadirlo al team.",
    };
  }

  const { error } = await supabase.from("workspace_members").upsert(
    {
      workspace_id: workspaceId,
      user_id: profile.id,
      role,
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (error) return { success: false, error: "No se pudo anadir el colaborador" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();
  if (workspace?.slug) revalidatePath(`/${workspace.slug}/team`);

  return { success: true };
}

export async function deleteWorkspaceAction(data: unknown): Promise<ActionResult> {
  const parsed = removeWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { workspaceId, workspaceSlug, confirmationText } = parsed.data;
  if (confirmationText.trim().toLowerCase() !== workspaceSlug.trim().toLowerCase()) {
    return {
      success: false,
      error: "El texto de confirmacion no coincide con el slug del workspace",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: ownerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!ownerMembership || ownerMembership.role !== "owner") {
    return { success: false, error: "Solo el owner puede eliminar el workspace" };
  }

  // Ejecutamos el borrado con service role para asegurar cascada completa de datos
  // (prompts, runs, mentions, sources, métricas, miembros, etc.).
  const service = getServiceClient();

  // Comprobación adicional: el slug debe corresponder al workspace solicitado.
  const { data: targetWorkspace } = await service
    .from("workspaces")
    .select("id, slug")
    .eq("id", workspaceId)
    .single();

  if (!targetWorkspace) {
    return { success: false, error: "Workspace no encontrado" };
  }

  if (targetWorkspace.slug !== workspaceSlug) {
    return { success: false, error: "El slug de confirmación no coincide con el workspace" };
  }

  const { error } = await service.from("workspaces").delete().eq("id", workspaceId);
  if (error) {
    return { success: false, error: `No se pudo eliminar el workspace: ${error.message}` };
  }

  // Verificamos que desapareció efectivamente.
  const { data: stillExists } = await service
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (stillExists) {
    return { success: false, error: "El workspace no se eliminó completamente" };
  }

  revalidatePath("/workspaces");
  revalidatePath(`/${workspaceSlug}/team`);
  revalidatePath(`/${workspaceSlug}/prompts`);
  revalidatePath(`/${workspaceSlug}/dashboard`);
  return { success: true };
}
