// src/mastra/memory/memory.ts
import "dotenv/config";
import { Memory } from "@mastra/memory";
import { PgVector } from "@mastra/pg";
import { LibSQLStore } from "@mastra/libsql";
import { MEMORY_DB_PATH } from "../data/db.js";
import { embedder } from "../config/embedder.js"; // ← NEW: local fastembed model

// ── Vector store — pgvector running in Docker ─────────────────────
const vectorStore = new PgVector({
  id: "shop-memory-vector",
  connectionString: process.env.DATABASE_URL!,
});

// ── Memory storage — SQLite ──────────────────────────────────────
const memoryStorage = new LibSQLStore({
  id: "shop-memory-storage",
  url: `file:${MEMORY_DB_PATH}`,
});

// ── Mastra Memory ────────────────────────────────────────────────
// embedder is now provided → Mastra will:
//   1. Create a vector index in PgVector on first use
//   2. Embed every saved message turn with bge-small-en-v1.5
//   3. Enable semanticRecall — past relevant conversations surface automatically
export const agentMemory = new Memory({
  vector: vectorStore,
  storage: memoryStorage,
  embedder, // ← NEW: was missing, causing silent fallback to recency-only
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
    },
    semanticRecall: {
      topK: 3, // retrieve 3 most semantically similar past messages
      messageRange: {
        before: 2, // include 2 messages before each match for context
        after: 1, // include 1 message after each match for context
      },
    },
  },
});
