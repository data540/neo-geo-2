import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

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

const WORKSPACE_SLUG = "iberia-mvp";
const BRAND_NAME = "Iberia";
const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "david@kpi360.net";

// 4/10 prompts mencionan la marca
// Consistency = 2/10 = 20% (prompts 4 y 5 tienen consistency ≥ 70%)
// Avg position = (2+1+1+3)/4 = 1.75 → #2

const PROMPTS: Array<{
  text: string;
  country: string;
  intent: string;
  funnel_stage: string;
  brand_mentioned: boolean;
  brand_position: number | null;
  competitor_count: number;
  sov: number | null;
  sentiment: string;
  consistency_score: number;
}> = [
  {
    text: "¿Cuáles son las mejores aerolíneas para volar entre Madrid y Bogotá?",
    country: "ES",
    intent: "discovery",
    funnel_stage: "top",
    brand_mentioned: true,
    brand_position: 2,
    competitor_count: 2,
    sov: 33.3,
    sentiment: "positive",
    consistency_score: 50,
  },
  {
    text: "¿Qué aerolínea low cost opera vuelos nacionales en España?",
    country: "ES",
    intent: "discovery",
    funnel_stage: "top",
    brand_mentioned: false,
    brand_position: null,
    competitor_count: 3,
    sov: 0,
    sentiment: "no_data",
    consistency_score: 0,
  },
  {
    text: "¿Cuál es la aerolínea más puntual en vuelos domésticos en Colombia?",
    country: "CO",
    intent: "discovery",
    funnel_stage: "top",
    brand_mentioned: false,
    brand_position: null,
    competitor_count: 3,
    sov: 0,
    sentiment: "no_data",
    consistency_score: 0,
  },
  {
    text: "Compara Iberia con sus principales competidores en precio y servicio",
    country: "ES",
    intent: "comparison",
    funnel_stage: "middle",
    brand_mentioned: true,
    brand_position: 1,
    competitor_count: 2,
    sov: 50,
    sentiment: "positive",
    consistency_score: 100,
  },
  {
    text: "¿Qué opinan los pasajeros sobre Iberia? ¿Vale la pena volar con ellos?",
    country: "ES",
    intent: "reputation",
    funnel_stage: "middle",
    brand_mentioned: true,
    brand_position: 1,
    competitor_count: 0,
    sov: 100,
    sentiment: "positive",
    consistency_score: 100,
  },
  {
    text: "¿Qué franquicia de equipaje incluye Iberia en sus vuelos?",
    country: "ES",
    intent: "product_specific",
    funnel_stage: "middle",
    brand_mentioned: true,
    brand_position: 3,
    competitor_count: 1,
    sov: 50,
    sentiment: "neutral",
    consistency_score: 0,
  },
  {
    text: "¿Cómo es el proceso de check-in online de las aerolíneas en España?",
    country: "ES",
    intent: "product_specific",
    funnel_stage: "middle",
    brand_mentioned: false,
    brand_position: null,
    competitor_count: 2,
    sov: 0,
    sentiment: "no_data",
    consistency_score: 0,
  },
  {
    text: "¿Por qué elegir Iberia para volar a Latinoamérica frente a otras aerolíneas?",
    country: "ES",
    intent: "decision",
    funnel_stage: "bottom",
    brand_mentioned: false,
    brand_position: null,
    competitor_count: 0,
    sov: 0,
    sentiment: "no_data",
    consistency_score: 0,
  },
  {
    text: "¿Cuánto cuesta cambiar o cancelar un vuelo con una aerolínea española?",
    country: "ES",
    intent: "price",
    funnel_stage: "bottom",
    brand_mentioned: false,
    brand_position: null,
    competitor_count: 0,
    sov: 0,
    sentiment: "no_data",
    consistency_score: 0,
  },
  {
    text: "¿Cómo reclamar compensación por vuelo cancelado o con retraso en España?",
    country: "ES",
    intent: "reputation",
    funnel_stage: "bottom",
    brand_mentioned: false,
    brand_position: null,
    competitor_count: 0,
    sov: 0,
    sentiment: "no_data",
    consistency_score: 0,
  },
];

