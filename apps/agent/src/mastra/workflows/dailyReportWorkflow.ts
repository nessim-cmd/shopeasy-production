/**
 * dailyReportWorkflow.ts
 * Runs every day at 8:00 AM via Mastra native cron scheduling.
 *
 * Steps:
 * 1. gatherStatsStep — queries Neon DB for open ticket count
 * 2. sendReportStep  — emails summary report to store admin (GMAIL_USER)
 *
 * Visible in Studio: http://localhost:4111 → Schedules tab
 * Can be paused, resumed, or triggered manually from Studio.
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import nodemailer from "nodemailer";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Step 1: Gather stats from Neon DB ────────────────────────────
const gatherStatsStep = createStep({
  id: "gather-stats",
  inputSchema: z.object({}),
  outputSchema: z.object({
    openTickets: z.number(),
    highPriority: z.number(),
    summary: z.string(),
  }),
  execute: async () => {
    const openResult = await pool.query(
      `SELECT COUNT(*) FROM support_tickets WHERE status = 'open'`,
    );
    const highResult = await pool.query(
      `SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND priority = 'high'`,
    );

    const openTickets = parseInt(openResult.rows[0].count);
    const highPriority = parseInt(highResult.rows[0].count);

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
        to: process.env.GMAIL_USER, // sends to yourself (admin)
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

  // ── Cron: every day at 8:00 AM ──
  schedule: {
    cron: "0 8 * * *", // minute hour day month weekday
  },
})
  .then(gatherStatsStep)
  .then(sendReportStep)
  .commit();
