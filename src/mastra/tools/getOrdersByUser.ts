import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";

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
  description: "Get all orders belonging to a specific user by their user ID.",
  inputSchema: z.object({
    userId: z.string().describe("The real Neon Auth user ID to look up orders for"),
  }),
  execute: async (inputData, { requestContext }) => {
    await enforcePolicy({
      toolName: "get-orders-by-user",
      requestedUserId: inputData.userId,
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    const orders = (await db
      .prepare(
        `SELECT id, user_id AS "userId", product, status, total, tracking_url AS "trackingUrl"
         FROM orders WHERE user_id = $1`,
      )
      .all([inputData.userId])) as Order[];

    if (orders.length === 0) {
      return { found: false, message: `No orders found for user ${inputData.userId}` };
    }
    return { found: true, userId: inputData.userId, orders, total: orders.length };
  },
});