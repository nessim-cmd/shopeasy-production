import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import { medusa, getAdminHeaders } from "../utils/medusa.js";
import type { HttpTypes } from "@medusajs/types";

export const updateAddressTool = createTool({
  id: "update-address",
  description:
    "Update the delivery address for the currently authenticated customer's account. " +
    "This tool cannot update another customer's address.",
  // SECURITY: userId is intentionally NOT part of the input schema. This is
  // a self-service action ("update MY address") — the LLM must never be able
  // to supply/override whose account gets modified. See createTicketTool /
  // sendEmailTool / bookAppointmentTool for the same pattern.
  inputSchema: z.object({
    newAddress: z.string().min(1, "Address cannot be empty"),
  }),
  execute: async (inputData, { requestContext }) => {
    const authenticatedUserId = requestContext?.get(MASTRA_RESOURCE_ID_KEY as any);

    if (!authenticatedUserId) {
      return {
        success: false,
        error: "not_authenticated",
        message: "You need to be logged in to update your delivery address. Please log in and try again.",
      };
    }

    try {
      await medusa.client.fetch(
        `/admin/customers/${authenticatedUserId}/addresses`,
        {
          method: "POST",
          headers: getAdminHeaders(),
          body: {
            address_name: "Delivery",
            address_1: inputData.newAddress,
            country_code: "us", // TODO: hardcoded fallback country — confirm this is intentional
                                 // for your target market (Tunisia/EU); a wrong country_code can
                                 // silently break shipping/tax calculation downstream.
          }
        }
      );

      return { success: true, updated: inputData.newAddress };
    } catch (error: any) {
      return { success: false, error: `Failed to update address: ${error.message}` };
    }
  },
});