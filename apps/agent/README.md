# 🤖 ShopEasy Customer Support Agent (Sarah)

This directory contains the standalone **Mastra v1 (TypeScript) Support Agent ("Sarah")** along with security logging and mock database configurations.

---

## 📐 Standalone Database Split

In standalone mode, the agent is configured to spin up two separate Postgres databases to replicate the production configuration:
* **`agent_db` (Port 5432)**: Stores conversation threads, history, and Mastra vector memory tables.
* **`store_db` (Port 5434)**: Stores the support tickets and order lookup tables that the agent queries.

---

## 🔌 Standalone Port Mapping

When running the agent alone, the containers will bind to the following host ports:

| Service | Container Port | Host Port | Purpose |
|---|---|---|---|
| **Mastra Agent / Studio** | `4111` | `4111` | The agent server and Hono API playground |
| **Agent DB (Postgres)** | `5432` | `5432` | Postgres database with pgvector for memory |
| **Store DB (Postgres)** | `5432` | `5434` | Postgres database for mock business data |

---

## 🚀 Running Standalone Agent

### Step 1: Copy Environment Template
```bash
cp .env.example .env
```

### Step 2: Choose Execution Mode

#### Option A: Running with OpenRouter (Cloud LLM)
Make sure `OPENROUTER_API_KEY` is set in your `.env` file, then boot using standard Docker Compose:
```bash
docker compose up --build
```

#### Option B: Running with local Ollama (Nvidia GPU Accelerated)
To run fully offline using Nvidia GPU capabilities for local LLM execution:
```bash
docker compose -f docker-compose.local.yml up --build
```
This configuration starts an Ollama instance, downloads the `qwen3.5:9b` model automatically, and wires it to the Mastra server.

---

## 🔒 Security Auditing

The agent's prompts and vulnerabilities logs are stored inside the `attacks/` folder.

To review test logs, check the [attack-log.md](./attacks/prompts/attack-log.md) file.
To execute test prompts, navigate to Mastra Studio at [http://localhost:4111](http://localhost:4111).
