import type { Context, Next } from "hono";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { randomUUID } from "crypto";
import { agentMemory } from "./memory/memory.js";

export async function copilotKitThreadMiddleware(c: any, next: any) {
  const requestContext = c.get("requestContext");
  const userId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);

  if (userId && userId !== "anonymous") {
    try {
      const threads = await agentMemory.listThreads({ resourceId: userId });
      let threadId: string;
      if (threads && threads.length > 0) {
        threadId = threads[0].id;
        console.log(`[copilotKitThreadMiddleware] Reusing thread ${threadId} for customer ${userId}`);
      } else {
        threadId = randomUUID();
        await agentMemory.saveThread({
          thread: {
            id: threadId,
            resourceId: userId,
            title: `Copilot Thread for ${userId}`,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`[copilotKitThreadMiddleware] Created new thread ${threadId} for customer ${userId}`);
      }

      if (c.req.method === "POST") {
        try {
          const body = await c.req.json();
          if (body.body) {
            body.body.threadId = threadId;
          } else if (body.params) {
            body.params.threadId = threadId;
          } else {
            body.threadId = threadId;
          }

          // Clear cached parsed body in Hono
          delete (c.req as any)._parsedBody;

          const headers = new Headers(c.req.raw.headers);
          headers.delete("content-length");

          // Replace raw request body
          c.req.raw = new Request(c.req.raw, {
            body: JSON.stringify(body),
            method: c.req.method,
            headers,
            duplex: "half",
          } as any);
        } catch (err: any) {
          console.warn("[copilotKitThreadMiddleware] Failed to rewrite request body:", err.message);
        }
      }
    } catch (err: any) {
      console.error("[copilotKitThreadMiddleware] Error looking up/creating thread:", err);
    }
  }

  await next();
}


export async function apiKeyMiddleware(c: any, next: any) {
  // Mastra Studio, when running via `mastra dev` on the same origin, tags
  // its own internal requests with this header automatically. This lets us
  // keep strict API-key auth for real external callers (your widget, etc.)
  // without locking ourselves out of Studio during local development.
  if (c.req.header("x-mastra-dev-playground") === "true") {
    return next();
  }

  // Only check x-api-key since Authorization is now reserved for the Medusa session token
  const apiKey = c.req.header("x-api-key");
  const validKey = process.env.API_SECRET_KEY;

  if (validKey && apiKey !== validKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();

  // Strip system prompt instructions from agent metadata responses to prevent leakage (OWASP LLM07)
  const url = new URL(c.req.url);
  if (
    c.res.status === 200 &&
    c.res.headers.get("content-type")?.includes("application/json") &&
    (url.pathname.endsWith("/api/agents") || url.pathname.includes("/api/agents/"))
  ) {
    try {
      const body = await c.res.json();
      const stripInstructions = (val: any): any => {
        if (!val || typeof val !== "object") return val;
        if (Array.isArray(val)) return val.map(stripInstructions);
        const cleaned = { ...val };
        if ("instructions" in cleaned) {
          delete cleaned.instructions;
        }
        for (const key of Object.keys(cleaned)) {
          if (cleaned[key] && typeof cleaned[key] === "object" && "instructions" in cleaned[key]) {
            cleaned[key] = { ...cleaned[key] };
            delete cleaned[key].instructions;
          }
        }
        return cleaned;
      };
      c.res = c.json(stripInstructions(body));
    } catch (err) {
      console.error("[Middleware] Error stripping instructions:", err);
    }
  }
}

// Verifies the Medusa session token directly with the Medusa server
export async function userIdentityMiddleware(c: any, next: any) {
  const authHeader = c.req.header("authorization");
  const requestContext = c.get("requestContext");

  console.log(`[userIdentityMiddleware] path=${c.req.path} authHeader present: ${!!authHeader}`);

  if (authHeader && requestContext) {
    try {
      const pk = (process.env.MEDUSA_PUBLISHABLE_KEY || "").replace(/^["']|["']$/g, '');
      const medusaUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
      console.log(`[userIdentityMiddleware] Verifying against: ${medusaUrl}/store/customers/me`);
      console.log(`[userIdentityMiddleware] Using publishable key: '${pk}'`);

      const response = await fetch(`${medusaUrl}/store/customers/me`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "x-publishable-api-key": pk
        }
      });

      console.log(`[userIdentityMiddleware] Medusa response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        if (data.customer?.id) {
          console.log(`[userIdentityMiddleware] ✅ Resolved customer ID: ${data.customer.id}`);
          requestContext.set(MASTRA_RESOURCE_ID_KEY, data.customer.id);
        } else {
          console.log(`[userIdentityMiddleware] ⚠️ Response OK but no customer.id in body:`, JSON.stringify(data));
        }
      } else {
        const errText = await response.text();
        console.log(`[userIdentityMiddleware] ❌ Medusa rejected token:`, errText);
      }
    } catch (err) {
      console.error("[userIdentityMiddleware] Failed to verify Medusa session:", err);
    }
  }

  await next();
}