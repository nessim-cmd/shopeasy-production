# 🛒 ShopEasy — AI-Powered Commerce Demo

A real, working ecommerce storefront with an AI support agent embedded as a chat widget. Ask about products, track orders, request refunds, or open a support ticket — the agent is talking to the same live database the store runs on, not a mock.

Built as a **Turborepo monorepo**: a Next.js storefront on top of **Medusa** (open-source commerce engine), a **Mastra** support agent ("Sarah"), and a standalone, embeddable **chat widget** package.

> This project evolved from a standalone Mastra agent (security red-team exercise against OWASP LLM/Agentic Top 10) into a full commerce product. See `ARCHITECTURE.md` for the full system design and `TASKS.md` for the migration roadmap.

---

## 🚀 Two ways to try it

### 1. Live demo (zero setup)
- Storefront: `<vercel-url>`
- No account needed, real seeded product catalog, real cart/checkout (test mode)
- Chat with Sarah in the bottom-right widget

### 2. Run it yourself, fully offline
```bash
git clone https://github.com/nessim-cmd/shopeasy.git
cd shopeasy
cp .env.example .env
docker compose up --build
```
That's it — no cloud account, no manual config. First boot seeds the product catalog and (if using Ollama) pulls the local LLM, so it may take a few minutes.

| Interface | URL | Purpose |
|---|---|---|
| Storefront | http://localhost:3000 | The actual store + chat widget |
| Medusa Admin | http://localhost:9000/app | Manage products, orders, tickets |
| Mastra Studio | http://localhost:4111 | Debug/test the agent directly |

---

## 📦 Monorepo structure

```
apps/
  storefront/     Next.js storefront (Medusa Store API + chat widget embed)
  medusa/         Medusa backend + admin dashboard
  agent/          Mastra support agent ("Sarah")
packages/
  chat-widget/    Standalone embeddable chat widget (framework-agnostic)
  shared/         Shared types/schemas used across apps
docker-compose.yml       Full offline stack (try-it-now)
docker-compose.dev.yml   Infra-only (Postgres), for active development
ARCHITECTURE.md
TASKS.md
```

## 🔑 Environment variables

See `.env.example` for the full list. Key switches:

```env
# Database — same Postgres protocol locally and in production
DATABASE_URL=postgres://...          # local container OR Supabase connection string

# LLM provider — switch anytime, no code changes
LLM_PROVIDER=ollama                  # or "openrouter"
OLLAMA_MODEL=qwen3.5:9b
OPENROUTER_API_KEY=...
```

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Storefront | Next.js (Medusa Next.js Starter) |
| Commerce engine | [Medusa](https://medusajs.com) — products, cart, orders, checkout, built-in customer auth |
| Chat widget | Standalone JS bundle (Web Component), embeddable on any site |
| Agent framework | [Mastra](https://mastra.ai) v1 (TypeScript) |
| Database | PostgreSQL — plain container locally, [Supabase](https://supabase.com) hosted in production |
| LLM (local) | [Ollama](https://ollama.com) — qwen3.5:9b |
| LLM (cloud) | [OpenRouter](https://openrouter.ai) |
| Hosting | Storefront on Vercel, Medusa + Agent on Google Cloud Run (free tier) |

## 👤 Author

**Nessim Ben Nasr** — Big Data & AI Engineering Student, Polytech-Intl Tunis
GitHub: [@nessim-cmd](https://github.com/nessim-cmd) · LinkedIn: [linkedin.com/in/nessim-bennasr](https://linkedin.com/in/nessim-bennasr)
