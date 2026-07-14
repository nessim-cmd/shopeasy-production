import "dotenv/config";
import crypto from "crypto";

const AGENT_URL = "http://localhost:4111";

function signJwt(payload: any, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodeBase64Url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url").replace(/=/g, "");
  const head64 = encodeBase64Url(header);
  const pay64 = encodeBase64Url(payload);
  const signature = crypto.createHmac("sha256", secret).update(`${head64}.${pay64}`).digest("base64url").replace(/=/g, "");
  return `${head64}.${pay64}.${signature}`;
}

// Generate genuine Medusa v2 JWT tokens for two customers
const secret = process.env.JWT_SECRET || "supersecret"; // medusa backend secret
const token1 = signJwt({
  actor_id: "cus_01KX24YGGX4EGPGZ7XW4XZ856M", // Real customer bn.nessim@gmail.com
  actor_type: "customer",
  auth_identity_id: "authid_fake1",
  auth_provider: "emailpass",
  app_metadata: {},
  user_metadata: {},
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}, secret);

const token2 = signJwt({
  actor_id: "cus_01KX4QTXGFT0WY621VHPB4WFZT", // A second customer
  actor_type: "customer",
  auth_identity_id: "authid_fake2",
  auth_provider: "emailpass",
  app_metadata: {},
  user_metadata: {},
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}, secret);

async function makeAgentRequest(path: string, options: any = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("x-api-key", process.env.API_SECRET_KEY || "preemptics-dev-secret-2026");
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${AGENT_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch (err) {
    return { status: response.status, text };
  }
}

async function run() {
  console.log("=== Setting up Medusa Test Customers ===");
  console.log("Got genuine Medusa token 1:", token1.substring(0, 20) + "...");
  console.log("Got genuine Medusa token 2:", token2.substring(0, 20) + "...");

  console.log("\n=== 1. POST /chat/message (Real Token 1) ===");
  const res1 = await makeAgentRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "Hello! My order number is ORD-4471." })
  }, token1);
  console.log(`Status: ${res1.status}`);
  console.log(res1.data);
  const threadId = res1.data.threadId;

  console.log("\n=== 2. POST /chat/message (Continue Thread, Real Token 1) ===");
  const res2 = await makeAgentRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "What order number did I just give you?", threadId })
  }, token1);
  console.log(`Status: ${res2.status}`);
  console.log(res2.data);

  console.log("\n=== 3. GET /chat/threads/:threadId/messages (Cross-Customer test) ===");
  // Customer 2 tries to fetch Customer 1's thread
  const res3 = await makeAgentRequest(`/chat/threads/${threadId}/messages`, { method: "GET" }, token2);
  console.log(`Status: ${res3.status} (Expected: 404)`);
  console.log(res3.data);

  console.log("\n=== 4. POST /chat/message (Tampered Token) ===");
  const tamperedToken = token1.substring(0, token1.length - 5) + "abcde";
  const res4 = await makeAgentRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "I am using a tampered token.", sessionId: "tampered_session_abc123" })
  }, tamperedToken);
  console.log(`Status: ${res4.status} (Expected: 200 Anonymous Fallback)`);
  console.log(res4.data);

  console.log("\n=== 5. POST /chat/message (No Auth Header) ===");
  const res5a = await makeAgentRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "I am fully anonymous.", sessionId: "anon_session_1" })
  });
  console.log(`Status: ${res5a.status}`);
  console.log(res5a.data);

  console.log("\n=== 5. GET /chat/threads (No Auth Header) ===");
  const res5b = await makeAgentRequest("/chat/threads", { method: "GET" });
  console.log(`Status: ${res5b.status} (Expected: 401)`);
  console.log(res5b.data);
}

run();
