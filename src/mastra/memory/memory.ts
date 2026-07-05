// src/mastra/memory/memory.ts
import "dotenv/config";
import { Memory } from "@mastra/memory";
import { PgVector, PostgresStore } from "@mastra/pg";
import { embedder } from "../config/embedder.js";

// ── Vector store — pgvector on Neon ────────────────────────────────
const vectorStore = new PgVector({
  id: "shop-memory-vector",
  connectionString: process.env.DATABASE_URL!,
});

// ── Memory storage — Postgres (was SQLite, broke on Vercel) ───────
const memoryStorage = new PostgresStore({
  id: "shop-memory-storage",
  connectionString: process.env.DATABASE_URL!,
});

// ── Mastra Memory ────────────────────────────────────────────────
export const agentMemory = new Memory({
  vector: vectorStore,
  storage: memoryStorage,
  embedder,
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
    },
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
  },
});