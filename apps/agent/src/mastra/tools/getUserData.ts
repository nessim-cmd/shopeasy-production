import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { enforcePolicy } from "../guardrails/policyEngine.js";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

export const getUserDataTool = createTool({
  id: "get-user-data",
  description:
    "Get a customer profile including contact details and account info. Sensitive financial fields (CVV, PIN, full card number) are never exposed by this tool.",
  inputSchema: z.object({
    userId: z.string().describe("The Medusa customer ID to look up, e.g. cus_01H..."),
  }),
  execute: async (inputData, { requestContext }) => {
    await enforcePolicy({
      toolName: "get-user-data",
      requestedUserId: inputData.userId,
      authenticatedUserId: requestContext?.get(MASTRA_RESOURCE_ID_KEY as any),
    });

    try {
      const response = await medusa.client.fetch(
        `/admin/customers/${inputData.userId}`,
        {
          method: "GET",
          headers: getAdminHeaders(),
        }
      ) as { customer: HttpTypes.AdminCustomer };
      const customer = response.customer;

      const addressStr = customer.addresses && customer.addresses.length > 0
        ? `${customer.addresses[0].address_1}, ${customer.addresses[0].city}`
        : null;

      return {
        id: customer.id,
        name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email,
        email: customer.email,
        phone: customer.phone || null,
        address: addressStr,
      };
    } catch (error: any) {
      return { error: `User ${inputData.userId} not found or Medusa API error: ${error.message}` };
    }
  },
});