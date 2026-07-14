# Architecture

## Overview

Three services share one database. The storefront is a real Medusa-powered ecommerce site; the agent is a real Mastra service reading/writing the same data through Medusa's API — nothing in the demo is mocked.

```
┌─────────────────────┐        ┌──────────────────────┐
│   apps/storefront    │        │      apps/agent       │
│   (Next.js)           │        │   (Mastra — "Sarah")   │
│                        │        │                        │
│  ┌──────────────────┐ │        │  Tools call Medusa API │
│  │ packages/         │ │  chat  │  scoped to verified    │
│  │ chat-widget        │─┼───────▶  customer identity     │
│  └──────────────────┘ │  msgs  │                        │
└──────────┬─────────────┘        └──────────┬─────────────┘
           │ Store API                        │ Store/Admin API
           ▼                                  ▼
        ┌─────────────────────────────────────────┐
        │              apps/medusa                  │
        │  Commerce engine + built-in customer auth  │
        │  Products · Cart · Orders · Tickets module │
        └──────────────────┬──────────────────────┘
                           │ Postgres protocol
                           ▼
                ┌─────────────────────┐
                │      PostgreSQL       │
                │ local: plain container │
                │ prod: Supabase hosted  │
                └─────────────────────┘
```

## Components

### apps/medusa — commerce engine
Handles products, variants, cart, checkout, orders, and customer accounts. Ships its own admin dashboard and its own JWT-based customer authentication — this is the **single source of truth for identity**, no separate auth provider needed. A custom `tickets` module/table stores support tickets the agent creates.

### apps/storefront — Next.js store
Renders the shop using Medusa's Store API (via the official Medusa Next.js starter, customized). Embeds the chat widget as a script include, same as any third-party integrator would.

### packages/chat-widget — standalone embeddable widget
Framework-agnostic (Web Component), built independently of the storefront. Attaches the visitor's Medusa session token (if logged in) to every message sent to the agent. Can, in principle, be dropped onto any external site pointed at this agent.

### apps/agent — Mastra support agent ("Sarah")
Same tool/workflow architecture as the original standalone project (order tracking, refunds, returns, escalation, KB search, ticketing), but tools now call **Medusa's API** instead of local fixtures. LLM provider is switchable at runtime via `LLM_PROVIDER` (Ollama locally, OpenRouter in production/hosted demo — Cloud Run's scale-to-zero model doesn't suit a GPU-hungry local model anyway).

## Identity & security model

One identity system, not two:

1. Customer logs in via Medusa's built-in auth (storefront handles this).
2. The chat widget attaches that session token to every message sent to the agent.
3. The agent **verifies the token server-side** before running any tool — it never trusts an identity claim embedded in the chat text itself.
4. Every tool touching personal data (`getOrder`, `getUserData`, `createTicket`) is scoped to the verified customer ID from the token, not to anything the user typed.
5. Unauthenticated visitors can ask general product/policy questions; the agent requires a valid session before answering anything account- or order-specific, and refuses otherwise.

This directly closes the IDOR-style vulnerability class documented in the original repo's `attacks/attack-log.md` (ATK-001, ATK-008) — a good regression test to keep once this is rebuilt: verify the new agent refuses the same injected "show me all users" style prompts now that identity is enforced structurally instead of by convention.

## Database & hosting split

| Environment | Postgres | LLM | Storefront host | Medusa + Agent host |
|---|---|---|---|---|
| Local (`docker compose up`) | plain `postgres` container | Ollama (qwen3.5:9b) container | localhost:3000 | localhost containers |
| Hosted demo | Supabase (hosted) | OpenRouter | Vercel | **Google Cloud Run** (one service each) |

Same `DATABASE_URL`-shaped connection either way — Medusa doesn't distinguish a local container from a hosted Supabase instance, it's just Postgres.

### Why Cloud Run over Render

Both Medusa and the agent are already built as Docker containers for local Compose — Cloud Run deploys those **same images directly**, so there's no separate "production build" path to maintain.

Render's free tier shares a single pool of 750 instance-hours per month **across all free services in a workspace**, and running two services continuously would exceed that pool well before month's end; its free web services also sleep after 15 minutes idle with a 30–60s cold start each. Since the agent calls Medusa's API on nearly every request, both services sleeping at once means a cold visitor could face a cascading wake-up (agent wakes, then waits on Medusa to wake) of up to ~2 minutes.

Cloud Run's free tier is usage-based rather than wall-clock instance-hours — 2 million requests, 360,000 GB-seconds of memory, and 180,000 vCPU-seconds per month, per service, not shared across services. Cold starts still happen on scale-to-zero, but they're typically sub-second to a few seconds for a lean Node container, versus Render's 30–60s. This is the deciding factor: it's the only genuinely free option that comfortably supports two interdependent services without the shared-hour or cascading cold-start problems.

**UX mitigation regardless of platform:** the chat widget shows a friendly "waking up the demo, this can take a moment" state on a slow first response, rather than treating a cold start as an error.

## Docker Compose files

- **`docker-compose.yml`** — full offline stack: `postgres`, `medusa`, `storefront`, `agent`, `ollama`. One command, seeded demo data, no external accounts required.
- **`docker-compose.dev.yml`** — infra only (`postgres`), for running each app locally with hot reload during active development.

## Open design decisions (revisit as needed)

- Whether the local Ollama model is pulled on first boot vs. baked into a custom image (tradeoff: smaller repo/image vs. slower first run).
- Whether `packages/chat-widget` ships as a Web Component or a lighter vanilla-JS bundle.
- Whether ticket data lives in a dedicated Medusa module or a simpler custom table read/written directly by the agent.
