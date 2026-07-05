import "./config/patchEnv.js";
import "dotenv/config";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { registerApiRoute } from "@mastra/core/server";
import { readFileSync } from "fs";
import path from "path";
import { VercelDeployer } from "@mastra/deployer-vercel";
import { PostgresStore } from "@mastra/pg";

import { PROJECT_ROOT } from "./config/root.js";
import { getBusinessDB } from "./data/db.js";
import { supportAgent } from "./agents/supportAgent.js";
import { dailyReportWorkflow } from "./workflows/dailyReportWorkflow.js";
import { handleRefundWorkflow } from "./workflows/handleRefundWorkflow.js";
import { escalateWorkflow } from "./workflows/escalateWorkflow.js";
import { scheduleReturnWorkflow } from "./workflows/scheduleReturnWorkflow.js";
import { trackOrderWorkflow } from "./workflows/trackOrderWorkflow.js";
import { apiKeyMiddleware } from "./middleware.js";

const customLogger = new PinoLogger({
  name: "ShopEasyAgent",
  level: "debug",
});

export const mastra = new Mastra({
  agents: { supportAgent },
  workflows: {
    dailyReportWorkflow,
    handleRefundWorkflow,
    escalateWorkflow,
    scheduleReturnWorkflow,
    trackOrderWorkflow,
  },
  storage: new PostgresStore({
    id: "shopeasy-pg-storage",
    connectionString: process.env.DATABASE_URL,
  }),
  logger: customLogger,
  deployer: new VercelDeployer(),
  server: {
    apiEndpoint: "/api",
    middleware: [
      {
        handler: apiKeyMiddleware,
        path: "/api/*",
      },
    ],
    apiRoutes: [
      registerApiRoute("/", {
        method: "GET",
        handler: async (c) => {
          try {
            const html = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/index.html"), "utf-8");
            return c.html(html);
          } catch (err: any) {
            return c.text("Error loading index.html: " + err.message, 500);
          }
        },
      }),
      registerApiRoute("/products", {
        method: "GET",
        handler: async (c) => {
          try {
            const html = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/products.html"), "utf-8");
            return c.html(html);
          } catch (err: any) {
            return c.text("Error loading products.html: " + err.message, 500);
          }
        },
      }),
      registerApiRoute("/custom/products", {
        method: "GET",
        handler: async (c) => {
          try {
            const db = getBusinessDB();
            const rows = await db.query("SELECT * FROM products");
            return c.json(rows);
          } catch (err: any) {
            return c.json({ error: err.message }, 500);
          }
        },
      }),
      registerApiRoute("/images/shopeasy-logo.jpg", {
        method: "GET",
        handler: async (c) => {
          try {
            const imagePath = path.join(PROJECT_ROOT, "src/mastra/public/shopeasy-logo.jpg");
            const buffer = readFileSync(imagePath);
            return c.body(buffer, 200, {
              "Content-Type": "image/jpeg",
            });
          } catch (err: any) {
            return c.text("Error loading logo: " + err.message, 404);
          }
        },
      }),
      registerApiRoute("/widget.js", {
        method: "GET",
        handler: async (c) => {
          try {
            const js = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/widget.js"), "utf-8");
            return c.body(js, 200, {
              "Content-Type": "application/javascript",
            });
          } catch (err: any) {
            return c.text("Error loading widget.js: " + err.message, 404);
          }
        },
      }),
      registerApiRoute("/widget.css", {
        method: "GET",
        handler: async (c) => {
          try {
            const css = readFileSync(path.join(PROJECT_ROOT, "src/mastra/public/widget.css"), "utf-8");
            return c.body(css, 200, {
              "Content-Type": "text/css",
            });
          } catch (err: any) {
            return c.text("Error loading widget.css: " + err.message, 404);
          }
        },
      }),
    ],
  },
});