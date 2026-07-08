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

export async function getOrderLogic(orderId: string): Promise<Order | { error: string }> {
  const order = (await db
    .prepare(
      `SELECT id, user_id AS "userId", product, status, total, tracking_url AS "trackingUrl"
       FROM orders WHERE id = $1`,
    )
    .get([orderId])) as Order | null;

  if (!order) return { error: `Order ${orderId} not found` };
  return order;
}

export const getOrderTool = createTool({
  id: "get-order",
  description: "Get the full details of an order by its ID.",
  inputSchema: z.object({
    orderId: z.string().describe("The order ID to look up, e.g. ORD-001"),
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