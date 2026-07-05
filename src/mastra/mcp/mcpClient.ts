// src/mastra/mcp/mcpClient.ts
import { MCPClient } from "@mastra/mcp";
import { PROJECT_ROOT } from "../config/root";

console.log("[MCP] Project root:", PROJECT_ROOT);

export const mcpClient = new MCPClient({
  id: "shop-mcp-client",
  servers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", PROJECT_ROOT],
      env: { PROJECT_ROOT },
    },
  },
  timeout: 30000,
});

const mcpToolList = await mcpClient.listTools();
console.log(
  `[MCP] ✅ Tools: ${Object.keys(mcpToolList).length}`,
  Object.keys(mcpToolList),
);
