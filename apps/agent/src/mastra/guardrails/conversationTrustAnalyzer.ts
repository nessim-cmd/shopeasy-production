/**
 * src/mastra/guardrails/conversationTrustAnalyzer.ts
 *
 * Layer 2 — Conversation Trust Analyzer
 * Mastra hook: inputProcessors[] on the Agent (placed AFTER InputGuardrail)
 * Runs: ONCE at the start of every generation.
 *
 * Purpose:
 *   Detects slow, multi-turn "Social Engineering" attacks using deterministic Regex.
 *   Maintains a stateless "trust score" computed on the fly by scanning the
 *   messages[] array of the current thread.
 */

import type { Processor } from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/memory";
import { getText, findInjection } from "./inputGuardrail.js";
import {
  ROLE_IMPERSONATION_PATTERNS,
  EXFILTRATION_PATTERNS,
  URGENCY_PATTERNS,
} from "./injectionPatterns.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const STARTING_TRUST = 100;
const ABORT_THRESHOLD = 30;

const BLOCK_MESSAGE =
  "I'm sorry, I can't process that request. How can I help you with your order or a ShopEasy policy question?";

// ─── Scoring Engine ───────────────────────────────────────────────────────────

interface ScoringResult {
  score: number;
  turns: number;
  penalties: number;
}

function calculateTrustScore(messages: MastraDBMessage[]): ScoringResult {
  let score = STARTING_TRUST;
  let userTurns = 0;
  let penaltiesApplied = 0;

  // 1. Scan only user and signal messages
  const userMessages = messages.filter(
    (m) => m.role === "user" || m.role === "signal",
  );

  for (let i = 0; i < userMessages.length; i++) {
    const msg = userMessages[i];
    const rawText = getText(msg);
    if (!rawText) continue;

    userTurns++;

    // 2. Direct injection pattern fallback (from L1)
    const injection = findInjection(rawText);
    if (injection) {
      console.warn(
        `[TrustAnalyzer]   Turn ${i + 1}: direct_injection (-100) — [${injection}]`,
      );
      score -= 100;
      penaltiesApplied++;
      continue;
    }

    // 3. Social Engineering Keyword Penalties
    let penalizedThisTurn = false;

    if (ROLE_IMPERSONATION_PATTERNS.some((r) => r.test(rawText))) {
      console.warn(
        `[TrustAnalyzer]   Turn ${i + 1}: role_impersonation (-35) — "${rawText}"`,
      );
      score -= 35;
      penalizedThisTurn = true;
    }

    if (EXFILTRATION_PATTERNS.some((r) => r.test(rawText))) {
      console.warn(
        `[TrustAnalyzer]   Turn ${i + 1}: data_exfiltration (-30) — "${rawText}"`,
      );
      score -= 30;
      penalizedThisTurn = true;
    }

    if (URGENCY_PATTERNS.some((r) => r.test(rawText))) {
      console.warn(
        `[TrustAnalyzer]   Turn ${i + 1}: urgency_pressure (-20) — "${rawText}"`,
      );
      score -= 20;
      penalizedThisTurn = true;
    }

    if (penalizedThisTurn) penaltiesApplied++;
  }

  // 4. Conversation Depth Penalty
  // Prevent attackers from trying to overflow the context window
  if (userTurns > 8) {
    const depthPenalty = (userTurns - 8) * 5;
    console.warn(
      `[TrustAnalyzer]   Depth penalty (-${depthPenalty}) — turns=${userTurns}`,
    );
    score -= depthPenalty;
    penaltiesApplied++;
  }

  return { score, turns: userTurns, penalties: penaltiesApplied };
}

// ─── Processor ────────────────────────────────────────────────────────────────

export class ConversationTrustAnalyzer implements Processor {
  readonly id = "conversation-trust-analyzer";
  readonly name = "Conversation Trust Analyzer";
  readonly description =
    "Computes a dynamic trust score across the conversation history.";

  processInput({
    messages,
    abort,
  }: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    retryCount: number;
  }): MastraDBMessage[] {
    console.log(
      "[TrustAnalyzer] ✅ processInput called, messages:",
      messages.length,
    );

    const result = calculateTrustScore(messages);

    console.log(
      `[TrustAnalyzer] Score: ${result.score}/100 | User turns: ${result.turns} | Penalties: ${result.penalties}`,
    );

    if (result.score < ABORT_THRESHOLD) {
      console.error(
        `[TrustAnalyzer] 🚨 ABORTING! Trust score fell below threshold (${result.score} < ${ABORT_THRESHOLD})`,
      );
      return abort(BLOCK_MESSAGE);
    }

    console.log("[TrustAnalyzer] ✅ Trust score OK");
    return messages;
  }
}
