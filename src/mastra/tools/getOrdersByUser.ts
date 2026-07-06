import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";

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

    const orders = (await db
      .prepare(
        `SELECT id, user_id AS "userId", product, status, total, tracking_url AS "trackingUrl"
         FROM orders WHERE user_id = $1`,
      )
      .all([authenticatedUserId])) as Order[];

    if (orders.length === 0) {
      return { found: false, message: "No orders found for your account." };
    }
    return { found: true, userId: authenticatedUserId, orders, total: orders.length };
  },
});