// src/mastra/tools/searchWeb.ts
// Pas de DB — appel DuckDuckGo public API
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { sanitizeExternalContent } from "../guardrails/toolOutputSanitizer.js";

export const searchWebTool = createTool({
  id: "search-web",
  description: "Search the web using DuckDuckGo.",
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async (inputData) => {
    const { query } = inputData;
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
    );
    const data = (await res.json()) as any;
    const results = (data.RelatedTopics ?? [])
      .filter((t: any) => t.Text)
      .slice(0, 5)
      .map((t: any) => ({
        snippet: sanitizeExternalContent(t.Text),
        url: t.FirstURL,
      }));

    return {
      query,
      abstract: data.AbstractText
        ? sanitizeExternalContent(data.AbstractText)
        : undefined,
      results,
    };
  },
});
