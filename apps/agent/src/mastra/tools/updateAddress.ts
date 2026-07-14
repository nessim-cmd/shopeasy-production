import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

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

    try {
      await medusa.client.fetch(
        `/admin/customers/${userId}/addresses`,
        {
          method: "POST",
          headers: getAdminHeaders(),
          body: {
            address_name: "Delivery",
            address_1: newAddress,
            country_code: "us", // fallback country
          }
        }
      );

      return { success: true, updated: newAddress };
    } catch (error: any) {
      return { success: false, error: `Failed to update address: ${error.message}` };
    }
  },
});