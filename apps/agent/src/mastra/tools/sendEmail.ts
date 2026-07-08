import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// ── Shared logic — used by tool AND workflow steps ────────────────
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

import { enforcePolicy } from "../guardrails/policyEngine.js";

export const sendEmailTool = createTool({
  id: "send-email",
  description: "Send an email to a customer.",
  inputSchema: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async (inputData) => {
    // Layer 5 — Check Anti-Phishing / Spam Policy
    enforcePolicy({
      toolName: "send-email",
      targetEmail: inputData.to,
    });

    return sendEmailLogic(inputData.to, inputData.subject, inputData.body);
  },
});
