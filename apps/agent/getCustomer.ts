import "dotenv/config";

async function run() {
  const apiKey = process.env.MEDUSA_ADMIN_API_KEY;
  const encoded = Buffer.from(`${apiKey.replace(/^["']|["']$/g, '')}:`).toString("base64");
  
  const res = await fetch("http://localhost:9000/admin/customers", {
    headers: { "Authorization": `Basic ${encoded}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.customers, null, 2));
}
run();
