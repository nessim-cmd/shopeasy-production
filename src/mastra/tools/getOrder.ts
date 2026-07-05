// src/mastra/tools/getOrder.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db";

import { enforcePolicy } from "../guardrails/policyEngine";

// ── Types ─────────────────────────────────────────────────────────
interface Order {
  id: string;
  userId: string;
  product: string;
  status: string;
  total: number;
  trackingUrl: string | null;
}

// ── Shared logic — used by tool AND workflow steps ────────────────
export function getOrderLogic(orderId: string): Order | { error: string } {
  const order = db
    .prepare<string, Order>(`SELECT * FROM orders WHERE id = ?`)
    .get(orderId);

  if (!order) return { error: `Order ${orderId} not found` };
  return order;
}

export const getOrderTool = createTool({
  id: "get-order",
  description: "Get the full details of an order by its ID.",
  inputSchema: z.object({
    orderId: z.string().describe("The order ID to look up, e.g. ORD-001"),
  }),
  execute: async (inputData, context) => {

    console.log(`[getOrderTool] execute called for ${inputData.orderId}`);
    const result = getOrderLogic(inputData.orderId);

    if ("error" in result) return result;

    // Layer 5 — Check IDOR Access Policy
    enforcePolicy({ toolName: "get-order", orderOwnerId: result.userId });

    console.log(`[getOrderTool] ✅ Access granted for ${inputData.orderId}`);
    return result;
  },
});
