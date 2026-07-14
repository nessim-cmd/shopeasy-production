import "dotenv/config";
import { medusa, getAdminHeaders } from "./src/mastra/utils/medusa.js";
import { getProductLogic } from "./src/mastra/tools/getProduct.js";
import { getOrderLogic } from "./src/mastra/tools/getOrder.js";
import { processRefundLogic } from "./src/mastra/tools/processRefund.js";
import { updateAddressTool } from "./src/mastra/tools/updateAddress.js";
import { getOrdersByUserTool } from "./src/mastra/tools/getOrdersByUser.js";
import { getUserDataTool } from "./src/mastra/tools/getUserData.js";
import type { HttpTypes } from "@medusajs/types";

async function run() {
  console.log("=========================================");
  console.log("1. TEST: getProduct (Store API)");
  const productRes = await getProductLogic("shirt");
  console.log("Product found:", productRes[0]?.id, "| Title:", productRes[0]?.title);

  console.log("\n=========================================");
  console.log("Fetching customer bn.nessim@gmail.com for tests...");
  
  // Fetch a valid customer to test user APIs
  const { customers } = await medusa.client.fetch<{ customers: HttpTypes.AdminCustomer[] }>(
    `/admin/customers?q=bn.nessim@gmail.com`,
    { method: "GET", headers: getAdminHeaders() }
  );
  
  if (customers.length === 0) {
    console.log("No customers found in the database. Tests aborted.");
    return;
  }
  
  const customerId = customers[0].id;
  const mockContext = { get: () => customerId };

  console.log(`\n========================================="`);
  console.log(`2. TEST: getOrdersByUser (Admin API) -> Customer ID: ${customerId}`);
  const ordersByUserRes = await getOrdersByUserTool.execute({}, { requestContext: mockContext as any });
  console.log(`Orders found for user ${customerId}:`, ordersByUserRes.total);

  if (!ordersByUserRes.orders || ordersByUserRes.orders.length === 0) {
    console.log("Customer has no orders to test with. Aborting order tests.");
    return;
  }
  
  const realOrderId = ordersByUserRes.orders[0].id;
  
  // Let's directly fetch it with various fields
  const test1 = await medusa.client.fetch(`/admin/orders/${realOrderId}?fields=+customer_id,+email,+customer`, { method: "GET", headers: getAdminHeaders() });
  console.log("With fields=+customer_id,+email,+customer ->", Object.keys((test1 as any).order));
  console.log("Values:", (test1 as any).order.customer_id, (test1 as any).order.email);

  console.log("\n=========================================");
  const guestOrderId = "order_01KX25QHTZDMQ85MVCXJ6B93TV";
  console.log(`3.5 TEST: getOrder (Admin API) -> Guest Order ID: ${guestOrderId}`);
  const guestOrderRes = await getOrderLogic(guestOrderId);
  console.log("getOrder result (guest):", guestOrderRes);

  console.log("\n=========================================");
  console.log(`4. TEST: getUserData (Admin API) -> Customer ID: ${customerId}`);
  const userDataRes = await getUserDataTool.execute({ userId: customerId! }, { requestContext: mockContext as any });
  console.log("getUserData result:", JSON.stringify(userDataRes, null, 2));

  console.log("\n=========================================");
  console.log(`5. TEST: updateAddress (Admin API) -> Customer ID: ${customerId}`);
  const newAddr = "123 Test Street, New York, NY 10001";
  const updateRes = await updateAddressTool.execute({ userId: customerId!, newAddress: newAddr }, { requestContext: mockContext as any });
  console.log("updateAddress result:", updateRes);

  console.log("\n=========================================");
  console.log(`6. TEST: processRefund (Admin API) -> Real Customer Order ID: ${realOrderId}`);
  const refundRes = await processRefundLogic(realOrderId, 1, "Test API");
  console.log("processRefund result:", refundRes);
  
  console.log("=========================================");
}

run().catch(console.error);
