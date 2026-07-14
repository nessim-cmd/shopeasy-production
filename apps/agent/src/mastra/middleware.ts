import type { Context, Next } from "hono";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";

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

  if (authHeader && requestContext) {
    try {
      const pk = (process.env.MEDUSA_PUBLISHABLE_KEY || "").replace(/^["']|["']$/g, '');
      const response = await fetch(`${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/customers/me`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "x-publishable-api-key": pk
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.customer?.id) {
          requestContext.set(MASTRA_RESOURCE_ID_KEY, data.customer.id);
        }
      }
    } catch (err) {
      console.error("[userIdentityMiddleware] Failed to verify Medusa session:", err);
    }
  }

  await next();
}