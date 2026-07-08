/**
 * src/mastra/guardrails/outputGuardrail.ts
 *
 * Layer 7 — Output Guardrail
 * Mastra hook: outputProcessors[] on the Agent
 * Runs: processOutputStep — after EACH LLM step (catches tool-chain intermediate outputs too)
 *       processOutputResult — once on the FINAL response before it reaches the user
 *
 * Defends against:
 *   ATK-001 / ATK-007 / ATK-008   Sensitive data in the final response
 *   ATK-002                       System prompt verbatim leakage
 *   (generic safety net)          Bulk user data dumps, CC/CVV/PIN exposure
 *
 * Two-layer output protection (register in this order in supportAgent.ts):
 *   outputProcessors: [new PIIDetector({ strategy: 'redact' }), new OutputGuardrail()]
 *
 *   PIIDetector  — Mastra built-in, catches PII live in the stream at chunk level
 *   OutputGuardrail — your custom layer for business-specific rules (CVV, PIN, balance,
 *                     system prompt fingerprints, bulk dump detection)
 */

import type {
  Processor,
  ProcessOutputStepArgs,
  ProcessOutputResultArgs,
} from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/memory";
import {
  REDACT_PATTERNS,
  BULK_DUMP_SIGNALS,
  SYSTEM_PROMPT_FINGERPRINTS,
} from "./outputPatterns.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Shown to the user when a hard block fires (system prompt leak or bulk dump) */
const BLOCK_RESPONSE =
  "I'm sorry, I can't share that. How can I help you with your order or a ShopEasy policy question?";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract plain text from a MastraDBMessage.
 * Same three-case logic as inputGuardrail.ts — Mastra uses different shapes
 * depending on context (see inputGuardrail.ts comments for full explanation).
 */
function getText(msg: MastraDBMessage): string {
  let text = "";

  const hasParts =
    msg.content &&
    typeof msg.content === "object" &&
    !!(msg.content as any).parts;
  const hasNested =
    msg.content &&
    typeof msg.content === "object" &&
    typeof (msg.content as any).content === "string";

  if (hasParts) {
    for (const part of (msg.content as any).parts) {
      if (part.type === "text" && typeof part.text === "string") {
        text += part.text;
      }
    }
  } else if (hasNested) {
    text = (msg.content as any).content;
  } else if (typeof msg.content === "string") {
    text = msg.content as unknown as string;
  }

  return text;
}

/**
 * Write new text back into a MastraDBMessage, preserving its original shape.
 * We never change the shape — only the text value inside it.
 */
function setText(msg: MastraDBMessage, newText: string): MastraDBMessage {
  const hasParts =
    msg.content &&
    typeof msg.content === "object" &&
    !!(msg.content as any).parts;
  const hasNested =
    msg.content &&
    typeof msg.content === "object" &&
    typeof (msg.content as any).content === "string";

  if (hasParts) {
    const parts = (msg.content as any).parts.map((part: any) =>
      part.type === "text" ? { ...part, text: newText } : part,
    );
    return { ...msg, content: { ...(msg.content as any), parts } };
  }

  if (hasNested) {
    return { ...msg, content: { ...(msg.content as any), content: newText } };
  }

  return { ...msg, content: newText as any };
}

// ─── Core checks ─────────────────────────────────────────────────────────────

/**
 * Check 1: System prompt leakage (hard block — replace entire response).
 * If any fingerprint phrase from our system prompt appears in the output,
 * the whole response is replaced. Partial leakage of internal logic is still a leak.
 */
function findSystemPromptLeak(text: string): string | null {
  for (const entry of SYSTEM_PROMPT_FINGERPRINTS) {
    if (entry.pattern.test(text)) return entry.id;
    entry.pattern.lastIndex = 0; // reset in case pattern has /g flag
  }
  return null;
}

/**
 * Check 2: Sensitive field redaction (inline — rest of response preserved).
 * Scans for credit card numbers, CVV, PIN, account balance patterns
 * and replaces them with redaction placeholders.
 */
