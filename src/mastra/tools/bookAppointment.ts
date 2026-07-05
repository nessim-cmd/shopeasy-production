import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

function getCalendarClient() {
  const root = process.env.PROJECT_ROOT ?? process.cwd();
  const credPath = path.join(root, "google-credentials.json");
  const tokenPath = path.join(root, "google-token.json");

  console.log("[Calendar] credentials path:", credPath);

  if (!fs.existsSync(credPath)) {
    throw new Error(`google-credentials.json not found at: ${credPath}`);
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`google-token.json not found — run: npm run google-auth`);
  }

  const credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
  const { client_id, client_secret, redirect_uris } = credentials.web;

  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );
  auth.setCredentials(token);

  auth.on("tokens", (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    fs.writeFileSync(
      tokenPath,
      JSON.stringify({ ...existing, ...newTokens }, null, 2),
    );
    console.log("[Calendar] Token auto-refreshed");
  });

  return google.calendar({ version: "v3", auth });
}

// ── Shared logic — used by tool AND workflow steps ────────────────
export async function bookAppointmentLogic(params: {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  customerEmail?: string;
}) {
  const { title, description, startDateTime, endDateTime, customerEmail } =
    params;
  try {
    const calendar = getCalendarClient();
    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
      requestBody: {
        summary: title,
        description,
        start: { dateTime: startDateTime, timeZone: "Europe/Paris" },
        end: { dateTime: endDateTime, timeZone: "Europe/Paris" },
        attendees: customerEmail ? [{ email: customerEmail }] : [],
      },
    });
    return {
      success: true,
      eventId: event.data.id ?? undefined,
      eventLink: event.data.htmlLink ?? undefined,
      title: event.data.summary ?? undefined,
    };
  } catch (err: any) {
    console.error("[bookAppointment] Error:", err.message);
    return { success: false, error: err.message };
  }
}

import { enforcePolicy } from "../guardrails/policyEngine.js";

export const bookAppointmentTool = createTool({
  id: "book-appointment",
  description:
    "Book a support appointment or delivery slot in Google Calendar.",
  inputSchema: z.object({
    title: z.string().describe("Title of the appointment"),
    description: z.string().describe("Details about the appointment"),
    startDateTime: z
      .string()
      .describe("Start time ISO 8601 e.g. 2026-06-16T14:00:00"),
    endDateTime: z
      .string()
      .describe("End time ISO 8601 e.g. 2026-06-16T15:00:00"),
    customerEmail: z
      .string()
      .email()
      .optional()
      .describe("Customer email to invite"),
  }),
  execute: async (inputData) => {
    // Layer 5 — Check IDOR Appointment Policy
    enforcePolicy({
      toolName: "book-appointment",
      targetEmail: inputData.customerEmail,
    });

    return bookAppointmentLogic(inputData);
  },
});
