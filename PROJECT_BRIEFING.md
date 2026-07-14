# Project Briefing — Read This First

> **Audience:** this file is written for an AI coding agent (e.g. Claude Opus in Antigravity) picking up this project. Read this file first, then `README.md`, `ARCHITECTURE.md`, and `TASKS.md` for full detail. This file tells you **the current state** and **the exact order to work in** so you don't jump ahead or redo work.

---

## 1. Current state (do not treat this as a fresh project)

There is already a **working, pushed-to-GitHub repository**: a standalone Mastra v1 (TypeScript) support agent called **"Sarah"** for a fictional shop, ShopEasy. It already has:

- Order tracking, refund, return, escalation, and knowledge-base-search tools/workflows
- A working **PostgreSQL** database (pgvector for embeddings — this project does **not** use SQLite anymore, that was migrated away already)
- A working `docker-compose.yml` and `Dockerfile`
- An LLM provider switch in `src/mastra/config/llm.ts` (`LLM_PROVIDER=ollama` or `openrouter`) — **already built, do not rebuild this**
- Two branches: `vulnerable` and `hardened`, from an earlier OWASP LLM/Agentic red-team exercise

**This repo is the starting point.** Nothing gets deleted or recreated from scratch. Everything below is added *on top of* this repo, preserving its git history.

## 2. What we're building toward

The end state: a full ecommerce demo — a real storefront (Medusa + Next.js) with this same agent embedded as a chat widget, organized as a **Turborepo monorepo**, runnable either as a free hosted demo or fully offline via `docker compose up`. Full design is in `ARCHITECTURE.md`. Full checklist is in `TASKS.md`. This file is about **sequencing** — do the steps below in order, and confirm each one works before starting the next. Do not skip a verification step to move faster.

---

## 3. Execution order — follow this sequence exactly

### Step 1 — Add Turborepo to the existing repo
Add `turbo`, `pnpm-workspace.yaml`, and `turbo.json` **on top of** the current repo. Do not create a new repo or new folder structure elsewhere first.

### Step 2 — Move the existing agent with `git mv`, not delete+recreate
Move the current project into `apps/agent/` using `git mv`, so git history/blame is preserved. **Never** delete the existing files and rewrite them fresh — that destroys history and is unnecessary.

### Step 3 — STOP and test
Run `docker compose up` (the dev setup) from the new location and confirm the agent still works exactly as before the move — chat still responds, tools still run, DB still connects. **Do not proceed to Step 4 until this passes.** If it doesn't run, fix the move before adding anything else.

### Step 4 — Add Medusa under `apps/medusa/`
Scaffold Medusa fresh (official starter). Connect it to a local Postgres container. Get the Medusa **admin dashboard** running and a demo product catalog seeded.

### Step 5 — STOP and test Medusa alone
Confirm Medusa's admin dashboard loads, products are visible, and its Store/Admin API responds — **before** touching the storefront or wiring the agent to it. Medusa needs to be solid on its own first.

### Step 6 — Add the storefront under `apps/storefront/` and connect it to Medusa
Scaffold from Medusa's Next.js starter. Wire it to Medusa's Store API. Confirm: browsing products, adding to cart, and placing a **cash-on-delivery** order all work end-to-end (see business rules below — no Stripe).

### Step 7 — Wire up the database properly across all apps
Make sure `apps/medusa` (and anything else touching data) is reading the same `DATABASE_URL` consistently. Locally this is a plain Postgres container. Don't forget migrations run cleanly from scratch on a new container (test with `docker compose down -v` then `up` again).

### Step 8 — STOP and test the full local stack together
Run the complete `docker compose up` with agent + Medusa + storefront + database together. Confirm nothing that worked in isolation breaks when combined (port conflicts, env var mismatches, etc). This is the checkpoint before moving to the chat widget and agent-to-Medusa wiring described in `TASKS.md` Phases 4–6.

### After this point
Continue with the remaining phases in `TASKS.md` (chat widget package, agent-to-Medusa tool wiring, identity/auth scoping, LLM provider wiring, production deployment) — those are already detailed there and don't need repeating here.

---

## 4. Business rules to encode (don't guess these — they're fixed)

- **Payment: cash on delivery only.** No Stripe, no payment gateway, no online payment integration of any kind. Checkout collects the order but takes no payment.
- **Order status automation**, fully automatic, no manual admin action required for a demo order to progress:
  1. Order is created → status **`pending`**
  2. **1 hour later** → status automatically becomes **`confirmed`**
  3. **1 hour after that** (2 hours after creation) → status automatically becomes **`shipped`**

This needs some form of scheduled/delayed job — Medusa has a native scheduled-jobs concept that's worth checking first before building a custom cron solution from scratch. Whatever implementation is chosen, it must run automatically with no human in the loop, since this is a self-serve demo.

## 5. Things not to do

- Don't delete or recreate the existing agent repo — move and extend it.
- Don't skip the "stop and test" checkpoints above to save time — each one exists because the next step depends on the previous one actually working.
- Don't add Stripe or any payment processor.
- Don't jump to production/hosted deployment before the full local Docker stack (Step 8) passes.
- Don't rebuild the LLM provider switch — it already exists in `src/mastra/config/llm.ts`.
