/**
 * src/mastra/guardrails/policyEngine.ts
 *
 * Layer 5 — Tool Policy Engine (Access Control)
 *
 * Purpose:
 *   LLMs are gullible. Even with prompt instructions telling them NOT to
 *   share certain data, a clever prompt injection can trick them into using
 *   a tool to exfiltrate data (IDOR - Insecure Direct Object Reference).
 *
 *   The Policy Engine enforces strict, hardcoded access controls ON THE TOOLS
 *   THEMSELVES, completely bypassing the LLM's "judgement".
 *
 * How it works:
 *   We wrap sensitive tool logic in a `withPolicy` checker. If the LLM tries
 *   to fetch data it shouldn't access, the tool throws a hard error.
 */

import db from "../data/db.js";

// ── Dynamic Session Lock ──────────────────────────────────────────────────────
// Instead of a hardcoded mock, the session starts "unlocked".
// The FIRST time the agent looks up a user or an order, we lock the session to that user.
// In a real multi-tenant production app, this would be a Map<threadId, User> or JWT.
// For this local agent demo, a global lock effectively simulates a single chat session.

let LOCKED_USER_ID: string | null = null;
let LOCKED_USER_EMAIL: string | null = null;

export function resetSessionLock() {
  LOCKED_USER_ID = null;
  LOCKED_USER_EMAIL = null;
  console.log(`[PolicyEngine] 🔓 Session Lock reset. Ready for a new user.`);
}

function lockSession(userId: string) {
  if (LOCKED_USER_ID) return; // already locked

  const user = db
    .prepare(`SELECT email FROM users WHERE id = ?`)
    .get(userId) as any;
  if (!user) return;

  LOCKED_USER_ID = userId;
  LOCKED_USER_EMAIL = user.email;
  console.log(
    `[PolicyEngine] 🔒 Session dynamically locked to ${LOCKED_USER_ID} (${LOCKED_USER_EMAIL})`,
  );
}

// ── Policy Definitions ────────────────────────────────────────────────────────

type PolicyContext = {
  toolName: string;
  [key: string]: any;
};

export function enforcePolicy(context: PolicyContext) {
  // 1. Global Admin Tool Block
  if (context.toolName === "get-all-orders") {
    throw new Error(
      "POLICY_VIOLATION: Support agents are not authorized to fetch bulk order data.",
    );
  }

  // 2. IDOR Protection
  if (context.toolName === "get-order") {
    const { orderOwnerId } = context;
    if (!LOCKED_USER_ID) lockSession(orderOwnerId);

    if (orderOwnerId !== LOCKED_USER_ID) {
      console.error(
        `[PolicyEngine] 🚨 IDOR BLOCKED: Attempted to fetch order belonging to ${orderOwnerId} (Session User: ${LOCKED_USER_ID})`,
      );
      throw new Error(
        `POLICY_VIOLATION: You are not authorized to access orders belonging to another user.`,
      );
    }
  }

  // 3. Prevent accessing other users' order histories
  if (context.toolName === "get-orders-by-user") {
    const { requestedUserId } = context;
    if (!LOCKED_USER_ID) lockSession(requestedUserId);

    if (requestedUserId !== LOCKED_USER_ID) {
      console.error(
        `[PolicyEngine] 🚨 IDOR BLOCKED: Attempted to fetch history for ${requestedUserId}`,
      );
      throw new Error(
        `POLICY_VIOLATION: You can only view orders for your own account.`,
      );
    }
  }

  // 4. Prevent modifying other users' addresses
  if (context.toolName === "update-address") {
    const { requestedUserId } = context;
    if (!LOCKED_USER_ID) lockSession(requestedUserId);

    if (requestedUserId !== LOCKED_USER_ID) {
      console.error(
        `[PolicyEngine] 🚨 IDOR BLOCKED: Attempted to update address for ${requestedUserId}`,
      );
      throw new Error(
        `POLICY_VIOLATION: You can only update your own address.`,
      );
    }
  }

  // 5. Prevent unauthorized refunds or refunds exceeding €500 limit
  if (context.toolName === "process-refund") {
    const { orderOwnerId, refundAmount } = context;
    if (!LOCKED_USER_ID) lockSession(orderOwnerId);

    if (orderOwnerId !== LOCKED_USER_ID) {
      console.error(
        `[PolicyEngine] 🚨 FRAUD BLOCKED: Attempted refund on order belonging to ${orderOwnerId}`,
      );
      throw new Error(
        `POLICY_VIOLATION: You cannot refund an order that does not belong to you.`,
      );
    }
    if (refundAmount > 500) {
      console.error(
        `[PolicyEngine] 🚨 POLICY BLOCKED: Attempted refund of €${refundAmount} (Exceeds €500 limit)`,
      );
      throw new Error(
        `POLICY_VIOLATION: Refunds over €500 require managerial approval and cannot be processed automatically.`,
      );
    }
  }

  // 6. Prevent fetching other users' PII data
  if (context.toolName === "get-user-data") {
    const { requestedUserId } = context;
    if (!LOCKED_USER_ID) lockSession(requestedUserId);

    if (requestedUserId !== LOCKED_USER_ID) {
      console.error(
        `[PolicyEngine] 🚨 IDOR BLOCKED: Attempted to fetch PII for ${requestedUserId}`,
      );
      throw new Error(
        `POLICY_VIOLATION: You can only view your own account details.`,
      );
    }
  }

  // 7. Prevent sending emails to arbitrary addresses (Phishing / Spam protection)
  if (context.toolName === "send-email") {
    const { targetEmail } = context;
    if (!LOCKED_USER_EMAIL) {
      throw new Error(
        `POLICY_VIOLATION: Cannot send email before verifying user identity.`,
      );
    }
    if (targetEmail !== LOCKED_USER_EMAIL) {
      console.error(
        `[PolicyEngine] 🚨 PHISHING BLOCKED: Attempted to email ${targetEmail}`,
      );
      throw new Error(
        `POLICY_VIOLATION: You can only send emails to the registered address on your account.`,
      );
    }
  }

  // 8. Prevent booking appointments for other users
  if (context.toolName === "book-appointment") {
    const { targetEmail } = context;
    if (!LOCKED_USER_EMAIL) {
      throw new Error(
        `POLICY_VIOLATION: Cannot book appointment before verifying user identity.`,
      );
    }
    if (targetEmail && targetEmail !== LOCKED_USER_EMAIL) {
      console.error(
        `[PolicyEngine] 🚨 IDOR BLOCKED: Attempted to book appointment for ${targetEmail}`,
      );
      throw new Error(
        `POLICY_VIOLATION: You can only book appointments for yourself.`,
      );
    }
  }
}
