import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { HttpTypes } from "@medusajs/types";
import { createRequire } from "module";

// Trick Vercel's NFT tracer to include the dependency
if (false) {
  require("@medusajs/js-sdk");
}

const req = createRequire(import.meta.url);
const MedusaPkg = req("@medusajs/js-sdk");

// Handle Node ESM default export quirk

const Medusa = (MedusaPkg as any).default || MedusaPkg;

const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY,
  maxRetries: 3,
});

export async function getProductLogic(query?: string) {
  try {
    // 1. Fetch default region for pricing context
    const regionsResponse = await medusa.client.fetch("/store/regions", { method: "GET" }) as { regions: HttpTypes.StoreRegion[] };
    const regionId = regionsResponse.regions[0]?.id;

    // 2. Build query parameters
    const queryParams: Record<string, any> = {
      fields: "*variants.calculated_price,+variants.inventory_quantity,*variants.options",
    };
    if (regionId) {
      queryParams.region_id = regionId;
    }
    if (query) {
      queryParams.q = query;
    }
    
    // 3. Fetch products
    const response = await medusa.client.fetch(
      "/store/products",
      {
        method: "GET",
        query: queryParams,
      },
    ) as { products: HttpTypes.StoreProduct[] };
    const products = response.products;
    
    return products;
  } catch (err: any) {
    return { error: `Medusa API error: ${err.message}` };
  }
}

export const getProductTool = createTool({
  id: "get-product",
  description:
    "Get product details (price, description, stock, variants) from the Medusa Store API. Search by name, handle, or keyword, or leave blank to list all products.",
  inputSchema: z.object({
    query: z.string().optional().describe("Optional product name, handle, or keyword to search for."),
  }),
  execute: async (inputData, context) => {
    console.log(`[getProductTool] execute called with query: ${inputData.query || "none"}`);
    const result = await getProductLogic(inputData.query);
    return result;
  },
});