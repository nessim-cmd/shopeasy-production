// src/mastra/config/embedder.ts
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import type { EmbeddingModelId } from "@mastra/core/llm";

// gemini-embedding-001 natively outputs 3072 dims, but pgvector's index
// types (ivfflat/hnsw) cap out at 2000 dims — no index can be built above
// that. The model supports Matryoshka Representation Learning (MRL): the
// first N dimensions of the full output are themselves a valid embedding,
// so we truncate to 768 and re-normalize, rather than needing a native
// "smaller output" API option (which Mastra's router doesn't expose).
export const EMBEDDING_DIMENSION = 768;

const modelId: EmbeddingModelId = "google/gemini-embedding-001";
const realEmbedder = new ModelRouterEmbeddingModel(modelId);

function truncateAndNormalize(vector: number[], dims: number): number[] {
  const truncated = vector.slice(0, dims);
  const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return truncated;
  return truncated.map((v) => v / norm);
}

// ── Safety + truncation wrapper ──────────────────────────────────────
// 1. Truncates Google's 3072-dim output down to EMBEDDING_DIMENSION (MRL).
// 2. Never lets a failed/timed-out embedding call crash the whole agent
//    process — on failure, logs it and returns zero-vectors instead.
export const embedder = {
  ...realEmbedder,
  async doEmbed(options: any) {
    try {
      const result = await realEmbedder.doEmbed(options);
      return {
        ...result,
        embeddings: result.embeddings.map((e: number[]) =>
          truncateAndNormalize(e, EMBEDDING_DIMENSION),
        ),
      };
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
        warnings: [],
      };
    }
  },
};