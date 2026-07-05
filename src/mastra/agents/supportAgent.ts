// src/mastra/agents/supportAgent.ts
import { Agent } from "@mastra/core/agent";
import { llmModel } from "../config/llm";
import { agentMemory } from "../memory/memory";
import { mcpClient } from "../mcp/mcpClient";

import { getOrderTool } from "../tools/getOrder";
import { getAllOrdersTool } from "../tools/getAllOrders";
import { getUserDataTool } from "../tools/getUserData";
import { processRefundTool } from "../tools/processRefund";
import { updateAddressTool } from "../tools/updateAddress";
import { createTicketTool } from "../tools/createTicket";
import { sendEmailTool } from "../tools/sendEmail";
import { bookAppointmentTool } from "../tools/bookAppointment";
import { searchWebTool } from "../tools/searchWeb";
import { browseUrlTool } from "../tools/browseUrl";
import { getOrdersByUserTool } from "../tools/getOrdersByUser";
import { searchKnowledgeTool } from "../tools/searchKnowledgeTool";
import { getProductTool } from "../tools/getProduct";
import {
  triggerHandleRefundTool,
  triggerEscalateTool,
  triggerScheduleReturnTool,
  triggerTrackOrderTool,
} from "../tools/workflowTools";

import { InputGuardrail } from "../guardrails/inputGuardrail";
import { ConversationTrustAnalyzer } from "../guardrails/conversationTrustAnalyzer";
import { MemorySanitizer } from "../guardrails/memorySanitizer";
import { OutputGuardrail } from "../guardrails/outputGuardrail";
import { SYSTEM_PROMPT } from "./systemPrompt";

const mcpTools = await mcpClient.listTools();
console.log("[Agent] MCP tools loaded:", Object.keys(mcpTools).length, "tools");

export const supportAgent = new Agent({
  id: "support-agent",
  name: "ShopEasy Support Agent",
  instructions: SYSTEM_PROMPT,
  model: llmModel,
  memory: agentMemory,
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