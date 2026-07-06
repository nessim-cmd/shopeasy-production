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

  const apiKey =
    c.req.header("x-api-key") ??
    c.req.header("authorization")?.replace("Bearer ", "");
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

// Reads the real, Neon-Auth-verified user ID forwarded by the store's backend
// (never trust this header if it could come straight from a browser — only
// accept it here because apiKeyMiddleware already gates this same path).
export async function userIdentityMiddleware(c: any, next: any) {
  const userId = c.req.header("x-user-id");
  const requestContext = c.get("requestContext");
  if (userId && requestContext) {
    requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  }
  await next();
}