/**
 * scheduleReturnWorkflow.ts
 *
 * Agent-callable workflow for scheduling a return pickup.
 *
 * Steps:
 * 1. verify-return-eligibility — check order exists and is within return window
 * 2. book-pickup               — book a Google Calendar appointment
 * 3. send-confirmation         — email the customer with appointment details
 * 4. log-ticket                — create a support ticket for the return request
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { getOrderLogic } from "../tools/getOrder";
import { bookAppointmentLogic } from "../tools/bookAppointment";
import { sendEmailLogic } from "../tools/sendEmail";
import { createTicketLogic } from "../tools/createTicket";

// ── Step 1: Verify the order is eligible for return ──────────────
const verifyReturnEligibilityStep = createStep({
  id: "verify-return-eligibility",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    customerEmail: z.string().email().optional(),
    customerName: z.string().optional(),
    preferredDate: z.string().describe("ISO 8601 date e.g. 2026-06-20"),
    preferredTimeStart: z
      .string()
      .describe("ISO 8601 datetime for pickup start e.g. 2026-06-20T10:00:00"),
    preferredTimeEnd: z
      .string()
      .describe("ISO 8601 datetime for pickup end e.g. 2026-06-20T11:00:00"),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    customerEmail: z.string().optional(),
    customerName: z.string().optional(),
    preferredTimeStart: z.string(),
    preferredTimeEnd: z.string(),
    orderDetails: z.any().optional(),
    eligible: z.boolean(),
    ineligibleReason: z.string().optional(),
    itemCategory: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const base = {
      orderId: inputData.orderId,
      userId: inputData.userId,
      customerEmail: inputData.customerEmail,
      customerName: inputData.customerName,
      preferredTimeStart: inputData.preferredTimeStart,
      preferredTimeEnd: inputData.preferredTimeEnd,
    };

    const order = await getOrderLogic(inputData.orderId);

    if ("error" in order) {
      return { ...base, eligible: false, ineligibleReason: order.error };
    }

    // Cancelled orders cannot be returned
    if (order.status === "cancelled") {
      return {
        ...base,
        orderDetails: order,
        eligible: false,
        ineligibleReason: "Order is cancelled and cannot be returned.",
      };
    }

    // Check return window — 14 days for electronics, 30 days otherwise
    const isElectronics = (order.category ?? "")
      .toLowerCase()
      .includes("electronics");
    const returnWindowDays = isElectronics ? 14 : 30;
    const orderDate = new Date(
      order.createdAt ?? order.date ?? order.orderDate,
    );
    const daysSinceOrder = Math.floor(
      (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceOrder > returnWindowDays) {
      return {
        ...base,
        orderDetails: order,
        eligible: false,
        ineligibleReason: `Return window expired. ${returnWindowDays}-day return policy — order placed ${daysSinceOrder} days ago.`,
        itemCategory: order.category,
      };
    }

    return {
      ...base,
      orderDetails: order,
      eligible: true,
      itemCategory: order.category,
    };
  },
});

// ── Step 2: Book the return pickup appointment ────────────────────
const bookPickupStep = createStep({
  id: "book-pickup",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    customerEmail: z.string().optional(),
    customerName: z.string().optional(),
    preferredTimeStart: z.string(),
    preferredTimeEnd: z.string(),
    orderDetails: z.any().optional(),
    eligible: z.boolean(),
    ineligibleReason: z.string().optional(),
    itemCategory: z.string().optional(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    customerEmail: z.string().optional(),
    customerName: z.string().optional(),
    orderDetails: z.any().optional(),
    eligible: z.boolean(),
    ineligibleReason: z.string().optional(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    appointmentTitle: z.string().optional(),
    preferredTimeStart: z.string(),
    preferredTimeEnd: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const base = {
      orderId: inputData.orderId,
      userId: inputData.userId,
      customerEmail: inputData.customerEmail,
      customerName: inputData.customerName,
      orderDetails: inputData.orderDetails,
      eligible: inputData.eligible,
      ineligibleReason: inputData.ineligibleReason,
      preferredTimeStart: inputData.preferredTimeStart,
      preferredTimeEnd: inputData.preferredTimeEnd,
    };

    if (!inputData.eligible) {
      return base;
    }

    const title = `Return Pickup — Order ${inputData.orderId}`;
    const description = [
      `Return pickup scheduled for order ${inputData.orderId}.`,
      inputData.customerName ? `Customer: ${inputData.customerName}` : "",
      inputData.itemCategory ? `Category: ${inputData.itemCategory}` : "",
      `Please have the item packaged and ready at the pickup address.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await bookAppointmentLogic({
      title,
      description,
      startDateTime: inputData.preferredTimeStart,
      endDateTime: inputData.preferredTimeEnd,
      customerEmail: inputData.customerEmail,
    });

    if (!result.success) {
      return { ...base, error: result.error };
    }

    return {
      ...base,
      eventId: result.eventId,
      eventLink: result.eventLink,
      appointmentTitle: result.title,
    };
  },
});

// ── Step 3: Send confirmation email ──────────────────────────────
const sendReturnConfirmationStep = createStep({
  id: "send-confirmation",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    customerEmail: z.string().optional(),
    customerName: z.string().optional(),
    orderDetails: z.any().optional(),
    eligible: z.boolean(),
    ineligibleReason: z.string().optional(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    appointmentTitle: z.string().optional(),
    preferredTimeStart: z.string(),
    preferredTimeEnd: z.string(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    eligible: z.boolean(),
    ineligibleReason: z.string().optional(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    preferredTimeStart: z.string(),
    emailSent: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const base = {
      orderId: inputData.orderId,
      userId: inputData.userId,
      eligible: inputData.eligible,
      ineligibleReason: inputData.ineligibleReason,
      eventId: inputData.eventId,
      eventLink: inputData.eventLink,
      preferredTimeStart: inputData.preferredTimeStart,
    };

    if (!inputData.eligible || !inputData.eventId || !inputData.customerEmail) {
      return {
        ...base,
        emailSent: false,
        error: inputData.error ?? inputData.ineligibleReason,
      };
    }

    const greeting = inputData.customerName
      ? `Hello ${inputData.customerName},`
      : `Hello,`;
    const pickupDate = new Date(inputData.preferredTimeStart).toLocaleString(
      "en-GB",
      {
        dateStyle: "full",
        timeStyle: "short",
      },
    );

    const body = [
      greeting,
      ``,
      `Your return pickup for order ${inputData.orderId} has been scheduled.`,
      ``,
      `Pickup date: ${pickupDate}`,
      inputData.eventLink ? `Calendar link: ${inputData.eventLink}` : "",
      ``,
      `Please have the item securely packaged and ready at your address.`,
      ``,
      `If you need to reschedule, please contact us at least 24 hours before the pickup.`,
      ``,
      `Thank you,`,
      `ShopEasy Support Team`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendEmailLogic(
      inputData.customerEmail,
      `Return Pickup Confirmed — Order ${inputData.orderId}`,
      body,
    );

    return { ...base, emailSent: result.success };
  },
});

// ── Step 4: Log support ticket ────────────────────────────────────
const logReturnTicketStep = createStep({
  id: "log-ticket",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    eligible: z.boolean(),
    ineligibleReason: z.string().optional(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    preferredTimeStart: z.string(),
    emailSent: z.boolean(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketId: z.string().optional(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    emailSent: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.eligible) {
      return {
        success: false,
        emailSent: inputData.emailSent,
        message: `Return not eligible: ${inputData.ineligibleReason}`,
        error: inputData.ineligibleReason,
      };
    }

    const pickupDate = new Date(inputData.preferredTimeStart).toLocaleString(
      "en-GB",
      {
        dateStyle: "full",
        timeStyle: "short",
      },
    );

    const ticket = await createTicketLogic({
      userId: inputData.userId,
      orderId: inputData.orderId,
      subject: `Return pickup scheduled — Order ${inputData.orderId}`,
      description: [
        `Return pickup booked for ${pickupDate}.`,
        inputData.eventId ? `Calendar event ID: ${inputData.eventId}` : "",
        inputData.eventLink ? `Calendar link: ${inputData.eventLink}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      priority: "normal",
    });

    return {
      success: true,
      ticketId: ticket.success ? ticket.ticketId : undefined,
      eventId: inputData.eventId,
      eventLink: inputData.eventLink,
      emailSent: inputData.emailSent,
      message: `Return pickup scheduled for ${pickupDate}. ${inputData.eventLink ? `Calendar: ${inputData.eventLink}` : ""}`,
    };
  },
});

// ── Workflow ──────────────────────────────────────────────────────
export const scheduleReturnWorkflow = createWorkflow({
  id: "schedule-return",
  inputSchema: z.object({
    orderId: z.string().describe("The order ID to return"),
    userId: z.string().describe("Customer user ID"),
    customerEmail: z
      .string()
      .email()
      .optional()
      .describe("Customer email — looked up if not provided"),
    customerName: z
      .string()
      .optional()
      .describe("Customer name for personalised messages"),
    preferredDate: z.string().describe("Preferred return date e.g. 2026-06-20"),
    preferredTimeStart: z
      .string()
      .describe("Pickup start datetime ISO 8601 e.g. 2026-06-20T10:00:00"),
    preferredTimeEnd: z
      .string()
      .describe("Pickup end datetime ISO 8601 e.g. 2026-06-20T11:00:00"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketId: z.string().optional(),
    eventId: z.string().optional(),
    eventLink: z.string().optional(),
    emailSent: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
})
  .then(verifyReturnEligibilityStep)
  .then(bookPickupStep)
  .then(sendReturnConfirmationStep)
  .then(logReturnTicketStep)
  .commit();
