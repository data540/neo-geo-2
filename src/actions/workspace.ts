"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { extractBrandProfile } from "@/lib/geo/extractBrandProfile";
import { executeRunsInBackground } from "@/lib/llm/enqueueWorkspaceRuns";
import { generateWorkspacePrompts } from "@/lib/llm/generateWorkspacePrompts";
import { createClient } from "@/lib/supabase/server";
import {
  createWorkspaceSchema,
  inviteWorkspaceMemberSchema,
  removeWorkspaceSchema,
} from "@/lib/validations/schemas";
import type { ActionResult, CompanyBioProfile } from "@/types";

const PROMPTS_PER_WORKSPACE = 10;

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

  // 1. Crear workspace con el service client. El INSERT ... RETURNING necesita
  // leer la fila recién creada antes de que exista la membresía; hacerlo con el
  // cliente del usuario obligaba a una política RLS de lectura abierta a todos.
  // Con el service client, la lectura de `workspaces` queda restringida a
  // is_workspace_member() y no se filtran workspaces ajenos.
  const service = getServiceClient();
  const { data: workspace, error: wsError } = await service
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

export async function extractBrandProfileAction(
  workspaceId: string
): Promise<ActionResult<CompanyBioProfile>> {
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("domain, bio_seed_urls")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.domain) {
    return { success: false, error: "No hay dominio configurado en este workspace" };
  }

  const seedUrls = Array.isArray(workspace.bio_seed_urls)
    ? (workspace.bio_seed_urls as string[])
    : [];

  try {
    const extracted = await extractBrandProfile(workspace.domain, seedUrls);

    const { error } = await supabase.from("brand_profiles").upsert(
      {
        workspace_id: workspaceId,
        profile_data: extracted.profile,
        analysis_source_url: extracted.sourceUrl,
        analysis_model: extracted.model,
        analysis_input_digest: extracted.inputDigest,
        analyzed_at: extracted.profile.analysisInfo.analyzedAt,
        analysis_error: null,
        extracted_summary: extracted.legacy.extractedSummary,
        positioning: extracted.legacy.positioning,
        audience: extracted.legacy.audience,
        products_services: extracted.legacy.productsServices,
        differentiators: extracted.legacy.differentiators,
      },
      { onConflict: "workspace_id" }
    );

    if (error) {
      return { success: false, error: `No se pudo guardar el perfil: ${error.message}` };
    }

    const { data: refreshedWorkspace } = await supabase
      .from("workspaces")
      .select("slug")
      .eq("id", workspaceId)
      .single();
    if (refreshedWorkspace?.slug) revalidatePath(`/${refreshedWorkspace.slug}/company-bio`);

    return { success: true, data: extracted.profile };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo extraer informacion del sitio web";
    await supabase.from("brand_profiles").upsert(
      {
        workspace_id: workspaceId,
        analysis_error: message,
      },
      { onConflict: "workspace_id" }
    );
    return { success: false, error: message };
  }
}

export async function saveCompanyBioProfileAction(
  workspaceId: string,
  profile: CompanyBioProfile
): Promise<ActionResult<CompanyBioProfile>> {
  const supabase = await createClient();

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    p_workspace_id: workspaceId,
  });
  if (!canManage) return { success: false, error: "Sin permisos" };

  const website = profile.company.website?.trim() || null;
  const summary = profile.businessOverview.summary?.trim() || null;
  const legacyProducts = profile.productsServices.filter(Boolean).join("\n") || null;
  const legacyFeatures = profile.keyFeatures.filter(Boolean).join("\n") || null;

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .update({
      brand_name: profile.company.name,
      name: profile.company.name,
      domain: website,
      brand_statement: summary,
    })
    .eq("id", workspaceId);

  if (workspaceError) {
    return {
      success: false,
      error: `No se pudo actualizar el workspace: ${workspaceError.message}`,
    };
  }

  const { error: brandError } = await supabase
    .from("brands")
    .update({
      name: profile.company.name,
      domain: website,
    })
    .eq("workspace_id", workspaceId)
    .eq("type", "own");

  if (brandError) {
    return {
      success: false,
      error: `No se pudo actualizar la marca propia: ${brandError.message}`,
    };
  }

  const { error } = await supabase.from("brand_profiles").upsert(
    {
      workspace_id: workspaceId,
      profile_data: profile,
      extracted_summary: summary,
      positioning: profile.company.category ?? profile.company.industry,
      audience: profile.targetAudience || null,
      products_services: legacyProducts,
      differentiators: legacyFeatures,
      analysis_source_url: profile.analysisInfo.sourceUrl || website,
      analyzed_at: profile.analysisInfo.analyzedAt,
      analysis_error: null,
    },
    { onConflict: "workspace_id" }
  );

  if (error)
    return { success: false, error: `No se pudo guardar la Company Bio: ${error.message}` };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();
  if (workspace?.slug) revalidatePath(`/${workspace.slug}/company-bio`);

  return { success: true, data: profile };
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