async function seed() {
  console.log("🌱 Iniciando seed Iberia MVP (aerolíneas)…\n");

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Error al listar usuarios:", usersError.message);
    process.exit(1);
  }

  let user = usersData.users.find((u) => u.email === USER_EMAIL);

  if (!user) {
    console.log(`⚙ Creando usuario: ${USER_EMAIL}…`);
    const userPassword = process.env.SEED_USER_PASSWORD ?? "12345678";
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: USER_EMAIL,
      password: userPassword,
      email_confirm: true,
    });

    if (createError || !newUser) {
      console.error("Error al crear usuario:", createError?.message);
      process.exit(1);
    }

    user = {
      id: newUser.user?.id ?? "",
      email: USER_EMAIL,
      app_metadata: {},
      user_metadata: {},
      aud: "",
      created_at: new Date().toISOString(),
    };
    console.log(`✓ Usuario creado: ${user.email} (${user.id})`);
  } else {
    console.log(`✓ Usuario encontrado: ${user.email} (${user.id})`);
  }

  let workspaceId: string;

  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", WORKSPACE_SLUG)
    .single();

  if (existing) {
    workspaceId = existing.id;
    console.log(`✓ Workspace existente: ${WORKSPACE_SLUG} (${workspaceId})`);
  } else {
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        slug: WORKSPACE_SLUG,
        name: "Iberia",
        brand_name: BRAND_NAME,
        domain: "iberia.com",
        brand_statement:
          "Aerolínea de bandera española con vuelos a más de 130 destinos en Europa, América, África y Oriente Medio.",
        country: "ES",
      })
      .select("id")
      .single();

    if (wsError || !ws) {
      console.error("Error al crear workspace:", wsError?.message);
      process.exit(1);
    }

    workspaceId = ws.id;
    console.log(`✓ Workspace creado: ${WORKSPACE_SLUG} (${workspaceId})`);
  }

  await supabase
    .from("workspace_members")
    .upsert(
      { workspace_id: workspaceId, user_id: user.id, role: "owner" },
      { onConflict: "workspace_id,user_id" }
    );
  console.log("✓ Membership owner asignada");

  const { data: ownBrand } = await supabase
    .from("brands")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("type", "own")
    .single();

  let brandId: string;
  if (ownBrand) {
    brandId = ownBrand.id;
  } else {
    const { data: b, error: bErr } = await supabase
      .from("brands")
      .insert({
        workspace_id: workspaceId,
        name: BRAND_NAME,
        domain: "iberia.com",
        aliases: ["Iberia Airlines", "Iberia Express"],
        type: "own",
      })
      .select("id")
      .single();

    if (bErr || !b) {
      console.error("Error al crear brand:", bErr?.message);
      process.exit(1);
    }
    brandId = b.id;
  }
  console.log(`✓ Brand propia: ${BRAND_NAME} (${brandId})`);

  const competitors = [
    { name: "Vueling", domain: "vueling.com", aliases: ["Vueling Airlines"] },
    { name: "Air Europa", domain: "aireuropa.com", aliases: ["Air Europa Líneas Aéreas"] },
  ];

  for (const comp of competitors) {
    const { data: existingComp } = await supabase
      .from("brands")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", comp.name)
      .single();

    if (!existingComp) {
      await supabase.from("brands").insert({
        workspace_id: workspaceId,
        name: comp.name,
        domain: comp.domain,
        aliases: comp.aliases,
        type: "competitor",
      });
    }
  }
  console.log("✓ Competidores creados: Vueling, Air Europa");

  const { data: provider } = await supabase
    .from("llm_providers")
    .select("id")
    .eq("key", "chatgpt")
    .single();

  if (!provider) {
    console.error("No se encontró el proveedor chatgpt. ¿Has aplicado las migraciones?");
    process.exit(1);
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: existingPrompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (existingPrompts && existingPrompts.length > 0) {
    console.log(
      `⚠ Ya existen ${existingPrompts.length} prompts en el workspace. Saltando creación.`
    );
    console.log("\n✅ Seed completado (workspace ya inicializado)\n");
    return;
  }

  console.log("\nCreando 10 prompts con métricas…");

  for (let i = 0; i < PROMPTS.length; i++) {
    const p = PROMPTS[i];
    if (!p) continue;

    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .insert({
        workspace_id: workspaceId,
        text: p.text,
        country: p.country,
        status: "active",
        intent: p.intent,
        funnel_stage: p.funnel_stage,
      })
      .select("id")
      .single();

    if (promptError || !prompt) {
      console.error(`Error creando prompt ${i + 1}:`, promptError?.message);
      continue;
    }

    const { data: run, error: runError } = await supabase
      .from("prompt_runs")
      .insert({
        workspace_id: workspaceId,
        prompt_id: prompt.id,
        llm_provider_id: provider.id,
        status: "completed",
        raw_response: `[seed] Respuesta simulada para: ${p.text}`,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError || !run) {
      console.error(`Error creando run para prompt ${i + 1}:`, runError?.message);
      continue;
    }

    if (p.brand_mentioned) {
      await supabase.from("mentions").insert({
        workspace_id: workspaceId,
        prompt_run_id: run.id,
        brand_id: brandId,
        brand_name_detected: BRAND_NAME,
        brand_type: "own",
        position: p.brand_position,
        sentiment: p.sentiment,
        confidence: 1.0,
      });
    }

    await supabase.from("daily_prompt_metrics").upsert(
      {
        workspace_id: workspaceId,
        prompt_id: prompt.id,
        llm_provider_id: provider.id,
        date: today,
        brand_mentioned: p.brand_mentioned,
        brand_position: p.brand_position,
        competitor_count: p.competitor_count,
        sov: p.sov,
        sentiment: p.sentiment,
        consistency_score: p.consistency_score,
      },
      { onConflict: "prompt_id,llm_provider_id,date" }
    );

    console.log(
      `  ${i + 1}/10 ${p.brand_mentioned ? "✓ Mencionada" : "○ No mencionada"} pos:${p.brand_position ?? "—"} consistency:${p.consistency_score}%`
    );
  }

  const mentionedCount = PROMPTS.filter((p) => p.brand_mentioned).length;
  const positions = PROMPTS.filter((p) => p.brand_position !== null).map(
    (p) => p.brand_position as number
  );
  const avgPos =
    positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
  const sovValues = PROMPTS.filter((p) => p.sov !== null && p.sov > 0);
  const avgSov =
    sovValues.length > 0 ? sovValues.reduce((a, p) => a + (p.sov ?? 0), 0) / sovValues.length : 0;

  await supabase.from("daily_workspace_metrics").upsert(
    {
      workspace_id: workspaceId,
      llm_provider_id: provider.id,
      date: today,
      active_prompts_count: PROMPTS.length,
      brand_mentions_count: mentionedCount,
      avg_position: avgPos,
      brand_consistency: 20,
      avg_sov: avgSov,
    },
    { onConflict: "workspace_id,llm_provider_id,date" }
  );

  console.log(`\n📊 KPIs resultantes:`);
  console.log(`  Brand Mentions: ${mentionedCount}/${PROMPTS.length}`);
  console.log(`  Avg Position: #${avgPos ? Math.round(avgPos) : "—"}`);
  console.log(`  Brand Consistency: 20%`);
  console.log(`  Avg SoV: ${avgSov.toFixed(1)}%`);
  console.log(`\n✅ Seed completado. Accede a /${WORKSPACE_SLUG}/prompts\n`);
}

seed().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
