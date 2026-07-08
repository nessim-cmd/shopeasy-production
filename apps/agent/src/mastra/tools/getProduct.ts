// src/mastra/tools/getProduct.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";

interface Product {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  image_url: string;
  stock: number;
  rating: number;
}

export async function getProductLogic(query?: string): Promise<Product[] | { error: string }> {
  try {
    if (query) {
      // Match by numeric id, exact slug, or partial name (case-insensitive).
      // id is a Postgres SERIAL (integer), so it's cast to text before comparing
      // against a possibly non-numeric query string.
      const products = (await db
        .prepare(
          `SELECT * FROM products
           WHERE id::text = $1 OR slug = $1 OR name ILIKE '%' || $1 || '%'`,
        )
        .all([query])) as Product[];
      return products;
    } else {
      const products = (await db.prepare(`SELECT * FROM products`).all()) as Product[];
      return products;
    }
  } catch (err: any) {
    return { error: `Database error: ${err.message}` };
  }
}

export const getProductTool = createTool({
  id: "get-product",
  description:
    "Get product details (price, description, stock) from the store database. Search by name, slug, or numeric ID, or leave blank to list all products.",
  inputSchema: z.object({
    query: z.string().optional().describe("Optional product name, slug, ID, or keyword to search for."),
  }),
  execute: async (inputData, context) => {
    console.log(`[getProductTool] execute called with query: ${inputData.query || "none"}`);
    const result = await getProductLogic(inputData.query);
    return result;
  },
});