function redactSensitiveData(text: string): { text: string; hits: string[] } {
  let result = text;
  const hits: string[] = [];

  for (const entry of REDACT_PATTERNS) {
    if (entry.pattern.test(result)) {
      hits.push(entry.id);
      result = result.replace(entry.pattern, entry.replacement);
    }
    entry.pattern.lastIndex = 0; // always reset global-flag patterns after use
  }

  return { text: result, hits };
}

/**
 * Check 3: Bulk dump shape detection (hard block).
 * If the response contains 3+ distinct emails OR 3+ phone-like sequences,
 * it looks like a multi-user data dump — block the entire response.
 * This catches the case where the LLM lists all users even without card numbers.
 */
function detectBulkDump(text: string): boolean {
  const emails = new Set(text.match(BULK_DUMP_SIGNALS.emailPattern) ?? []);
  const phones = new Set(text.match(BULK_DUMP_SIGNALS.phonePattern) ?? []);
  BULK_DUMP_SIGNALS.emailPattern.lastIndex = 0;
  BULK_DUMP_SIGNALS.phonePattern.lastIndex = 0;
  return (
    emails.size >= BULK_DUMP_SIGNALS.emailThreshold ||
    phones.size >= BULK_DUMP_SIGNALS.phoneThreshold
  );
}

// ─── Shared scan logic ────────────────────────────────────────────────────────

/**
 * Run all three checks against one message array.
 * Returns the mutated array (or the original if nothing changed).
 * Extracted so both processOutputStep and processOutputResult can share it.
 */
function scanMessages(messages: MastraDBMessage[]): MastraDBMessage[] {
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (!lastAssistantMsg) return messages;

  const text = getText(lastAssistantMsg);
  if (!text) return messages;

  // ── Check 1: system prompt leak (hard block) ──────────────────────────────
  const leakId = findSystemPromptLeak(text);
  if (leakId) {
    console.warn(
      `[OutputGuardrail] HARD BLOCK — system prompt leak pattern=${leakId}`,
    );
    const blocked = setText(lastAssistantMsg, BLOCK_RESPONSE);
    return messages.map((m) => (m === lastAssistantMsg ? blocked : m));
  }

  // ── Check 2: sensitive field redaction ────────────────────────────────────
  const { text: redacted, hits } = redactSensitiveData(text);

  // ── Check 3: bulk dump detection (hard block) ─────────────────────────────
  if (detectBulkDump(redacted)) {
    console.warn("[OutputGuardrail] HARD BLOCK — bulk dump shape detected");
    const blocked = setText(lastAssistantMsg, BLOCK_RESPONSE);
    return messages.map((m) => (m === lastAssistantMsg ? blocked : m));
  }

  // Apply redactions if any patterns matched
  if (hits.length > 0) {
    console.warn(`[OutputGuardrail] REDACTED patterns=${hits.join(", ")}`);
    const cleaned = setText(lastAssistantMsg, redacted);
    return messages.map((m) => (m === lastAssistantMsg ? cleaned : m));
  }

  return messages;
}

// ─── Processor ────────────────────────────────────────────────────────────────

export class OutputGuardrail implements Processor {
  readonly id = "output-guardrail";
  readonly name = "Output Guardrail";
  readonly description =
    "Redacts sensitive financial data and blocks system prompt leakage in agent responses";

  /**
   * processOutputStep: runs after EACH LLM step, before tool execution.
   * Catches sensitive data in intermediate steps of a multi-step tool chain.
   * Example: if step 2 of 5 returns user credit card data, this blocks it
   * before it becomes context for steps 3-5.
   */
  processOutputStep({ messages }: ProcessOutputStepArgs): MastraDBMessage[] {
    console.log(
      "[OutputGuardrail] processOutputStep called, messages:",
      messages.length,
    );
    return scanMessages(messages);
  }

  /**
   * processOutputResult: runs ONCE after the full agentic loop completes.
   * This is the final gate before the response reaches the user.
   * Even if processOutputStep missed something, this catches it.
   */
  processOutputResult({
    messages,
  }: ProcessOutputResultArgs): MastraDBMessage[] {
    console.log(
      "[OutputGuardrail] processOutputResult called, messages:",
      messages.length,
    );
    return scanMessages(messages);
  }
}
