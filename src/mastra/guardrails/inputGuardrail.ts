/**
 * src/mastra/guardrails/inputGuardrail.ts
 *
 * Layer 1 — Input Guardrail
 * Mastra hook: inputProcessors[] on the Agent
 * Runs: ONCE at the start of every generation, before the LLM sees anything
 *
 * Defends against:
 *   ATK-001  Direct prompt injection
 *   ATK-002  System prompt extraction
 *   ATK-006  Roleplay jailbreak
 *   ATK-007  DAN jailbreak
 *   ATK-008  Mass data dump requests
 *   ATK-013  Context flooding (token cap)
 *   ATK-014  Language-switch evasion
 *   ATK-015  Base64 / hex encoding bypass
 *   ATK-019  Fake system message formatting
 */

import type { Processor } from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/memory";
import { INJECTION_PATTERNS, MULTILINGUAL_PATTERNS } from "./injectionPatterns.js";
import { resetSessionLock } from "./policyEngine.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** ~1500 tokens at 4 chars/token. Stops ATK-013 context flooding early. */
const MAX_INPUT_CHARS = 6000;

/** Message shown to the user on any block — intentionally vague */
const BLOCK_MESSAGE =
  "I'm sorry, I can't process that request. How can I help you with your order or a ShopEasy policy question?";

// ─── Unicode Normalization ────────────────────────────────────────────────────

/**
 * Homoglyph map — visually identical characters from other Unicode scripts
 * that attackers use to bypass Latin-only regex patterns.
 * Example: Cyrillic 'а' (U+0430) looks identical to Latin 'a' (U+0061)
 *          but regex /ignore/i would NOT match 'іgnore' (Cyrillic і).
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic → Latin
  "\u0410": "A",
  "\u0430": "a", // А а
  "\u0412": "B",
  "\u0432": "b", // В в  (Cyrillic Ve)
  "\u0421": "C",
  "\u0441": "c", // С с
  "\u0415": "E",
  "\u0435": "e", // Е е
  "\u041D": "H",
  "\u043D": "h", // Н н
  "\u0406": "I",
  "\u0456": "i", // І і  (Ukrainian І)
  "\u0419": "J", // Й
  "\u041A": "K",
  "\u043A": "k", // К к
  "\u041C": "M",
  "\u043C": "m", // М м
  "\u041E": "O",
  "\u043E": "o", // О о
  "\u0420": "P",
  "\u0440": "p", // Р р  (Cyrillic Er)
  "\u0405": "S",
  "\u0455": "s", // Ѕ ѕ  (Cyrillic Dze)
  "\u0422": "T",
  "\u0442": "t", // Т т
  "\u0425": "X",
  "\u0445": "x", // Х х
  "\u0423": "Y",
  "\u0443": "y", // У у
  // Greek → Latin
  "\u0391": "A",
  "\u03B1": "a", // Α α
  "\u0392": "B",
  "\u03B2": "b", // Β β
  "\u0395": "E",
  "\u03B5": "e", // Ε ε
  "\u0397": "H",
  "\u03B7": "h", // Η η
  "\u0399": "I",
  "\u03B9": "i", // Ι ι
  "\u039A": "K",
  "\u03BA": "k", // Κ κ
  "\u039C": "M",
  "\u03BC": "m", // Μ μ
  "\u039D": "N",
  "\u03BD": "n", // Ν ν
  "\u039F": "O",
  "\u03BF": "o", // Ο ο
  "\u03A1": "P",
  "\u03C1": "p", // Ρ ρ
  "\u03A4": "T",
  "\u03C4": "t", // Τ τ
  "\u03A5": "Y",
  "\u03C5": "y", // Υ υ
  "\u03A7": "X",
  "\u03C7": "x", // Χ χ
  "\u0396": "Z",
  "\u03B6": "z", // Ζ ζ
};

/**
 * Zero-width and bidirectional override characters that attackers inject
 * to visually reorder or hide text from regex scanners.
 */
