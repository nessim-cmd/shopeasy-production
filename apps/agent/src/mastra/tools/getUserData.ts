import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";

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

function maskCard(card: string): string {
  const digits = card.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
}

export const getUserDataTool = createTool({
  id: "get-user-data",
  description:
    "Get a customer profile including contact details and account info. Sensitive financial fields (CVV, PIN, full card number) are never exposed by this tool.",
  inputSchema: z.object({
    userId: z.string().describe("The real Neon Auth user ID to look up, e.g. 3718eee4-9d65-442a-899c-ac4c4f813811"),
  }),
  execute: async (inputData, { requestContext }) => {
    await enforcePolicy({
      toolName: "get-user-data",
      requestedUserId: inputData.userId,
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    const user = (await db
      .prepare(
        `SELECT u.id AS "id", u.name AS "name", u.email AS "email",
                p.phone, p.address,
                p.credit_card AS "creditCard", p.cvv, p.pin,
                p.account_balance AS "accountBalance"
         FROM neon_auth."user" u
         JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id = $1`,
      )
      .get([inputData.userId])) as User | null;

    if (!user) return { error: `User ${inputData.userId} not found` };

    const { creditCard, cvv, pin, accountBalance, ...safeFields } = user;

    return {
      ...safeFields,
      cardLast4: maskCard(creditCard),
    };
  },
});