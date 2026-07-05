// src/mastra/config/embedder.ts
import { fastembed } from "@mastra/fastembed";

export const embedder = fastembed.small; // cacheDir handled by patchEnv.ts (HOME=/tmp)
export const EMBEDDING_DIMENSION = 384;