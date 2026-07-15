import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

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
// NOTE: customerEmail must always be resolved server-side (never taken
// verbatim from LLM/user input) before calling this. See bookAppointmentTool
// .execute below.
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

// Looks up the *real* email address for the currently authenticated customer.
// This is the only source of truth for the invited attendee — the LLM never
// supplies it directly.
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
    console.error(`[bookAppointmentTool] Failed to resolve email for ${customerId}: ${err.message}`);
    return null;
  }
}

export const bookAppointmentTool = createTool({
  id: "book-appointment",
  description:
    "Book a support appointment or delivery slot in Google Calendar for the currently " +
    "authenticated customer. The customer's own registered email is invited automatically — " +
    "this tool cannot invite arbitrary/external addresses.",
  // SECURITY: customerEmail is intentionally NOT part of the input schema.
  // The LLM (and therefore any prompt injection) can never choose who gets
  // invited, which would otherwise let it leak conversation details (order
  // info, address, etc. baked into `description`) to an attacker-controlled
  // inbox via a calendar invite.
  inputSchema: z.object({
    title: z.string().describe("Title of the appointment"),
    description: z.string().describe("Details about the appointment"),
    startDateTime: z
      .string()
      .describe("Start time ISO 8601 e.g. 2026-06-16T14:00:00"),
    endDateTime: z
      .string()
      .describe("End time ISO 8601 e.g. 2026-06-16T15:00:00"),
  }),
  execute: async (inputData, { requestContext }) => {
    const authenticatedUserId = requestContext?.get(MASTRA_RESOURCE_ID_KEY as any);

    if (!authenticatedUserId) {
      return {
        success: false,
        error: "not_authenticated",
        message: "You need to be logged in to book an appointment. Please log in and try again.",
      };
    }

    const customerEmail = await resolveAuthenticatedCustomerEmail(authenticatedUserId as string);

    if (!customerEmail) {
      return {
        success: false,
        error: "email_not_found",
        message: "I couldn't find a verified email address on your account.",
      };
    }

    return bookAppointmentLogic({
      ...inputData,
      customerEmail,
    });
  },
});