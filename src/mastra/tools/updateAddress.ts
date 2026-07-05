// src/mastra/tools/updateAddress.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db";

import { enforcePolicy } from "../guardrails/policyEngine";

export const updateAddressTool = createTool({
  id: "update-address",
  description: "Update the delivery address for a customer account.",
  inputSchema: z.object({
    userId: z.string(),
    newAddress: z.string(),
  }),
  execute: async (inputData) => {
    const { userId, newAddress } = inputData;

    // Layer 5 — Check IDOR Access Policy
    enforcePolicy({ toolName: "update-address", requestedUserId: userId });

    const result = db
      .prepare(`UPDATE users SET address = ? WHERE id = ?`)
      .run(newAddress, userId);

    if (result.changes === 0) {
      return { success: false, error: `User ${userId} not found` };
    }
    return { success: true, updated: newAddress };
  },
});
