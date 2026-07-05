/**
 * handleRefundWorkflow.ts
 *
 * Agent-callable workflow triggered when a customer requests a refund.
 *
 * Steps:
 * 1. verify-order     — confirm order exists and get its details
 * 2. process-refund   — execute the refund
 * 3. send-confirmation — email the customer
 * 4. log-ticket       — create a support ticket for audit trail
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getOrderLogic } from "../tools/getOrder";
import { processRefundLogic } from "../tools/processRefund";
import { sendEmailLogic } from "../tools/sendEmail";
import { createTicketLogic } from "../tools/createTicket";

// ── Step 1: Verify the order exists ──────────────────────────────
const verifyOrderStep = createStep({
  id: "verify-order",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.string(),
    customerEmail: z.string().email().optional(),
    userId: z.string(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    reason: z.string(),
    customerEmail: z.string().optional(),
    userId: z.string(),
    orderDetails: z.any(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const order = await getOrderLogic(inputData.orderId);
    if ("error" in order) {
      return { ...inputData, orderDetails: null, error: order.error };
    }
    return { ...inputData, orderDetails: order };
  },
});

// ── Step 2: Process the refund ────────────────────────────────────
const processRefundStep = createStep({
  id: "process-refund",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    reason: z.string(),
    customerEmail: z.string().optional(),
    userId: z.string(),
    orderDetails: z.any(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    reason: z.string(),
    customerEmail: z.string().optional(),
    userId: z.string(),
    refundId: z.string().optional(),
    refundMessage: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Abort early if order wasn't found
    if (inputData.error) {
      return {
        orderId: inputData.orderId,
        amount: inputData.amount,
        reason: inputData.reason,
        customerEmail: inputData.customerEmail,
        userId: inputData.userId,
        error: inputData.error,
      };
    }

    const result = await processRefundLogic(
      inputData.orderId,
      inputData.amount,
      inputData.reason,
    );
    return {
      orderId: inputData.orderId,
      amount: inputData.amount,
      reason: inputData.reason,
      customerEmail: inputData.customerEmail,
      userId: inputData.userId,
      refundId: result.refundId,
      refundMessage: result.message,
    };
  },
});

// ── Step 3: Send confirmation email ──────────────────────────────
const sendRefundConfirmationStep = createStep({
  id: "send-confirmation",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    reason: z.string(),
    customerEmail: z.string().optional(),
    userId: z.string(),
    refundId: z.string().optional(),
    refundMessage: z.string().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    userId: z.string(),
    refundId: z.string().optional(),
    refundMessage: z.string().optional(),
    emailSent: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const base = {
      orderId: inputData.orderId,
      amount: inputData.amount,
      userId: inputData.userId,
      refundId: inputData.refundId,
      refundMessage: inputData.refundMessage,
    };

    if (inputData.error || !inputData.customerEmail || !inputData.refundId) {
      return {
        ...base,
        emailSent: false,
        error: inputData.error ?? "Missing email or refundId",
      };
    }

    const body = [
      `Hello,`,
      ``,
      `Your refund for order ${inputData.orderId} has been successfully processed.`,
      ``,
      `Refund ID: ${inputData.refundId}`,
      `Amount:    €${inputData.amount}`,
      `Reason:    ${inputData.reason}`,
      ``,
      `Please allow 5–7 business days for the amount to appear on your statement.`,
      ``,
      `Thank you for shopping with ShopEasy.`,
    ].join("\n");

    const emailResult = await sendEmailLogic(
      inputData.customerEmail,
      `Refund Confirmation — Order ${inputData.orderId}`,
      body,
    );

    return { ...base, emailSent: emailResult.success };
  },
});

// ── Step 4: Log support ticket ────────────────────────────────────
const logRefundTicketStep = createStep({
  id: "log-ticket",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    userId: z.string(),
    refundId: z.string().optional(),
    refundMessage: z.string().optional(),
    emailSent: z.boolean(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    refundId: z.string().optional(),
    ticketId: z.string().optional(),
    emailSent: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.error || !inputData.refundId) {
      return {
        success: false,
        emailSent: inputData.emailSent,
        message: `Refund workflow failed: ${inputData.error ?? "unknown error"}`,
        error: inputData.error,
      };
    }

    const ticket = await createTicketLogic({
      userId: inputData.userId,
      orderId: inputData.orderId,
      subject: `Refund processed — ${inputData.refundId}`,
      description: `Refund of €${inputData.amount} processed. ${inputData.refundMessage ?? ""}`,
      priority: "normal",
    });

    return {
      success: true,
      refundId: inputData.refundId,
      ticketId: ticket.success ? ticket.ticketId : undefined,
      emailSent: inputData.emailSent,
      message: `Refund ${inputData.refundId} completed. ${inputData.refundMessage ?? ""}`,
    };
  },
});

// ── Workflow ──────────────────────────────────────────────────────
export const handleRefundWorkflow = createWorkflow({
  id: "handle-refund",
  inputSchema: z.object({
    orderId: z.string().describe("The order ID to refund"),
    amount: z.number().positive().describe("Refund amount in EUR"),
    reason: z.string().describe("Reason for the refund"),
    customerEmail: z
      .string()
      .email()
      .optional()
      .describe("Customer email — looked up automatically if not provided"),
    userId: z.string().describe("Customer user ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    refundId: z.string().optional(),
    ticketId: z.string().optional(),
    emailSent: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
})
  .then(verifyOrderStep)
  .then(processRefundStep)
  .then(sendRefundConfirmationStep)
  .then(logRefundTicketStep)
  .commit();
