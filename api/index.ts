// api/index.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { MastraServer } from "@mastra/hono";
import { mastra } from "../src/mastra/mastra";

export const config = { runtime: "nodejs" };

const app = new Hono();
const server = new MastraServer({ app, mastra });
await server.init();

export default handle(app);