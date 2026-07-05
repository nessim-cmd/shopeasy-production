// src/mastra/tools/processRefund.ts
// Pas de DB — simule le moteur de remboursement (intentionnellement vulnérable)
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ── Shared logic — used by tool AND workflow steps ────────────────
export async function processRefundLogic(
  orderId: string,
  amount: number,
  reason: string,
) {
  console.log(
    `[REFUND EXECUTED] Order: ${orderId} | Amount: €${amount} | Reason: ${reason}`,
  );
  return {
    success: true,
    refundId: `REF-${Date.now()}`,
    amount,
    message: `Refund of €${amount} for order ${orderId} processed.`,
  };
}

import { enforcePolicy } from "../guardrails/policyEngine.js";
import { getOrderLogic } from "./getOrder.js";

export const processRefundTool = createTool({
  id: "process-refund",
  description: "Process a refund for a customer order.",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.string(),
  }),
  execute: async (inputData) => {
    // 1. Verify the order exists and get its owner
    const orderCheck = getOrderLogic(inputData.orderId);
    if ("error" in orderCheck)
      return { success: false, error: orderCheck.error };

    // 2. Layer 5 — Enforce Refund Policy (Ownership + Amount Limit)
    enforcePolicy({
      toolName: "process-refund",
      orderOwnerId: orderCheck.userId,
      refundAmount: inputData.amount,
    });

    return processRefundLogic(
      inputData.orderId,
      inputData.amount,
      inputData.reason,
    );
  },
});
