# AGENTS

## Client and domain scope (critical)
- This app is now single-vertical and single-client: one specific airline.
- Do **not** design generic multi-sector prompts; all prompts, analytics, and workflows must target airline operations.
- Geographic focus is Spain first and Colombia second; prioritize regulations, customer expectations, and route context for these markets.
- Treat prompt use cases as airline support and operations intelligence (e.g., cancellations, delays, baggage, check-in, refunds, rebooking, compensation, disruptions).
- When changing prompt logic, schema, or analysis features, ensure outputs are airline-specific and aligned to this client context.

## Repo reality checks
- `README.md` is the default Next.js template and does **not** describe this app; trust `src/`, `supabase/migrations/`, and `package.json` instead.
- Use `pnpm` (lockfile is `pnpm-lock.yaml`).
- There is no CI or test suite config in-repo right now; do focused local verification.

## Commands that matter
- Install deps: `pnpm install`
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint` (Biome check)
- Auto-fix lint/style: `pnpm lint:fix`
- Format: `pnpm format`
- Typecheck (no script exists): `pnpm exec tsc --noEmit`

## Known script/config quirks
- `package.json` has `seed` -> `tsx scripts/seed.ts`, but `scripts/` is currently empty.
- `biome.json` ignores `*.config.ts`, `*.config.mjs`, and `src/components/ui/**`; edits there will not be linted/formatted by Biome.
- `pnpm-workspace.yaml` is present but this is effectively a single-package app.

## Architecture map (high signal)
- Next.js App Router app under `src/app` with route groups `(auth)` and `(app)`.
- Auth gate is enforced in `middleware.ts` (everything except static assets and `/api/inngest`) and again in app layouts.
- Server actions live in `src/actions/*` and do most mutations.
- Main backend is Supabase:
  - client helpers: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
  - schema and policies: `supabase/migrations/*.sql`
- Async jobs run via Inngest:
  - endpoint: `src/app/api/inngest/route.ts`
  - functions: `src/inngest/functions/*.ts`
  - trigger pattern: actions call `inngest.send(...)`, functions write results to Supabase.

## Environment and runtime behavior
- Copy `.env.local.example` to `.env.local` for required keys.
- If LLM API keys are missing, `src/lib/llm/runner.ts` falls back to mock responses (`hasApiKey`/`mockRunPrompt`), so prompt-run flows can appear successful without real provider calls.
- Inngest signing/event keys are read from env in `src/inngest/client.ts` and `src/app/api/inngest/route.ts`.

## Safe verification flow for changes
- Preferred order after edits: `pnpm lint` -> `pnpm exec tsc --noEmit` -> `pnpm build`.
- If touching prompt execution or metrics paths, verify both:
  - server action trigger in `src/actions/prompts.ts`
  - corresponding Inngest function in `src/inngest/functions/`.
