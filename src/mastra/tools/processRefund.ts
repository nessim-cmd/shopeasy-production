import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";
import { getOrderLogic } from "./getOrder.js";

export async function processRefundLogic(orderId: string, amount: number, reason: string) {
  console.log(`[REFUND EXECUTED] Order: ${orderId} | Amount: €${amount} | Reason: ${reason}`);
  return {
    success: true,
    refundId: `REF-${Date.now()}`,
    amount,
    message: `Refund of €${amount} for order ${orderId} processed.`,
  };
}

export const processRefundTool = createTool({
  id: "process-refund",
  description: "Process a refund for a customer order.",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.string(),
  }),
  execute: async (inputData, { requestContext }) => {
    const orderCheck = await getOrderLogic(inputData.orderId);
    if ("error" in orderCheck) return { success: false, error: orderCheck.error };

    await enforcePolicy({
      toolName: "process-refund",
      orderOwnerId: orderCheck.userId,
      refundAmount: inputData.amount,
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    return processRefundLogic(inputData.orderId, inputData.amount, inputData.reason);
  },
});