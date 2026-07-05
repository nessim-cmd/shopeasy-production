// src/mastra/tools/getOrdersByUser.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";

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
    userId: z
      .string()
      .describe("The user ID to look up orders for, e.g. USR-001"),
  }),
  execute: async (inputData) => {
    // Layer 5 — Check IDOR Access Policy
    enforcePolicy({
      toolName: "get-orders-by-user",
      requestedUserId: inputData.userId,
    });

    const orders = db
      .prepare<string, Order>(`SELECT * FROM orders WHERE userId = ?`)
      .all(inputData.userId);

    if (orders.length === 0) {
      return {
        found: false,
        message: `No orders found for user ${inputData.userId}`,
      };
    }
    return {
      found: true,
      userId: inputData.userId,
      orders,
      total: orders.length,
    };
  },
});
