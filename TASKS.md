# Migration Roadmap

Ordered phases — each one should be a clean, working state before moving to the next.

## Phase 1 — Turborepo restructure
- [ ] Add `turbo`, `pnpm-workspace.yaml`, `turbo.json` to the existing agent repo
- [ ] `git mv` existing Mastra project into `apps/agent/` (preserve history)
- [ ] Update root scripts (`dev`, `build`, `lint`) to run through `turbo`
- [ ] Confirm `apps/agent` still runs standalone exactly as before
- [ ] Commit: "restructure: convert to turborepo monorepo"

## Phase 2 — Medusa backend
- [ ] Scaffold `apps/medusa` with the official Medusa starter
- [ ] Point it at a local plain `postgres` container (via `docker-compose.dev.yml`)
- [ ] Run initial migrations, confirm admin dashboard boots
- [ ] Seed a demo product catalog (with real images)
- [ ] Add a `tickets` module/table for the agent to write to

## Phase 3 — Storefront rebuild
- [ ] Scaffold `apps/storefront` from Medusa's Next.js starter
- [ ] Connect it to `apps/medusa`'s Store API, confirm products/cart/checkout work
- [ ] Basic branding pass (not final design polish yet)

## Phase 4 — Chat widget package
- [ ] Scaffold `packages/chat-widget` as a standalone, framework-agnostic build (Web Component)
- [ ] Widget posts messages to the agent's chat endpoint
- [ ] Embed the built widget script into `apps/storefront`
- [ ] Confirm it works standalone (drop into a plain HTML page) as a sanity check

## Phase 5 — Wire the agent to Medusa
- [ ] Replace SQLite fixture-based tools (`getOrderTool`, `getUserDataTool`, etc.) with calls to Medusa's Store/Admin API
- [ ] `createTicketTool` writes into Medusa's ticket table
- [ ] Re-verify each of the original agent workflows (refund, return, escalation, KB search) against real Medusa data

## Phase 6 — Identity & security
- [ ] Chat widget attaches the visitor's Medusa session token to outgoing messages
- [ ] Agent verifies the token server-side before running any tool
- [ ] Scope `getOrder`/`getUserData`/`createTicket` to the verified customer ID only
- [ ] Require login before answering account/order-specific questions; allow anonymous product/policy Q&A
- [ ] Re-run the original `attacks/attack-log.md` prompts (ATK-001, ATK-008 especially) against the new build to confirm the IDOR-style issues are actually closed, not just moved
- [ ] *Follow-up:* Update the system prompt so the agent states plainly when a user isn't logged in, rather than hallucinating excuses (e.g. "logged into multiple accounts").

## Phase 7 — LLM provider wiring
- [ ] Reuse existing `src/mastra/config/llm.ts` switch, no logic changes needed
- [ ] `docker-compose.yml`: add `ollama` service, default `LLM_PROVIDER=ollama`
- [ ] Decide: pull `qwen3.5:9b` on first boot vs. bake into a custom image
- [ ] Hosted deployment (Cloud Run): default `LLM_PROVIDER=openrouter` (no GPU available, and Ollama's RAM/CPU footprint doesn't suit a scale-to-zero container anyway)

## Phase 8 — Docker Compose finalization
- [ ] `docker-compose.yml`: postgres, medusa, storefront, agent, ollama — one command, seeded data, working `.env.example` defaults
- [ ] `docker-compose.dev.yml`: postgres only, for hot-reload local dev
- [ ] Use `turbo prune` per app so each Dockerfile only copies what it needs
- [ ] Test full `docker compose up --build` on a clean machine/VM

## Phase 9 — Production deployment
- [ ] Create Supabase project, get hosted `DATABASE_URL`
- [ ] Run Medusa migrations against Supabase
- [ ] Deploy `apps/storefront` to Vercel
- [ ] Set up a Google Cloud project + billing account (required to unlock free tier, but stays at $0 within limits) and enable Cloud Run + Artifact Registry
- [ ] Build & push `apps/medusa` and `apps/agent` container images (reuse the same Dockerfiles as `docker-compose.yml`)
- [ ] Deploy each as its own Cloud Run service (`medusa`, `agent`), env vars set per service (`DATABASE_URL`, `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, etc.)
- [ ] Set a Cloud Run budget alert (e.g. $1) so any unexpected usage is caught immediately, even though normal demo traffic should stay free
- [ ] Confirm the agent's Cloud Run service can reach Medusa's Cloud Run service (public URL or private networking) and that both can reach Supabase
- [ ] Add a "waking up the demo" loading state in the chat widget for cold-start requests
- [ ] Confirm live demo end-to-end: browse → chat → order lookup → ticket creation

## Phase 10 — Docs & polish
- [ ] Rewrite `README.md` final pass with real URLs
- [ ] `ARCHITECTURE.md` diagrams double-checked against actual build
- [ ] Record a short demo video/GIF for the README
- [ ] Add contribution guide if repo will be public-facing for others to run

## Deferred / optional
- [ ] Supabase Auth exploration (only if a *separate* login surface is ever needed beyond Medusa's built-in customer auth — not required for the core product)
- [ ] Supabase Storage for product images in production
