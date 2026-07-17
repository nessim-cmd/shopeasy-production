# 🛒 ShopEasy Storefront

This directory contains the **Next.js Storefront** built on top of the Medusa Storefront Starter and integrated with the Mastra CopilotKit chatbot.

## 🚀 Getting Started

### Step 1: Set up Environment Variables
Ensure you have a `.env.local` file inside this directory:
```bash
cp .env.template .env.local
```

Configure:
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`: URL of the Medusa server (default: `http://localhost:9000`).
- `AGENT_URL`: URL of the Mastra agent (default: `http://localhost:4111`).
- `API_SECRET_KEY`: Shared secret key for API requests.

### Step 2: Running Locally

If running outside Docker:
```bash
pnpm install
pnpm run dev
```

The storefront will be available at [http://localhost:8000](http://localhost:8000).

---

## 🤖 CopilotKit Support Widget

The chat widget is implemented in `src/components/ChatWidget.tsx` using **CopilotKit**. 
It handles:
1. Routing user queries through the server-side API proxy `/api/copilotkit` (to hide API keys and secure credentials).
2. Fetching customer details server-side using the `getAuthHeaders()` cookie utility.
3. Attaching the customer's authenticated Medusa JWT to requests so the agent can safely fetch real orders, address details, and update appointments.
