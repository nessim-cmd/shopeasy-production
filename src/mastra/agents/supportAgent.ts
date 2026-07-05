// src/mastra/agents/supportAgent.ts
import { Agent } from "@mastra/core/agent";
import { llmModel } from "../config/llm.js";
// import { agentMemory } from "../memory/memory.js"; // TEMPORARILY DISABLED to isolate crash
import { mcpClient } from "../mcp/mcpClient.js";
import { getOrderTool } from "../tools/getOrder.js";
import { getAllOrdersTool } from "../tools/getAllOrders.js";
import { getUserDataTool } from "../tools/getUserData.js";
import { processRefundTool } from "../tools/processRefund.js";
import { updateAddressTool } from "../tools/updateAddress.js";
import { createTicketTool } from "../tools/createTicket.js";
import { sendEmailTool } from "../tools/sendEmail.js";
import { bookAppointmentTool } from "../tools/bookAppointment.js";
import { searchWebTool } from "../tools/searchWeb.js";
import { browseUrlTool } from "../tools/browseUrl.js";
import { getOrdersByUserTool } from "../tools/getOrdersByUser.js";
import { searchKnowledgeTool } from "../tools/searchKnowledgeTool.js";
import { getProductTool } from "../tools/getProduct.js";
import {
  triggerHandleRefundTool,
  triggerEscalateTool,
  triggerScheduleReturnTool,
  triggerTrackOrderTool,
} from "../tools/workflowTools.js";
import { InputGuardrail } from "../guardrails/inputGuardrail.js";
import { ConversationTrustAnalyzer } from "../guardrails/conversationTrustAnalyzer.js";
import { MemorySanitizer } from "../guardrails/memorySanitizer.js";
import { OutputGuardrail } from "../guardrails/outputGuardrail.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";

const mcpTools = await mcpClient.listTools();
console.log("[Agent] MCP tools loaded:", Object.keys(mcpTools).length, "tools");

export const supportAgent = new Agent({
  id: "support-agent",
  name: "ShopEasy Support Agent",
  instructions: SYSTEM_PROMPT,
  model: llmModel,
  // memory: agentMemory, // TEMPORARILY DISABLED to isolate crash
  defaultOptions: { maxSteps: 15 },
  inputProcessors: [
    new InputGuardrail(),
    new ConversationTrustAnalyzer(),
    new MemorySanitizer(),
  ],
  outputProcessors: [new OutputGuardrail()],
  tools: {
    getOrderTool,
    getAllOrdersTool,
    getUserDataTool,
    getOrdersByUserTool,
    processRefundTool,
    updateAddressTool,
    createTicketTool,
    sendEmailTool,
    bookAppointmentTool,
    searchWebTool,
    browseUrlTool,
    searchKnowledgeTool,
    getProductTool,
    triggerHandleRefundTool,
    triggerEscalateTool,
    triggerScheduleReturnTool,
    triggerTrackOrderTool,
  },
});