// src/mastra/config/embedder.ts
import { fastembed } from "@mastra/fastembed";
import { existsSync, rmSync } from "fs";
import path from "path";

export const EMBEDDING_DIMENSION = 384;

// ── Defensive cache cleanup ────────────────────────────────────────
// If a previous run left a partial/corrupted download behind (e.g. the
// process was killed mid-download, or the network hung), retrying to use
// it later crashes with a ZlibError/TAR_ABORT instead of just re-downloading.
// A missing tokenizer.json means the download never completed — wipe the
// whole cache dir in that case so the next load attempt starts clean.
const cacheDir = process.env.FASTEMBED_CACHE_DIR ?? "/tmp/fastembed-models";
const modelDir = path.join(cacheDir, "fast-bge-small-en-v1.5");
const tokenizer = path.join(modelDir, "tokenizer.json");

if (existsSync(modelDir) && !existsSync(tokenizer)) {
  console.warn("[embedder] Found incomplete/corrupted fastembed cache, cleaning up:", modelDir);
  try {
    rmSync(cacheDir, { recursive: true, force: true });
  } catch (err: any) {
    console.warn("[embedder] Failed to clean cache dir:", err.message);
  }
}

const realEmbedder = fastembed.small;

// ── Safety wrapper ──────────────────────────────────────────────────
// NOTE: this assumes realEmbedder exposes a `doEmbed({ values })` method
// (the standard ai-sdk EmbeddingModelV1 shape @mastra/fastembed implements).
// If your installed version's interface differs, check
// node_modules/@mastra/fastembed's types and adjust the method name below.
//
// Never let a failed/timed-out model load crash the whole agent process.
// On failure we log it and return zero-vectors instead — semantic recall /
// RAG will just silently return no useful matches rather than taking the
// whole app down.
export const embedder = {
  ...realEmbedder,
  async doEmbed(options: any) {
    try {
      return await realEmbedder.doEmbed(options);
    } catch (err: any) {
      console.error(
        "[embedder] Embedding failed — returning empty vectors so the app keeps running:",
        err?.message ?? err,
      );
      const count = Array.isArray(options?.values) ? options.values.length : 1;
      return {
        embeddings: Array.from({ length: count }, () =>
          new Array(EMBEDDING_DIMENSION).fill(0),
        ),
        // The ai SDK's internal logger unconditionally reads result.warnings.length
        // — omitting this crashes the whole process with a TypeError, which is
        // exactly what happened. Always include it, even empty.
        warnings: [],
      };
    }
  },
};