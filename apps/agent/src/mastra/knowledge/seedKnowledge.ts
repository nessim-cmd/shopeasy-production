// src/mastra/knowledge/seedKnowledge.ts
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { embedV3 as embed } from "@mastra/core/vector";
import { PgVector } from "@mastra/pg";
import { embedder, EMBEDDING_DIMENSION } from "../config/embedder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INDEX_NAME = "knowledge_base";
const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 100;

// ── Load policy document ──────────────────────────────────────────
const policyPath = path.join(__dirname, "shopPolicy.md");
const policyText = readFileSync(policyPath, "utf-8");
console.log(`📄 Loaded shopPolicy.md (${policyText.length} chars)`);

// ── Chunker ───────────────────────────────────────────────────────
function chunkText(
  text: string,
  size: number,
  overlap: number,
): Array<{ text: string; section: string }> {
  const chunks: Array<{ text: string; section: string }> = [];
  const sections = text.split(/\n(?=## )/);
  for (const section of sections) {
    const titleMatch = section.match(/^##\s+(.+)/);
    const sectionTitle = titleMatch ? titleMatch[1].trim() : "General";
    let start = 0;
    while (start < section.length) {
      const end = Math.min(start + size, section.length);
      const chunk = section.slice(start, end).trim();
      if (chunk.length > 40)
        chunks.push({ text: chunk, section: sectionTitle });
      if (end === section.length) break;
      start += size - overlap;
    }
  }
  return chunks;
}

// ── Step 1: chunk ─────────────────────────────────────────────────
const chunks = chunkText(policyText, CHUNK_SIZE, CHUNK_OVERLAP);
console.log(`✂️  Created ${chunks.length} chunks`);

// ── Step 2: create/recreate PgVector index ────────────────────────
const pgVector = new PgVector({
  id: "knowledge-seeder",
  connectionString: process.env.DATABASE_URL!,
});

// The dimension changed (384 → 768) with the fastembed → Gemini swap, so
// any existing index built for the old model must be dropped first, or
// upserts of 768-dim vectors into a 384-dim index will fail/corrupt.
console.log(`🗑️  Dropping any existing "${INDEX_NAME}" index (dimension change)…`);
try {
  await pgVector.deleteIndex({ indexName: INDEX_NAME });
  console.log("   ✅ Old index dropped");
} catch (err: any) {
  console.log("   ↳ No existing index to drop (fine on first run)");
}

console.log(
  `🗄️  Creating PgVector index "${INDEX_NAME}" (dim=${EMBEDDING_DIMENSION}, cosine)…`,
);
await pgVector.createIndex({
  indexName: INDEX_NAME,
  dimension: EMBEDDING_DIMENSION,
  metric: "cosine",
});
console.log("   ✅ Index ready");

// ── Step 3: embed + upsert ────────────────────────────────────────
const BATCH = 32;
let total = 0;

for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);

  const vectors: number[][] = [];
  for (const chunk of batch) {
    try {
      const result = await embed({ model: embedder, value: chunk.text });
      vectors.push(result.embedding as number[]);
    } catch (err: any) {
      console.error(`❌ Failed to embed chunk, using zero-vector fallback:`, err?.message ?? err);
      vectors.push(new Array(EMBEDDING_DIMENSION).fill(0));
    }
  }

  const ids = batch.map((_, j) => `policy-chunk-${i + j}`);
  const metadata = batch.map((c) => ({
    text: c.text,
    section: c.section,
    source: "shopPolicy.md",
  }));

  await pgVector.upsert({ indexName: INDEX_NAME, vectors, ids, metadata });

  total += batch.length;
  console.log(`   ↳ Upserted ${total}/${chunks.length} chunks…`);
}

console.log(
  `\n✅ Knowledge base seeded! ${total} chunks in PgVector index "${INDEX_NAME}"`,
);

await (pgVector as any).pool?.end?.();