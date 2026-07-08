/**
 * trackOrderWorkflow.ts
 *
 * Agent-callable workflow for full order tracking.
 *
 * Steps:
 * 1. get-order-details   — fetch order from data store
 * 2. fetch-carrier-status — browse tracking URL if one exists (conditional)
 * 3. build-summary       — produce a human-readable tracking summary
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getOrderLogic } from "../tools/getOrder.js";
import { browseUrlTool } from "../tools/browseUrl.js";

// ── Step 1: Get order details ─────────────────────────────────────
const getOrderDetailsStep = createStep({
  id: "get-order-details",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    orderDetails: z.any().optional(),
    trackingUrl: z.string().optional(),
    trackingNumber: z.string().optional(),
    status: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const order = await getOrderLogic(inputData.orderId);

    if ("error" in order) {
      return {
        orderId: inputData.orderId,
        userId: inputData.userId,
        error: order.error,
      };
    }

    return {
      orderId: inputData.orderId,
      userId: inputData.userId,
      orderDetails: order,
      trackingUrl: order.trackingUrl ?? order.tracking_url ?? undefined,
      trackingNumber:
        order.trackingNumber ?? order.tracking_number ?? undefined,
      status: order.status,
    };
  },
});

// ── Step 2: Fetch live carrier status (only if tracking URL exists) ──
const fetchCarrierStatusStep = createStep({
  id: "fetch-carrier-status",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    orderDetails: z.any().optional(),
    trackingUrl: z.string().optional(),
    trackingNumber: z.string().optional(),
    status: z.string().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    orderDetails: z.any().optional(),
    trackingUrl: z.string().optional(),
    trackingNumber: z.string().optional(),
    status: z.string().optional(),
    liveCarrierStatus: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const base = {
      orderId: inputData.orderId,
      userId: inputData.userId,
      orderDetails: inputData.orderDetails,
      trackingUrl: inputData.trackingUrl,
      trackingNumber: inputData.trackingNumber,
      status: inputData.status,
      error: inputData.error,
    };

    // Skip if no tracking URL or order already failed
    if (!inputData.trackingUrl || inputData.error) {
      return base;
    }

    try {
      // browseUrlTool.execute() uses the Mastra v1 direct inputData signature
      const result = await browseUrlTool.execute!(
        {
          url: inputData.trackingUrl,
          waitUntil: "domcontentloaded",
          timeout: 20000,
          screenshot: false,
          executeJs: null,
          viewport: { width: 1280, height: 720 },
          maxContentLength: 2000,
        } as any,
        {} as any,
      );

      return {
        ...base,
        liveCarrierStatus:
          "content" in result
            ? (result as any).content?.slice(0, 500)
            : undefined,
      };
    } catch {
      // Non-fatal — we still return the order data without live status
      return base;
    }
  },
});

// ── Step 3: Build tracking summary ───────────────────────────────
const buildSummaryStep = createStep({
  id: "build-summary",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    orderDetails: z.any().optional(),
    trackingUrl: z.string().optional(),
    trackingNumber: z.string().optional(),
    status: z.string().optional(),
    liveCarrierStatus: z.string().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    orderId: z.string(),
    status: z.string().optional(),
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().optional(),
    liveCarrierStatus: z.string().optional(),
    summary: z.string(),
    canCreateTicket: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.error) {
      return {
        success: false,
        orderId: inputData.orderId,
        summary: `Could not find order ${inputData.orderId}: ${inputData.error}`,
        canCreateTicket: true,
        error: inputData.error,
      };
    }

    const order = inputData.orderDetails;
    const status = inputData.status ?? order?.status ?? "unknown";

    // Build human-readable summary based on status
    let statusMessage = "";
    let canCreateTicket = false;

    switch (status.toLowerCase()) {
      case "processing":
        statusMessage = `Your order is currently being processed. Estimated dispatch: 1–2 business days.`;
        break;
      case "shipped":
      case "dispatched":
        statusMessage = inputData.trackingNumber
          ? `Your order has been shipped. Tracking number: ${inputData.trackingNumber}`
          : `Your order has been shipped and is on its way.`;
        break;
      case "out_for_delivery":
      case "out-for-delivery":
        statusMessage = `Your order is out for delivery today.`;
        break;
      case "delivered":
        statusMessage = `Your order was delivered on ${order?.deliveredAt ?? order?.delivered_at ?? "recently"}.`;
        break;
      case "cancelled":
        statusMessage = `This order has been cancelled.`;
        canCreateTicket = true;
        break;
      default:
        statusMessage = `Order status: ${status}.`;
        canCreateTicket = true;
    }

    const lines = [
      `Order ${inputData.orderId} — Status: ${status.toUpperCase()}`,
      ``,
      statusMessage,
    ];

    if (inputData.trackingUrl) {
      lines.push(``, `Track live: ${inputData.trackingUrl}`);
    }

    if (inputData.liveCarrierStatus) {
      lines.push(``, `Live carrier update:`, inputData.liveCarrierStatus);
    }

    return {
      success: true,
      orderId: inputData.orderId,
      status,
      trackingNumber: inputData.trackingNumber,
      trackingUrl: inputData.trackingUrl,
      liveCarrierStatus: inputData.liveCarrierStatus,
      summary: lines.join("\n"),
      canCreateTicket,
    };
  },
});

// ── Workflow ──────────────────────────────────────────────────────
export const trackOrderWorkflow = createWorkflow({
  id: "track-order",
  inputSchema: z.object({
    orderId: z.string().describe("The order ID to track"),
    userId: z.string().describe("Customer user ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    orderId: z.string(),
    status: z.string().optional(),
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().optional(),
    liveCarrierStatus: z.string().optional(),
    summary: z.string(),
    canCreateTicket: z.boolean(),
    error: z.string().optional(),
  }),
})
  .then(getOrderDetailsStep)
  .then(fetchCarrierStatusStep)
  .then(buildSummaryStep)
  .commit();
