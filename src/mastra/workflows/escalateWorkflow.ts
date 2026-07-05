/**
 * escalateWorkflow.ts
 *
 * Agent-callable workflow for escalating complex issues to human support.
 *
 * Steps:
 * 1. create-urgent-ticket — create a high-priority support ticket
 * 2. notify-customer      — email the customer with ticket ID and ETA
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { createTicketLogic } from "../tools/createTicket";
import { sendEmailLogic } from "../tools/sendEmail";

// ── Step 1: Create high-priority ticket ──────────────────────────
const createUrgentTicketStep = createStep({
  id: "create-urgent-ticket",
  inputSchema: z.object({
    userId: z.string(),
    orderId: z.string().optional(),
    subject: z.string(),
    description: z.string(),
    customerEmail: z.string().email().optional(),
    customerName: z.string().optional(),
  }),
  outputSchema: z.object({
    userId: z.string(),
    orderId: z.string().optional(),
    subject: z.string(),
    description: z.string(),
    customerEmail: z.string().optional(),
    customerName: z.string().optional(),
    ticketId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const ticket = await createTicketLogic({
      userId: inputData.userId,
      orderId: inputData.orderId,
      subject: inputData.subject,
      description: inputData.description,
      priority: "high",
    });

    return {
      userId: inputData.userId,
      orderId: inputData.orderId,
      subject: inputData.subject,
      description: inputData.description,
      customerEmail: inputData.customerEmail,
      customerName: inputData.customerName,
      ticketId: ticket.success ? ticket.ticketId : undefined,
      error: ticket.success ? undefined : ticket.error,
    };
  },
});

// ── Step 2: Notify customer by email ─────────────────────────────
const notifyCustomerStep = createStep({
  id: "notify-customer",
  inputSchema: z.object({
    userId: z.string(),
    orderId: z.string().optional(),
    subject: z.string(),
    description: z.string(),
    customerEmail: z.string().optional(),
    customerName: z.string().optional(),
    ticketId: z.string().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketId: z.string().optional(),
    emailSent: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.error || !inputData.ticketId) {
      return {
        success: false,
        emailSent: false,
        message: `Escalation failed: ${inputData.error ?? "ticket creation failed"}`,
        error: inputData.error,
      };
    }

    let emailSent = false;

    if (inputData.customerEmail) {
      const greeting = inputData.customerName
        ? `Hello ${inputData.customerName},`
        : `Hello,`;
      const body = [
        greeting,
        ``,
        `We're sorry to hear you're experiencing an issue. Your case has been escalated`,
        `to our human support team and will be reviewed as a priority.`,
        ``,
        `Ticket ID: ${inputData.ticketId}`,
        `Subject:   ${inputData.subject}`,
        ``,
        `A human agent will contact you within 24 hours.`,
        `Please keep your ticket ID for reference.`,
        ``,
        `Thank you for your patience,`,
        `ShopEasy Support Team`,
      ].join("\n");

      const result = await sendEmailLogic(
        inputData.customerEmail,
        `Your issue has been escalated — Ticket ${inputData.ticketId}`,
        body,
      );
      emailSent = result.success;
    }

    return {
      success: true,
      ticketId: inputData.ticketId,
      emailSent,
      message: `Issue escalated. Ticket ${inputData.ticketId} created with high priority. Human agent will respond within 24 hours.`,
    };
  },
});

// ── Workflow ──────────────────────────────────────────────────────
export const escalateWorkflow = createWorkflow({
  id: "escalate",
  inputSchema: z.object({
    userId: z.string().describe("Customer user ID"),
    orderId: z.string().optional().describe("Related order ID if applicable"),
    subject: z.string().describe("Short summary of the issue"),
    description: z
      .string()
      .describe("Full description of the issue for the human agent"),
    customerEmail: z
      .string()
      .email()
      .optional()
      .describe("Customer email for notification"),
    customerName: z
      .string()
      .optional()
      .describe("Customer name for personalised email"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketId: z.string().optional(),
    emailSent: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
})
  .then(createUrgentTicketStep)
  .then(notifyCustomerStep)
  .commit();
