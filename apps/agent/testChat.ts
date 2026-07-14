import "dotenv/config";

const API_URL = "http://localhost:4111";
const API_KEY = process.env.API_SECRET_KEY || "your_development_secret_key";
const TEST_CUSTOMER_ID = "cus_01J2MZP0Z349Y1XZB40QXYH43W";
const TEST_OTHER_CUSTOMER_ID = "cus_OTHER99999999999999999999";

async function makeRequest(path: string, options: RequestInit = {}, userId?: string) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  // Test script now needs a REAL Medusa customer token in Authorization if testing auth.
  if (userId) {
    // In a real scenario, this would be the actual Medusa session token.
    // For this test, if we pass userId, we simulate passing the token in Authorization.
    headers.set("Authorization", `Bearer fake_medusa_token_for_${userId}`);
  } else {
    // API key for anonymous access if needed, or no auth
    headers.set("x-api-key", API_KEY);
  }

  const response = await fetch(`${API_URL}${path}`, {
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
  console.log("=== Testing Chat Endpoints ===");

  // 1. Authenticated Thread Creation
  console.log("\n1. POST /chat/message (New Thread, Authenticated)");
  const res1 = await makeRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "Hello, my order hasn't arrived." })
  }, TEST_CUSTOMER_ID);
  console.log(`Status: ${res1.status}`);
  console.log(res1.data);
  const threadId = res1.data.threadId;

  // 2. Authenticated Thread Continuation
  console.log("\n2. POST /chat/message (Continue Thread, Authenticated)");
  const res2 = await makeRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "Can you check its status?", threadId })
  }, TEST_CUSTOMER_ID);
  console.log(`Status: ${res2.status}`);
  console.log(res2.data);

  // 3. Thread List Fetching
  console.log("\n3. GET /chat/threads (Authenticated)");
  const res3 = await makeRequest("/chat/threads", { method: "GET" }, TEST_CUSTOMER_ID);
  console.log(`Status: ${res3.status}`);
  // We'll just log the number of threads or if it includes our new threadId
  if (res3.data && Array.isArray(res3.data)) {
    console.log(`Found ${res3.data.length} threads. Includes our new thread?`, res3.data.some(t => t.id === threadId));
  } else {
    console.log(res3.data);
  }

  // 4. Access Control Check
  console.log("\n4. GET /chat/threads/:threadId/messages (Wrong User)");
  const res4 = await makeRequest(`/chat/threads/${threadId}/messages`, { method: "GET" }, TEST_OTHER_CUSTOMER_ID);
  console.log(`Status: ${res4.status} (Expected: 404)`);
  console.log(res4.data);

  // 5. Anonymous Messaging
  console.log("\n5. POST /chat/message (Anonymous)");
  const res5 = await makeRequest("/chat/message", {
    method: "POST",
    body: JSON.stringify({ message: "I want to buy a product.", sessionId: "anon_123" })
  }); // No userId passed!
  console.log(`Status: ${res5.status}`);
  console.log(res5.data);
  const anonThreadId = res5.data.threadId;

  // 6. Access Control Check (Anonymous list request)
  console.log("\n6. GET /chat/threads (Anonymous, should be 401)");
  const res6 = await makeRequest("/chat/threads", { method: "GET" }); // No userId
  console.log(`Status: ${res6.status} (Expected: 401)`);
  console.log(res6.data);
}

run();
