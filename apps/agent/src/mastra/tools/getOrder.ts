import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

interface Order {
  id: string;
  userId: string | null;
  product: string;
  status: string;
  total: number;
  trackingUrl: string | null;
}

export async function getOrderLogic(orderId: string): Promise<Order | { error: string }> {
  try {
    const response = await medusa.client.fetch(
      `/admin/orders/${orderId}?fields=+customer_id,+email`,
      {
        method: "GET",
        headers: getAdminHeaders(),
      }
    ) as { order: HttpTypes.AdminOrder };
    const order = response.order;

    return {
      id: order.id,
      userId: order.customer_id || order.email || null,
      product: order.items?.[0]?.title || "Unknown Product",
      status: order.status || "pending",
      total: order.total || 0,
      trackingUrl: null, // No native trackingUrl on standard Medusa response without fulfillment
    };
  } catch (error: any) {
    return { error: `Order ${orderId} not found or Medusa API error: ${error.message}` };
  }
}

export const getOrderTool = createTool({
  id: "get-order",
  description: "Get the full details of an order by its ID.",
  inputSchema: z.object({
    orderId: z.string().describe("The order ID to look up, e.g. order_12345"),
  }),
  execute: async (inputData, { requestContext }) => {
    console.log(`[getOrderTool] execute called for ${inputData.orderId}`);
    const result = await getOrderLogic(inputData.orderId);

    if ("error" in result) return result;

    await enforcePolicy({
      toolName: "get-order",
      orderOwnerId: result.userId,
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    console.log(`[getOrderTool] ✅ Access granted for ${inputData.orderId}`);
    return result;
  },
});