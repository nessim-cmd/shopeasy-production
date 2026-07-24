import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import nodemailer from "nodemailer";
import { getBusinessDB } from "../data/db.js";

const db = getBusinessDB();

// ── Step 1: Gather stats from store_db ────────────────────────────
const gatherStatsStep = createStep({
  id: "gather-stats",
  inputSchema: z.object({}),
  outputSchema: z.object({
    openTickets: z.number(),
    highPriority: z.number(),
    summary: z.string(),
  }),
  execute: async () => {
    const openResult = await db.query(
      `SELECT COUNT(*) FROM support_tickets WHERE status = 'open'`,
    );
    const highResult = await db.query(
      `SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND priority = 'high'`,
    );

    const openTickets = parseInt(openResult[0].count);
    const highPriority = parseInt(highResult[0].count);

    const today = new Date().toDateString();
    const summary = [
      `ShopEasy Daily Report — ${today}`,
      `═══════════════════════════════`,
      `Open tickets:          ${openTickets}`,
      `High priority tickets: ${highPriority}`,
      ``,
      `Generated automatically at 8:00 AM by ShopEasy Support Agent.`,
    ].join("\n");

    return { openTickets, highPriority, summary };
  },
});

// ── Step 2: Send report via Gmail SMTP ───────────────────────────
const sendReportStep = createStep({
  id: "send-report",
  inputSchema: z.object({
    openTickets: z.number(),
    highPriority: z.number(),
    summary: z.string(),
  }),
  outputSchema: z.object({ sent: z.boolean(), error: z.string().optional() }),
  execute: async ({ inputData }) => {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `ShopEasy Agent <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `ShopEasy Daily Report — ${new Date().toDateString()}`,
        text: inputData.summary,
      });

      console.log(`[CRON] Daily report sent to ${process.env.GMAIL_USER}`);
      return { sent: true };
    } catch (err: any) {
      console.error("[CRON] Failed to send report:", err.message);
      return { sent: false, error: err.message };
    }
  },
});

// ── Workflow with native Mastra cron ─────────────────────────────
export const dailyReportWorkflow = createWorkflow({
  id: "daily-report",
  inputSchema: z.object({}),
  outputSchema: z.object({ sent: z.boolean() }),
  schedule: {
    cron: "0 8 * * *",
  },
})
  .then(gatherStatsStep)
  .then(sendReportStep)
  .commit();