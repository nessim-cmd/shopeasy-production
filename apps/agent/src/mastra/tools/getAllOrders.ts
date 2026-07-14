import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

interface Order {
  id: string;
  userId: string;
  product: string;
  status: string;
  total: number;
  trackingUrl: string | null;
}

export const getAllOrdersTool = createTool({
  id: "get-all-orders",
  description: "List all orders in the ShopEasy system.",
  inputSchema: z.object({}),
  execute: async (_inputData, { requestContext }) => {
    console.log("[getAllOrdersTool] execute called");

    await enforcePolicy({
      toolName: "get-all-orders",
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    const response = await medusa.client.fetch(
      `/admin/orders`,
      {
        method: "GET",
        headers: getAdminHeaders(),
      }
    ) as { orders: HttpTypes.AdminOrder[] };
    const orders = response.orders;

    const mappedOrders: Order[] = orders.map((order) => ({
      id: order.id,
      userId: order.customer_id || "",
      product: order.items?.[0]?.title || "Unknown Product",
      status: order.status || "pending",
      total: order.total || 0,
      trackingUrl: null,
    }));

    return { orders: mappedOrders, total: mappedOrders.length };
  },
});