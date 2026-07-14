import "dotenv/config";
const MEDUSA_URL = "http://localhost:9000";

async function loginCustomer(email) {
  const payload = { email, password: "password123" };
  const res = await fetch(`${MEDUSA_URL}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (res.status === 400) {
    const res2 = await fetch(`${MEDUSA_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res2.json();
    return data.token;
  }
  const data = await res.json();
  return data.token;
}

async function run() {
  const token = await loginCustomer("customer99_test@example.com");
  console.log("Token:", token);
  const res = await fetch(`${MEDUSA_URL}/store/customers/me`, {
    headers: { 
      "Authorization": `Bearer ${token}`,
      "x-publishable-api-key": process.env.MEDUSA_PUBLISHABLE_KEY || ""
    }
  });
  console.log("Status:", res.status);
  console.log("Data:", await res.text());
}
run();
