/**
 * src/mastra/guardrails/policyEngine.ts
 *
 * Layer 5 — Tool Policy Engine (Access Control)
 *
 * Identity now comes from MASTRA_RESOURCE_ID_KEY in requestContext, set by
 * userIdentityMiddleware from the store's Neon-Auth-verified session — not
 * from a self-locking global that trusted whichever ID a tool call saw first.
 */

import db from "../data/db.js";

async function getEmailForUser(userId: string): Promise<string | null> {
  const user = (await db
    .prepare(`SELECT email FROM neon_auth."user" WHERE id = $1`)
    .get([userId])) as { email: string } | null;
  return user?.email ?? null;
}

type PolicyContext = {
  toolName: string;
  authenticatedUserId?: string | null;
  [key: string]: any;
};

export async function enforcePolicy(context: PolicyContext) {
  const { toolName, authenticatedUserId } = context;

  if (!authenticatedUserId) {
    throw new Error("POLICY_VIOLATION: No authenticated user for this request.");
  }

  if (toolName === "get-all-orders") {
    throw new Error(
      "POLICY_VIOLATION: Support agents are not authorized to fetch bulk order data.",
    );
  }

  if (toolName === "get-order") {
    const { orderOwnerId } = context;
    if (orderOwnerId !== authenticatedUserId) {
      console.error(`[PolicyEngine] 🚨 IDOR BLOCKED: order owner ${orderOwnerId} vs authenticated ${authenticatedUserId}`);
      throw new Error(`POLICY_VIOLATION: You are not authorized to access orders belonging to another user.`);
    }
  }

  if (toolName === "get-orders-by-user") {
    const { requestedUserId } = context;
    if (requestedUserId !== authenticatedUserId) {
      console.error(`[PolicyEngine] 🚨 IDOR BLOCKED: requested ${requestedUserId} vs authenticated ${authenticatedUserId}`);
      throw new Error(`POLICY_VIOLATION: You can only view orders for your own account.`);
    }
  }

  if (toolName === "update-address") {
    const { requestedUserId } = context;
    if (requestedUserId !== authenticatedUserId) {
      throw new Error(`POLICY_VIOLATION: You can only update your own address.`);
    }
  }

  if (toolName === "process-refund") {
    const { orderOwnerId, refundAmount } = context;
    if (orderOwnerId !== authenticatedUserId) {
      throw new Error(`POLICY_VIOLATION: You cannot refund an order that does not belong to you.`);
    }
    if (refundAmount > 500) {
      throw new Error(`POLICY_VIOLATION: Refunds over €500 require managerial approval and cannot be processed automatically.`);
    }
  }

  if (toolName === "get-user-data") {
    const { requestedUserId } = context;
    if (requestedUserId !== authenticatedUserId) {
      throw new Error(`POLICY_VIOLATION: You can only view your own account details.`);
    }
  }

  if (toolName === "send-email") {
    const { targetEmail } = context;
    const ownEmail = await getEmailForUser(authenticatedUserId);
    if (!ownEmail || targetEmail !== ownEmail) {
      throw new Error(`POLICY_VIOLATION: You can only send emails to the registered address on your account.`);
    }
  }

  if (toolName === "book-appointment") {
    const { targetEmail } = context;
    if (targetEmail) {
      const ownEmail = await getEmailForUser(authenticatedUserId);
      if (!ownEmail || targetEmail !== ownEmail) {
        throw new Error(`POLICY_VIOLATION: You can only book appointments for yourself.`);
      }
    }
  }
}