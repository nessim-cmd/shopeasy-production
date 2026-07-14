import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";
import { getOrderLogic } from "./getOrder.js";

import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

export async function processRefundLogic(orderId: string, amount: number, reason: string) {
  try {
    // 1. Fetch the order's payment collections
    const { order } = await medusa.client.fetch<{ order: HttpTypes.AdminOrder & { payment_collections?: any[] } }>(
      `/admin/orders/${orderId}?fields=*payment_collections,*payment_collections.payments`,
      {
        method: "GET",
        headers: getAdminHeaders(),
      }
    );

    const payments = order.payment_collections?.[0]?.payments || [];
    const payment = payments[0];

    if (!payment) {
      return { success: false, error: `No captured payment found for order ${orderId}` };
    }

    // 2. Refund the payment
    const response = await medusa.client.fetch(
      `/admin/payments/${payment.id}/refund`,
      {
        method: "POST",
        headers: getAdminHeaders(),
        body: {
          amount,
        } // Medusa v2 payment refund endpoint doesn't strictly take a reason in this payload by default, but you can pass note if needed.
      }
    ) as { payment: any };

    // Find the latest refund to return its ID
    const refunds = response.payment?.refunds || [];
    const latestRefund = refunds[refunds.length - 1];

    return {
      success: true,
      refundId: latestRefund?.id || `refund-${Date.now()}`,
      amount,
      message: `Refund of ${amount} for order ${orderId} processed successfully.`,
    };
  } catch (error: any) {
    console.error(`[REFUND ERROR] Order: ${orderId} | Error: ${error.message}`);
    return {
      success: false,
      error: `Failed to process refund: ${error.message}`,
    };
  }
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