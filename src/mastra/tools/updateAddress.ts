import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";

export const updateAddressTool = createTool({
  id: "update-address",
  description: "Update the delivery address for a customer account.",
  inputSchema: z.object({
    userId: z.string(),
    newAddress: z.string(),
  }),
  execute: async (inputData, { requestContext }) => {
    const { userId, newAddress } = inputData;

    await enforcePolicy({
      toolName: "update-address",
      requestedUserId: userId,
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    const rows = await db.query(
      `UPDATE user_profiles SET address = $1 WHERE user_id = $2 RETURNING user_id`,
      [newAddress, userId],
    );

    if (rows.length === 0) {
      return { success: false, error: `User ${userId} not found` };
    }
    return { success: true, updated: newAddress };
  },
});