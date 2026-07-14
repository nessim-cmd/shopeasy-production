import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
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

export const getOrdersByUserTool = createTool({
  id: "get-orders-by-user",
  description: "Get all orders belonging to the currently authenticated customer.",
  inputSchema: z.object({}), // no arguments — the LLM can't and shouldn't supply the user ID
  execute: async (_inputData, { requestContext }) => {
    const authenticatedUserId = requestContext?.get(MASTRA_RESOURCE_ID_KEY as any);

    if (!authenticatedUserId) {
      return { found: false, message: "Could not verify your account. Please log in again." };
    }

    const response = await medusa.client.fetch(
      `/admin/orders`,
      {
        method: "GET",
        headers: getAdminHeaders(),
        query: {
          customer_id: authenticatedUserId,
        }
      }
    ) as { orders: HttpTypes.AdminOrder[] };
    const orders = response.orders;

    if (orders.length === 0) {
      return { found: false, message: "No orders found for your account." };
    }
    
    const mappedOrders: Order[] = orders.map((order) => ({
      id: order.id,
      userId: order.customer_id || "",
      product: order.items?.[0]?.title || "Unknown Product",
      status: order.status || "pending",
      total: order.total || 0,
      trackingUrl: null,
    }));
    
    return { found: true, userId: authenticatedUserId, orders: mappedOrders, total: mappedOrders.length };
  },
});