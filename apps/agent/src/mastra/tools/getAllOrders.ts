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

    const orders = (await db
      .prepare(
        `SELECT id, user_id AS "userId", product, status, total, tracking_url AS "trackingUrl"
         FROM orders`,
      )
      .all()) as Order[];

    return { orders, total: orders.length };
  },
});