// src/mastra/tools/getAllOrders.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import db from "../data/db";

import { enforcePolicy } from "../guardrails/policyEngine";

interface Order {
  id: string;
  userId: string;
  product: string;
  status: string;
  total: number;
  trackingUrl: string | null;
}

export const getAllOrdersTool = createTool({
  id: "get-all-orders",
  description: "List all orders in the ShopEasy system.",
  inputSchema: z.object({}),
  execute: async (_inputData) => {
    console.log("[getAllOrdersTool] execute called");
    // Layer 5 — Check Access Policy
    enforcePolicy({ toolName: "get-all-orders" });

    const orders = db.prepare<[], Order>(`SELECT * FROM orders`).all();
    return { orders, total: orders.length };
  },
});
