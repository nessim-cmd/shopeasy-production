// src/mastra/tools/searchKnowledgeTool.ts
import "dotenv/config";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { embedV3 as embed } from "@mastra/core/vector";
import { PgVector } from "@mastra/pg";
import { embedder } from "../config/embedder.js";

const INDEX_NAME = "knowledge_base";
const TOP_K = 4;

// ── Lazy PgVector singleton ───────────────────────────────────────
let _pgVector: PgVector | null = null;
function getPgVector(): PgVector {
  if (!_pgVector) {
    _pgVector = new PgVector({
      id: "knowledge-search",
      connectionString: process.env.DATABASE_URL!,
    });
  }
  return _pgVector;
}

// ── Tool ──────────────────────────────────────────────────────────
export const searchKnowledgeTool = createTool({
  id: "search-knowledge-tool",

  description: `Search ShopEasy's internal policy knowledge base.
Use this tool whenever the customer asks about:
- Returns, exchanges, or sending items back
- Refunds, money back, or payment disputes
- Shipping times, delivery estimates, or tracking
- Privacy policy, data collection, or GDPR rights
- Payment methods, security, or fraud
- Order cancellation or modification rules
- Support hours or how to escalate to a human
Do NOT use this for looking up a specific customer's order — use getOrderTool for that.`,

  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "The customer question or topic to search for in the knowledge base",
      ),
  }),

  execute: async (inputData) => {
    const { query } = inputData;

    try {
      const result = await embed({ model: embedder, value: query });
      const queryVector = result.embedding as number[];

      const pgVector = getPgVector();
      const results = await pgVector.query({
        indexName: INDEX_NAME,
        queryVector,
        topK: TOP_K,
        includeVector: false,
      });

      if (!results || results.length === 0) {
        return {
          found: false,
          message: "No relevant policy information found.",
          results: [],
        };
      }

      const formatted = results
        .filter((r) => (r.score ?? 0) > 0.3)
        .map((r, i) => ({
          rank: i + 1,
          score: Math.round((r.score ?? 0) * 100) / 100,
          section: (r.metadata as any)?.section ?? "Unknown",
          text: (r.metadata as any)?.text ?? "",
        }));

      if (formatted.length === 0) {
        return {
          found: false,
          message:
            "No sufficiently relevant policy information found. Consider escalating to a human agent.",
          results: [],
        };
      }

      return {
        found: true,
        message: `Found ${formatted.length} relevant policy excerpts.`,
        results: formatted,
      };
    } catch (err: any) {
      if (
        err?.message?.includes("does not exist") ||
        err?.message?.includes("knowledge_base")
      ) {
        return {
          found: false,
          message: "Knowledge base not seeded yet. Run: npm run seed:knowledge",
          results: [],
        };
      }
      throw err;
    }
  },
});