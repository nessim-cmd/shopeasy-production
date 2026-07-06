// scripts/downloadEmbedModel.ts
// Runs ONLY during `docker build`, never at container runtime.
// Downloads the embedding model once and bakes it into the image layer,
// so containers never need network access for it at startup.
import { FlagEmbedding, EmbeddingModel } from "@mastra/fastembed";

const cacheDir = process.env.FASTEMBED_CACHE_DIR ?? "/opt/fastembed-cache";

console.log(`⬇️  [build] Downloading bge-small-en-v1.5 into ${cacheDir} ...`);

try {
  await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallENV15,
    cacheDir,
    showDownloadProgress: true,
  });
  console.log("✅ [build] Model downloaded and cached successfully.");
} catch (err: any) {
  console.error("❌ [build] Failed to download embedding model:", err?.message ?? err);
  // Fail the build loudly if this doesn't work — better to know now than
  // discover an empty RAG silently later. Remove `process.exit(1)` if you'd
  // rather let the build continue without the model.
  process.exit(1);
}