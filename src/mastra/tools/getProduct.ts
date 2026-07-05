// src/mastra/tools/getProduct.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db.js";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  description: string;
  image_url: string;
}

export function getProductLogic(query?: string): Product[] | { error: string } {
  try {
    if (query) {
      // Find products matching the name or ID (case-insensitive)
      const products = db
        .prepare(`SELECT * FROM products WHERE id = ? OR name LIKE ?`)
        .all(query, `%${query}%`) as Product[];
      return products;
    } else {
      // Return all products
      const products = db
        .prepare(`SELECT * FROM products`)
        .all() as Product[];
      return products;
    }
  } catch (err: any) {
    return { error: `Database error: ${err.message}` };
  }
}

export const getProductTool = createTool({
  id: "get-product",
  description: "Get product details (price, description, stock) from the store database. Search by name or product ID, or leave blank to list all products.",
  inputSchema: z.object({
    query: z.string().optional().describe("Optional product name, ID, or keyword to search for."),
  }),
  execute: async (inputData, context) => {
    console.log(`[getProductTool] execute called with query: ${inputData.query || 'none'}`);
    const result = getProductLogic(inputData.query);
    return result;
  },
});
