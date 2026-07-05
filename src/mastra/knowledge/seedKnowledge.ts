// src/mastra/knowledge/seedKnowledge.ts
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { rmSync, existsSync, mkdirSync } from "fs";
import { FlagEmbedding, EmbeddingModel } from "@mastra/fastembed";
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

// ── Step 1: clean any corrupted cache and init the model ──────────
// retrieveModel skips download if the directory exists even if files are missing.
// We wipe the directory first to guarantee a clean download.
const cacheDir = process.env.FASTEMBED_CACHE_DIR ?? "/tmp/fastembed-models";
const modelDir = path.join(cacheDir, "fast-bge-small-en-v1.5");
const tokenizer = path.join(modelDir, "tokenizer.json");

const MAX_RETRIES = 5;
let modelReady = false;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    if (!existsSync(tokenizer)) {
      console.log(`🗑️  Model not fully cached — cleaning temp files (Attempt ${attempt}/${MAX_RETRIES})…`);
      rmSync(cacheDir, { recursive: true, force: true });
      mkdirSync(cacheDir, { recursive: true });
    } else {
      // Ensure cacheDir exists even if tokenizer exists, just in case
      mkdirSync(cacheDir, { recursive: true });
    }

    console.log("⬇️  Initialising bge-small-en-v1.5 (downloads ~30 MB if not cached)…");
    
    // Add a strict 60-second timeout because fastembed hangs forever on some networks
    const initPromise = FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      cacheDir,
      showDownloadProgress: true,
    });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Download hung/timed out after 60 seconds")), 60000)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
    
    console.log("   ✅ Model ready");
    modelReady = true;
    break; // success
  } catch (err: any) {
    console.error(`❌ Download failed on attempt ${attempt}:`, err.message);
    if (attempt === MAX_RETRIES) {
      console.warn("🚨 Max retries reached. Fastembed could not download the model.");
      console.warn("⏭️  Skipping Knowledge Base seeding. The agent will work, but RAG will be empty.");
      process.exit(0); // Exit cleanly so Docker can continue booting the app!
    }
    console.log("⏳ Waiting 5 seconds before retrying...");
    await new Promise(r => setTimeout(r, 5000));
  }
}

if (!modelReady) {
  console.warn("⏭️  Skipping Knowledge Base seeding.");
  process.exit(0);
}

// ── Step 2: chunk ─────────────────────────────────────────────────
const chunks = chunkText(policyText, CHUNK_SIZE, CHUNK_OVERLAP);
console.log(`✂️  Created ${chunks.length} chunks`);

// ── Step 3: create PgVector index ────────────────────────────────
const pgVector = new PgVector({
  id: "knowledge-seeder",
  connectionString: process.env.DATABASE_URL!,
});

console.log(
  `🗄️  Creating PgVector index "${INDEX_NAME}" (dim=${EMBEDDING_DIMENSION}, cosine)…`,
);
await pgVector.createIndex({
  indexName: INDEX_NAME,
  dimension: EMBEDDING_DIMENSION,
  metric: "cosine",
});
console.log("   ✅ Index ready");

// ── Step 4: embed + upsert ────────────────────────────────────────
const BATCH = 32;
let total = 0;

for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);

  const vectors: number[][] = [];
  for (const chunk of batch) {
    const result = await embed({ model: embedder, value: chunk.text });
    vectors.push(result.embedding as number[]);
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
