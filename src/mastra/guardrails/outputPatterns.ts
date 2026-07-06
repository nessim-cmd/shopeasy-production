/**
 * src/mastra/guardrails/outputPatterns.ts
 *
 * Central registry of all security patterns used by the Output Guardrail.
 * Same philosophy as injectionPatterns.ts — keep patterns auditable in one
 * place, separate from the processing logic in outputGuardrail.ts.
 */

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface RedactPattern {
  id: string; // short unique name — useful in logs
  pattern: RegExp;
  note: string; // explains what this catches
  replacement: string; // what to substitute the match with
}

// ─── Sensitive financial data ────────────────────────────────────────────────
// These are redacted INLINE — the rest of the response is preserved.

export const REDACT_PATTERNS: RedactPattern[] = [
  {
    id: "credit_card_number",
    // 13-19 digits, optionally grouped by spaces or dashes (Visa/MC/Amex/Discover shapes)
    // Excludes matches preceded by "ORD-" (case-insensitive) so order IDs aren't
    // mistaken for card numbers.
    pattern: /\b(?<!ORD-)(?:\d[ -]?){13,19}\b/gi,
    note: "Credit card number — any 13-19 digit sequence, grouped or not (excludes ORD- prefixed order IDs)",
    replacement: "[REDACTED-CARD]",
  },
  {
    id: "cvv_labeled",
    // CVV/CVC/security code followed by 3-4 digits
    pattern: /\b(?:CVV|CVC|security\s*code)\s*[:\-]?\s*\d{3,4}\b/gi,
    note: "CVV/CVC code explicitly labeled",
    replacement: "[REDACTED-CVV]",
  },
  {
    id: "pin_labeled",
    // PIN followed by 4-6 digits
    pattern: /\bPIN\s*[:\-]?\s*\d{4,6}\b/gi,
    note: "PIN code explicitly labeled",
    replacement: "[REDACTED-PIN]",
  },
  {
    id: "account_balance_labeled",
    // "account balance" or "balance" followed by a currency amount — only redact
    // when paired with the word balance, to avoid nuking legitimate refund amounts
    pattern:
      /\b(?:account\s*)?balance\s*[:\-]?\s*[€$£]?\s*\d+(?:[.,]\d{2})?\b/gi,
    note: "Account balance figure",
    replacement: "[REDACTED-BALANCE]",
  },
];

// ─── Bulk data dump shape detection ──────────────────────────────────────────
// Not a redaction — a structural signal that the response looks like a
// multi-user data dump rather than a single customer answer.

export const BULK_DUMP_SIGNALS = {
  /** Matches a standard email address */
  emailPattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /** Matches phone-like sequences (7+ digits, optionally with separators) */
  phonePattern: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\d[\s.-]?){7,12}\b/g,
  /** If 3+ distinct emails appear in one response, treat as a bulk dump */
  emailThreshold: 3,
  /** If 3+ distinct phone-like sequences appear, treat as a bulk dump */
  phoneThreshold: 3,
};

// ─── System prompt leakage detection ─────────────────────────────────────────
// If any of these unique phrases from SYSTEM_PROMPT appear in the agent's
// final output, the entire response is blocked (not just redacted) — partial
// leakage of internal instructions is still a leak of internal logic.

export const SYSTEM_PROMPT_FINGERPRINTS: RedactPattern[] = [
  {
    id: "canary_token_leaked",
    pattern: /SHOPEASY-CANARY-X7K9-SECURE-2026/i,
    note: "Secret canary token leaked in response",
    replacement: "",
  },
  {
    id: "leak_decision_router",
    pattern: /DECISION\s+ROUTER/i,
    note: "System prompt section header leaked",
    replacement: "",
  },
  {
    id: "leak_knowledge_base_rules",
    pattern: /KNOWLEDGE\s+BASE\s+RULES/i,
    note: "System prompt section header leaked",
    replacement: "",
  },
  {
    id: "leak_general_rules",
    pattern: /GENERAL\s+RULES/i,
    note: "System prompt section header leaked",
    replacement: "",
  },
  {
    id: "leak_customer_intent_table",
    pattern: /CUSTOMER\s+INTENT\s*\|\s*ACTION/i,
    note: "System prompt routing table header leaked",
    replacement: "",
  },
  {
    id: "leak_shopeasy_goal_line",
    pattern:
      /your\s+goal\s+is\s+to\s+help\s+customers\s+as\s+effectively\s+as\s+possible/i,
    note: "System prompt opening line leaked",
    replacement: "",
  },
];
