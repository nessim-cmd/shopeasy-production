import { NextRequest } from "next/server";
import { getAuthHeaders } from "../../../lib/data/cookies"; // adjust path to what grep actually shows
const AGENT_URL = process.env.AGENT_URL || "http://localhost:4111";
const API_SECRET_KEY = process.env.API_SECRET_KEY || "";

export async function POST(req: NextRequest) {
  // Get the customer's REAL Medusa session token server-side.
  // dtc-starter stores this in an httpOnly cookie, usually read via an existing helper
  // like getAuthHeaders() in src/lib/data/cookies.ts — find that helper in your codebase
  // and use it here instead of reinventing cookie parsing. Example shape it likely returns:
  // { authorization: "Bearer <jwt>" } or {} if not logged in.
  const authHeaders = await getAuthHeaders(); // <-- import from your actual lib/data/cookies
  const token = authHeaders?.authorization?.replace(/^Bearer\s+/i, "");

  const body = await req.text();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": API_SECRET_KEY,
  };
  // Only attach Authorization if a real token exists. No token = anonymous request,
  // forwarded as-is. Never invent, assert, or substitute an identity here.
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const agentResponse = await fetch(`${AGENT_URL}/copilotkit`, {
    method: "POST",
    headers,
    body,
  });

  // Stream straight through — CopilotKit's protocol relies on streaming responses.
  return new Response(agentResponse.body, {
    status: agentResponse.status,
    headers: {
      "Content-Type": agentResponse.headers.get("Content-Type") || "application/json",
    },
  });
}