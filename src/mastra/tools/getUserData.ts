// src/mastra/tools/getUserData.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  creditCard: string;
  cvv: string;
  pin: string;
  accountBalance: number;
}

/**
 * Mask a credit card number to only the last 4 digits.
 * "4111-1111-1111-1234" -> "**** **** **** 1234"
 */
function maskCard(card: string): string {
  const digits = card.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
}

import { enforcePolicy } from "../guardrails/policyEngine";

export const getUserDataTool = createTool({
  id: "get-user-data",
  description:
    "Get a customer profile including contact details and account info. Sensitive financial fields (CVV, PIN, full card number) are never exposed by this tool.",
  inputSchema: z.object({
    userId: z.string().describe("The user ID to look up, e.g. USR-001"),
  }),
  execute: async (inputData) => {
    // Layer 5 — Check IDOR Access Policy
    enforcePolicy({
      toolName: "get-user-data",
      requestedUserId: inputData.userId,
    });

    const user = db
      .prepare<string, User>(`SELECT * FROM users WHERE id = ?`)
      .get(inputData.userId);

    if (!user) return { error: `User ${inputData.userId} not found` };

    // ── Security: mask/strip sensitive financial fields at the source ────────
    // The LLM, memory, and any downstream guardrail should never see these
    // raw values — masking here means there is nothing to leak, regardless
    // of how the conversation unfolds afterward.
    const { creditCard, cvv, pin, accountBalance, ...safeFields } = user;

    return {
      ...safeFields,
      cardLast4: maskCard(creditCard),
      // CVV and PIN are NEVER returned — there is no legitimate customer
      // support reason for the agent to see or repeat these.
      // accountBalance is also withheld here; expose it only via a
      // dedicated, policy-gated tool if a real use case requires it.
    };
  },
});
