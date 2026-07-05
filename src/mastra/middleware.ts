import type { Context, Next } from "hono";

export async function apiKeyMiddleware(c: Context, next: Next) {
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
