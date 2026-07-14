process.on("uncaughtException", (err) => {
  console.error("=== UNCAUGHT EXCEPTION ===");
  console.error(err?.stack || err);
});

process.on("unhandledRejection", (reason) => {
  console.error("=== UNHANDLED REJECTION ===");
  console.error(reason instanceof Error ? reason.stack : reason);
});

import "./config/patchEnv.js";
import "dotenv/config";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { registerApiRoute } from "@mastra/core/server";
import { readFileSync } from "fs";
import path from "path";
import { PostgresStore } from "@mastra/pg";

import { PROJECT_ROOT } from "./config/root.js";
import { getBusinessDB } from "./data/db.js";
import { supportAgent } from "./agents/supportAgent.js";
import { agentMemory } from "./memory/memory.js";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { randomUUID } from "crypto";
import { dailyReportWorkflow } from "./workflows/dailyReportWorkflow.js";
import { handleRefundWorkflow } from "./workflows/handleRefundWorkflow.js";
import { escalateWorkflow } from "./workflows/escalateWorkflow.js";
import { scheduleReturnWorkflow } from "./workflows/scheduleReturnWorkflow.js";
import { trackOrderWorkflow } from "./workflows/trackOrderWorkflow.js";
import { apiKeyMiddleware, userIdentityMiddleware } from "./middleware.js";

const customLogger = new PinoLogger({
  name: "ShopEasyAgent",
  level: "debug",
});

export const mastra = new Mastra({
  agents: { supportAgent },
  workflows: {
    dailyReportWorkflow,
    handleRefundWorkflow,
    escalateWorkflow,
    scheduleReturnWorkflow,
    trackOrderWorkflow,
  },
  storage: new PostgresStore({
    id: "shopeasy-pg-storage",
    connectionString: process.env.DATABASE_URL,
  }),
  logger: customLogger,
  server: {
  apiPrefix: "/api",
  cors: {
    origin: "*", // or restrict to ["https://store-agent-five.vercel.app", "http://localhost:3000"] once confirmed working
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-mastra-client-type",
      "x-mastra-dev-playground",
      "x-api-key",
      "x-user-id",
    ],
    exposeHeaders: ["Content-Length", "X-Requested-With"],
    credentials: false,
  },
  middleware: [
    { handler: apiKeyMiddleware, path: "/api/*" },
    { handler: userIdentityMiddleware, path: "/api/*" },
    { handler: apiKeyMiddleware, path: "/chat/*" },
    { handler: userIdentityMiddleware, path: "/chat/*" },
  ],
    apiRoutes: [
      // ❌ Removed: registerApiRoute("/", ...) — this was overriding the root
      // path and hijacking it from Mastra Studio, which normally serves its
      // playground UI there. src/mastra/public/index.html never existed,
      // hence the ENOENT error you were seeing at localhost:4111.
      // If you later want a custom landing page, serve it from a path
      // other than "/" (e.g. "/demo") so Studio keeps the root.

      registerApiRoute("/products", {
        method: "GET",
        handler: async (c) => {
          try {
            const html = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/products.html"), "utf-8");
            return c.html(html);
          } catch (err: any) {
            return c.text("Error loading products.html: " + err.message, 500);
          }
        },
      }),
      registerApiRoute("/custom/products", {
        method: "GET",
        handler: async (c) => {
          try {
            const db = getBusinessDB();
            const rows = await db.query("SELECT * FROM products");
            return c.json(rows);
          } catch (err: any) {
            return c.json({ error: err.message }, 500);
          }
        },
      }),
      registerApiRoute("/images/shopeasy-logo.jpg", {
        method: "GET",
        handler: async (c) => {
          try {
            const imagePath = path.join(PROJECT_ROOT, "src/mastra/public/shopeasy-logo.jpg");
            const buffer = readFileSync(imagePath);
            return c.body(buffer, 200, {
              "Content-Type": "image/jpeg",
            });
          } catch (err: any) {
            return c.text("Error loading logo: " + err.message, 404);
          }
        },
      }),
      registerApiRoute("/widget.js", {
        method: "GET",
        handler: async (c) => {
          try {
            const js = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/widget.js"), "utf-8");
            return c.body(js, 200, {
              "Content-Type": "application/javascript",
            });
          } catch (err: any) {
            return c.text("Error loading widget.js: " + err.message, 404);
          }
        },
      }),
      registerApiRoute("/widget.css", {
        method: "GET",
        handler: async (c) => {
          try {
            const css = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/widget.css"), "utf-8");
            return c.body(css, 200, {
              "Content-Type": "text/css",
            });
          } catch (err: any) {
            return c.text("Error loading widget.css: " + err.message, 404);
          }
        },
      }),
      registerApiRoute("/chat/message", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const { message, sessionId } = body;
            let { threadId } = body;

            // 1. Get resourceId (authenticated user or anonymous session)
            const requestContext = c.get("requestContext");
            let resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);

            if (!resourceId) {
              // Anonymous fallback
              resourceId = sessionId || c.req.header("x-session-id") || "anonymous";
              console.log(`\n[POST /chat/message] Access: UNVERIFIED. Using fallback resourceId: ${resourceId}`);
            } else {
              console.log(`\n[POST /chat/message] Access: VERIFIED MEDUSA SESSION. Using resourceId: ${resourceId}`);
            }

            // 2. Generate threadId if not provided
            if (!threadId) {
              threadId = randomUUID();
            }

            // 3. Generate response using supportAgent
            const result = await supportAgent.generate(message, {
              threadId,
              resourceId,
            });

            const rawText = result.text || "";
            const cleanText = rawText
              .replace(/<START_OF_TURN>/g, '')
              .replace(/START_OF_TURN>/g, '')
              .replace(/<REMEMBER>[\s\S]*?REMEMBER>/g, '')
              .replace(/<\/REMEMBER>/g, '') // Just in case it outputs standard XML
              .trim();
              
            return c.json({ threadId, reply: cleanText });
          } catch (err: any) {
            console.error("Error in /chat/message:", err);
            return c.json({ error: err.message }, 500);
          }
        },
      }),
      registerApiRoute("/chat/threads", {
        method: "GET",
        handler: async (c) => {
          try {
            const requestContext = c.get("requestContext");
            const userId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);

            if (!userId) {
              return c.json({ error: "Unauthorized" }, 401);
            }

            const threads = await agentMemory.listThreads({ resourceId: userId });
            return c.json(threads);
          } catch (err: any) {
            console.error("Error in /chat/threads:", err);
            return c.json({ error: err.message }, 500);
          }
        },
      }),
      registerApiRoute("/chat/threads/:threadId/messages", {
        method: "GET",
        handler: async (c) => {
          try {
            const threadId = c.req.param("threadId");
            const requestContext = c.get("requestContext");
            const userId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);

            if (!userId) {
              return c.json({ error: "Unauthorized" }, 401);
            }

            // Verify the thread exists and belongs to the user
            const thread = await agentMemory.getThreadById({ threadId });
            if (!thread || thread.resourceId !== userId) {
              // Treat mismatch as not found to avoid leaking existence
              return c.json({ error: "Not Found" }, 404);
            }

            const store = await agentMemory.getMemoryStore();
            const messages = await store.listMessages({ threadId });
            
            return c.json(messages);
          } catch (err: any) {
            console.error("Error in /chat/threads/:threadId/messages:", err);
            return c.json({ error: err.message }, 500);
          }
        },
      }),
    ],
  },
});