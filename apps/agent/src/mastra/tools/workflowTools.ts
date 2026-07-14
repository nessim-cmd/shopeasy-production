// src/mastra/tools/workflowTools.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface WorkflowStep {
  output?: unknown;
  [key: string]: unknown;
}
interface WorkflowResult {
  steps?: Record<string, WorkflowStep>;
  [key: string]: unknown;
}
const getLastStepOutput = (r: WorkflowResult): unknown => {
  if (!r.steps) return r;
  const steps = Object.values(r.steps);
  if (!steps.length) return r;
  const last = steps[steps.length - 1];
  return last?.output !== undefined ? last.output : r;
};

// Lazy mastra loader — imported only at call time, never at module load time
const getMastra = async (): Promise<any> => {
  const mod = await import("../index.js") as any;
  return mod.mastra;
};

export const triggerHandleRefundTool = createTool({
  id: "trigger-handle-refund",
  description:
    "Full refund workflow: verifies order → processes refund → sends email → logs ticket.",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.string(),
    userId: z.string(),
    customerEmail: z.string().email().optional(),
  }),
  execute: async (inputData) => {
    const m = await getMastra();
    return getLastStepOutput(
      (await m.getWorkflow("handleRefundWorkflow").createRun().start({ inputData })) as WorkflowResult,
    );
  },
});

export const triggerEscalateTool = createTool({
  id: "trigger-escalate",
  description:
    "Escalate to a human agent: creates a high-priority ticket and notifies the customer.",
  inputSchema: z.object({
    userId: z.string(),
    subject: z.string(),
    description: z.string(),
    orderId: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerName: z.string().optional(),
  }),
  execute: async (inputData) => {
    const m = await getMastra();
    return getLastStepOutput(
      (await m.getWorkflow("escalateWorkflow").createRun().start({ inputData })) as WorkflowResult,
    );
  },
});

export const triggerScheduleReturnTool = createTool({
  id: "trigger-schedule-return",
  description:
    "Return pickup workflow: checks eligibility → books calendar slot → sends email → logs ticket.",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    preferredDate: z.string(),
    preferredTimeStart: z.string(),
    preferredTimeEnd: z.string(),
    customerEmail: z.string().email().optional(),
    customerName: z.string().optional(),
  }),
  execute: async (inputData) => {
    const m = await getMastra();
    return getLastStepOutput(
      (await m.getWorkflow("scheduleReturnWorkflow").createRun().start({ inputData })) as WorkflowResult,
    );
  },
});

export const triggerTrackOrderTool = createTool({
  id: "trigger-track-order",
  description:
    "Full order tracking: fetches order details and live carrier status.",
  inputSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
  }),
  execute: async (inputData) => {
    const m = await getMastra();
    return getLastStepOutput(
      (await m.getWorkflow("trackOrderWorkflow").createRun().start({ inputData })) as WorkflowResult,
    );
  },
});