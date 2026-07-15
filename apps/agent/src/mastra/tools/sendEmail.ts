import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import nodemailer from "nodemailer";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// ── Shared logic — used by tool AND workflow steps ────────────────
// NOTE: `to` must always be resolved server-side (never taken verbatim from
// LLM/user input) before calling this. See sendEmailTool.execute below.
export async function sendEmailLogic(
  to: string,
  subject: string,
  body: string,
) {
  try {
    await transporter.sendMail({
      from: `ShopEasy Support <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: body,
    });
    return { success: true, sentTo: to };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Looks up the *real* email address for the currently authenticated customer.
// This is the only source of truth for "to" — the LLM never supplies it.
async function resolveAuthenticatedCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const response = await medusa.client.fetch(
      `/admin/customers/${customerId}`,
      {
        method: "GET",
        headers: getAdminHeaders(),
      },
    ) as { customer: HttpTypes.AdminCustomer };
    return response.customer?.email || null;
  } catch (err: any) {
    console.error(`[sendEmailTool] Failed to resolve email for ${customerId}: ${err.message}`);
    return null;
  }
}

export const sendEmailTool = createTool({
  id: "send-email",
  description:
    "Send a support email to the currently authenticated customer's own registered email address. " +
    "This tool cannot send email to arbitrary/external addresses.",
  // SECURITY: "to" is intentionally NOT part of the input schema. The LLM
  // (and therefore any prompt injection from product data, reviews, tickets,
  // etc.) can never choose the recipient. The recipient is always the real,
  // Medusa-registered email of the authenticated customer.
  inputSchema: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  execute: async (inputData, { requestContext }) => {
    const authenticatedUserId = requestContext?.get(MASTRA_RESOURCE_ID_KEY as any);

    if (!authenticatedUserId) {
      return {
        success: false,
        error: "not_authenticated",
        message: "You need to be logged in for me to email you anything. Please log in and try again.",
      };
    }

    const recipientEmail = await resolveAuthenticatedCustomerEmail(authenticatedUserId as string);

    if (!recipientEmail) {
      return {
        success: false,
        error: "email_not_found",
        message: "I couldn't find a verified email address on your account.",
      };
    }

    return sendEmailLogic(recipientEmail, inputData.subject, inputData.body);
  },
});