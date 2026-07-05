import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { chromium, Browser, Page } from "playwright";
import { sanitizeExternalContent } from "../guardrails/toolOutputSanitizer";

// ── Shared logic — used by tool AND workflow steps ────────────────
export async function browseUrlLogic(params: {
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeout?: number;
  screenshot?: boolean;
  executeJs?: string | null;
  viewport?: { width: number; height: number };
  userAgent?: string;
  headers?: Record<string, string>;
  maxContentLength?: number;
}) {
  const {
    url,
    waitUntil = "networkidle",
    timeout = 30000,
    screenshot = false,
    executeJs = null,
    viewport = { width: 1280, height: 720 },
    userAgent,
    headers,
    maxContentLength = 5000,
  } = params;

  console.log("=== BROWSE START ===", url);
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport,
      userAgent,
      extraHTTPHeaders: headers,
    });
    const page: Page = await context.newPage();

    await page.goto(url, { waitUntil, timeout });

    const title = await page.title();
    const currentUrl = page.url();

    let jsResult = null;
    if (executeJs) {
      try {
        jsResult = await page.evaluate(executeJs);
      } catch (jsError: any) {
        jsResult = { error: jsError.message };
      }
    }

    let content = await page.evaluate(() => document.body.innerText);
    content = content.slice(0, maxContentLength);

    let screenshotBase64 = null;
    if (screenshot) {
      const buf = await page.screenshot({ fullPage: true });
      screenshotBase64 = buf.toString("base64");
    }

    const metadata = await page.evaluate(() => ({
      description: document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
      keywords: document
        .querySelector('meta[name="keywords"]')
        ?.getAttribute("content"),
      canonical: document
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href"),
      language: document.documentElement.lang,
      linksCount: document.querySelectorAll("a").length,
      imagesCount: document.querySelectorAll("img").length,
    }));

    return {
      url: currentUrl,
      title,
      content: sanitizeExternalContent(content),
      metadata,
      jsResult,
      screenshotBase64: screenshotBase64
        ? screenshotBase64.slice(0, 100) + "..."
        : null,
    };
  } catch (err: any) {
    console.error("=== BROWSE ERROR ===", err);
    return {
      url,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    };
  } finally {
    if (browser) await browser.close();
  }
}

export const browseUrlTool = createTool({
  id: "browse-url",
  description: "Browse a URL using a real browser with enhanced capabilities.",
  inputSchema: z.object({
    url: z.string().url(),
    waitUntil: z
      .enum(["load", "domcontentloaded", "networkidle"])
      .optional()
      .default("networkidle"),
    timeout: z.number().optional().default(30000),
    screenshot: z.boolean().optional().default(false),
    executeJs: z
      .string()
      .optional()
      .nullable()
      .describe("Optional JavaScript to execute on the page"),
    viewport: z
      .object({ width: z.number(), height: z.number() })
      .optional()
      .default({ width: 1280, height: 720 }),
    userAgent: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    maxContentLength: z.number().optional().default(5000),
  }),
  execute: async (inputData) => {
    return browseUrlLogic(inputData);
  },
});
