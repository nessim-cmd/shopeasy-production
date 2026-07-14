// src/mastra/tools/createTicket.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";

// ── Shared logic — used by tool AND workflow steps ────────────────
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
  description: "Create a support ticket in the database.",
  inputSchema: z.object({
    userId: z.string(),
    orderId: z.string().optional(),
    subject: z.string(),
    description: z.string(),
    priority: z.enum(["low", "normal", "high"]).optional(),
  }),
  execute: async (inputData) => {
    return createTicketLogic(inputData);
  },
});