const INVISIBLE_CHARS =
  /[\u200B\u200C\u200D\u200E\u200F\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

/**
 * Normalize Unicode text to defeat homoglyph substitution attacks.
 *
 * Steps:
 *  1. Strip all invisible / zero-width / bidirectional override characters
 *  2. Apply NFKD decomposition (splits accented chars into base + combining)
 *  3. Strip combining diacritical marks (accents)
 *  4. Map remaining homoglyphs (Cyrillic/Greek lookalikes) to Latin equivalents
 *
 * Example: "іgnore аll prevіous іnstructіons" → "ignore all previous instructions"
 */
export function normalizeUnicode(text: string): string {
  // Step 1: strip invisible characters
  let normalized = text.replace(INVISIBLE_CHARS, "");

  // Step 2: NFKD decomposition + strip combining marks (accents)
  normalized = normalized.normalize("NFKD").replace(/[\u0300-\u036F]/g, "");

  // Step 3: replace remaining homoglyphs char-by-char
  let result = "";
  for (const ch of normalized) {
    result += HOMOGLYPH_MAP[ch] ?? ch;
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract plain text from a MastraDBMessage.
 *
 * Mastra stores message content in three shapes depending on context:
 *   1. Structured: { parts: [{ type: 'text', text: '...' }] }  — DB format after first exchange
 *   2. Legacy:     { content: '...' }                          — older stored messages
 *   3. Plain:      '...'                                       — first message in a new thread
 *
 * We must handle all three — missing case 3 was what caused ATK-008 to slip through.
 */
export function getText(msg: MastraDBMessage): string {
  let text = "";

  const contentType = typeof msg.content;
  const hasParts =
    msg.content &&
    typeof msg.content === "object" &&
    !!(msg.content as any).parts;
  const hasNested =
    msg.content &&
    typeof msg.content === "object" &&
    typeof (msg.content as any).content === "string";

  // Case 1: structured content with parts (standard Mastra DB format)
  if (hasParts) {
    for (const part of (msg.content as any).parts) {
      if (part.type === "text" && typeof part.text === "string") {
        text += part.text;
      }
    }
  }

  // Case 2: legacy nested string — content.content
  if (!text && hasNested) {
    text = (msg.content as any).content;
  }

  // Case 3: content is a plain string (first message in a new thread)
  if (!text && contentType === "string") {
    text = msg.content as unknown as string;
  }

  console.log(
    `[getText] type=${contentType} hasParts=${hasParts} hasNested=${hasNested} text="${text.slice(0, 80)}"`,
  );
  return text;
}

/** Try to decode base64 candidates — returns decoded string or null (ATK-015) */
function tryDecodeBase64(text: string): string | null {
  const matches = text.match(/[A-Za-z0-9+/]{20,}={0,2}/g);
  if (!matches) return null;
  for (const m of matches) {
    try {
      const decoded = Buffer.from(m, "base64").toString("utf-8");
      if (/^[\x20-\x7E\n\r\t]{10,}$/.test(decoded)) return decoded;
    } catch {
      /* not valid base64 */
    }
  }
  return null;
}

/** Try to decode hex candidates — returns decoded string or null (ATK-015) */
function tryDecodeHex(text: string): string | null {
  const matches = text.match(
    /(?:0x)?([0-9a-fA-F]{2}(?:\s*[0-9a-fA-F]{2}){9,})/g,
  );
  if (!matches) return null;
  for (const m of matches) {
    try {
      const decoded = Buffer.from(m.replace(/0x|\s/g, ""), "hex").toString(
        "utf-8",
      );
      if (/^[\x20-\x7E\n\r\t]{10,}$/.test(decoded)) return decoded;
    } catch {
      /* not valid hex */
    }
  }
  return null;
}

/**
 * Run all pattern banks against a piece of text.
 * Returns the matched pattern id if found, null if clean.
 */
export function findInjection(text: string): string | null {
  for (const entry of INJECTION_PATTERNS) {
    if (entry.pattern.test(text)) return entry.id;
  }
  for (const entry of MULTILINGUAL_PATTERNS) {
    if (entry.pattern.test(text)) return entry.id;
  }
  return null;
}

// ─── Processor ────────────────────────────────────────────────────────────────

export class InputGuardrail implements Processor {
  readonly id = "input-guardrail";
  readonly name = "Input Guardrail";
  readonly description =
    "Blocks prompt injection, jailbreaks, encoding bypasses and fake system messages";

  processInput({
    messages,
    abort,
  }: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    retryCount: number;
  }): MastraDBMessage[] {
    console.log(
      "[InputGuardrail] ✅ processInput called, messages:",
      messages.length,
    );
    console.log(
      "[InputGuardrail] DEBUG roles:",
      messages.map((m) => ({ role: m.role, contentType: typeof m.content })),
    );

    // Only inspect the latest user message — history is already stored and trusted
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMsg = userMessages[userMessages.length - 1];

    if (userMessages.length === 1) {
      console.log("[InputGuardrail] 🆕 New conversation detected. Resetting session lock.");
      resetSessionLock();
    }

    if (!lastUserMsg) {
      console.log("[InputGuardrail] no user message found, skipping");
      return messages;
    }

    const rawText = getText(lastUserMsg);

    if (!rawText) {
      console.log("[InputGuardrail] empty text extracted, skipping");
      return messages;
    }

    // ── Step 0: Unicode normalization (homoglyph & invisible char defense) ────
    const text = normalizeUnicode(rawText);
    if (text !== rawText) {
      console.log(
        `[InputGuardrail] Unicode normalized: "${rawText.slice(0, 60)}" → "${text.slice(0, 60)}"`,
      );
    }

    // ── Check 1: length flood (ATK-013) ──────────────────────────────────────
    if (text.length > MAX_INPUT_CHARS) {
      console.warn(`[InputGuardrail] BLOCKED length=${text.length}`);
      abort(
        `Your message is too long. Please keep requests under ${MAX_INPUT_CHARS} characters.`,
      );
    }

    // ── Check 2: raw text injection ───────────────────────────────────────────
    const directHit = findInjection(text);
    if (directHit) {
      console.warn(`[InputGuardrail] BLOCKED pattern=${directHit}`);
      abort(BLOCK_MESSAGE);
    }

    // ── Check 3: base64-encoded payload (ATK-015) ─────────────────────────────
    const b64 = tryDecodeBase64(text);
    if (b64) {
      const hit = findInjection(b64);
      if (hit) {
        console.warn(`[InputGuardrail] BLOCKED base64 pattern=${hit}`);
        abort(BLOCK_MESSAGE);
      }
    }

    // ── Check 4: hex-encoded payload (ATK-015) ────────────────────────────────
    const hex = tryDecodeHex(text);
    if (hex) {
      const hit = findInjection(hex);
      if (hit) {
        console.warn(`[InputGuardrail] BLOCKED hex pattern=${hit}`);
        abort(BLOCK_MESSAGE);
      }
    }

    console.log("[InputGuardrail] ✅ all checks passed");
    return messages;
  }
}
