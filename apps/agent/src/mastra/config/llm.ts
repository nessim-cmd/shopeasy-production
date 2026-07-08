// src/mastra/config/llm.ts
import "dotenv/config";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import fs from "fs";

function buildLLMModel() {
  const provider = process.env.LLM_PROVIDER ?? "ollama";

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is missing in .env");
    }
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    const model =
      process.env.OPENROUTER_MODEL ?? "mistralai/mistral-7b-instruct:free";
    console.log(`🌐 LLM: OpenRouter → ${model}`);
    return openrouter(model);
  }

  // Ollama (local)
  let ollamaUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
  
  // Mastra overrides environment variables from .env, so we reliably detect Docker via /.dockerenv
  const isDocker = fs.existsSync("/.dockerenv");
  
  if (isDocker && ollamaUrl.includes("localhost")) {
    ollamaUrl = ollamaUrl.replace("localhost", "host.docker.internal");
  }
  const client = createOpenAI({
    baseURL: ollamaUrl,
    apiKey: "ollama",
  });
  const model = process.env.OLLAMA_MODEL ?? "qwen3:8b";
  console.log(`🖥️  LLM: Ollama → ${model}`);
  return client.chat(model);
}

export const llmModel = buildLLMModel();
