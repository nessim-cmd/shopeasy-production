import "dotenv/config";
import crypto from "crypto";

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const head64 = encodeBase64Url(header);
  const pay64 = encodeBase64Url(payload);
  const signature = crypto.createHmac("sha256", secret).update(`${head64}.${pay64}`).digest("base64url");
  return `${head64}.${pay64}.${signature}`;
}

const token1 = signJwt({
  actor_id: "cus_01KX24YGGX4EGPGZ7XW4XZ856M",
  actor_type: "customer",
  auth_identity_id: "authid_fake1",
  auth_provider: "emailpass",
  app_metadata: {},
  user_metadata: {},
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}, "supersecret");

console.log("TOKEN1=" + token1);

async function testMe() {
  const pk = (process.env.MEDUSA_PUBLISHABLE_KEY || "").replace(/^["']|["']$/g, '');
  const res = await fetch("http://localhost:9000/store/customers/me", {
    headers: { 
      "Authorization": `Bearer ${token1}`,
      "x-publishable-api-key": pk
    }
  });
  console.log("Status:", res.status);
  console.log(await res.text());
}

testMe();
