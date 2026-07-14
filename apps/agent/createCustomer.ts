import "dotenv/config";

async function run() {
  const apiKey = process.env.MEDUSA_ADMIN_API_KEY;
  const encoded = Buffer.from(`${apiKey.replace(/^["']|["']$/g, '')}:`).toString("base64");
  
  const res = await fetch("http://localhost:9000/admin/customers", {
    method: "POST",
    headers: { 
      "Authorization": `Basic ${encoded}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "customer2@example.com" })
  });
  const data = await res.json();
  console.log(JSON.stringify(data.customer, null, 2));
}
run();
