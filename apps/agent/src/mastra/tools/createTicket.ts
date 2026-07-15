// src/mastra/tools/createTicket.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import db from "../data/db.js";

// ── Shared logic — used by tool AND workflow steps ────────────────
// NOTE: userId is intentionally required and is NEVER meant to be supplied
// by the LLM/user input. Callers (the tool below, or any workflow step)
// must pass the authenticatedUserId sourced from requestContext.
export async function createTicketLogic(params: {
  userId: string;
  orderId?: string;
  subject: string;
  description: string;
  priority?: "low" | "normal" | "high";
}) {
  const { userId, orderId, subject, description, priority } = params;
  console.log("[createTicket] INPUT:", JSON.stringify(params));
  try {
    // Postgres has no lastInsertRowid/rowid — RETURNING gets the new row directly.
    const rows = await db.query(
      `INSERT INTO support_tickets (user_id, order_id, subject, description, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userId, orderId ?? null, subject, description, priority ?? "normal"],
    );

    const row = rows[0] as { id: number; created_at: string };

    console.log("[createTicket] SUCCESS:", row.id);
    return { success: true, ticketId: row.id.toString(), createdAt: row.created_at };
  } catch (err: any) {
    console.error("[createTicket] ERROR:", err.message);
    return { success: false, error: err.message };
  }
}

export const createTicketTool = createTool({
  id: "create-ticket",
  description:
    "Create a support ticket in the database for the currently authenticated customer. " +
    "Requires the customer to be logged in — there is no anonymous ticket creation.",
  // SECURITY: userId is deliberately NOT part of the input schema.
  // The LLM cannot and must not supply/override the ticket owner — see
  // getOrdersByUserTool for the same pattern. Only orderId/subject/description/
  // priority come from the model; identity comes exclusively from requestContext.
  inputSchema: z.object({
    orderId: z.string().optional().describe("Optional related order ID, e.g. order_12345"),
    subject: z.string().describe("Short summary of the issue"),
    description: z.string().describe("Full description of the issue"),
    priority: z.enum(["low", "normal", "high"]).optional(),
  }),
  execute: async (inputData, { requestContext }) => {
    const authenticatedUserId = requestContext?.get(MASTRA_RESOURCE_ID_KEY as any);

    if (!authenticatedUserId) {
      return {
        success: false,
        error: "not_authenticated",
        message: "You need to be logged in to create a support ticket. Please log in and try again.",
      };
    }

    return createTicketLogic({
      userId: authenticatedUserId as string,
      orderId: inputData.orderId,
      subject: inputData.subject,
      description: inputData.description,
      priority: inputData.priority,
    });
  },
});