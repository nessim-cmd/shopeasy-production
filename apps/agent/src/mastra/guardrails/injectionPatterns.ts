/**
 * src/mastra/guardrails/injectionPatterns.ts
 *
 * Central registry of all security patterns used by the Input Guardrail.
 * Keeping them here means:
 *  - inputGuardrail.ts stays short and readable
 *  - Your supervisor / security team can audit, add, or remove
 *    patterns in one place without touching any logic
 *  - Every future guardrail layer can import from here too
 */

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface PatternEntry {
  id: string; // short unique name — useful in logs
  pattern: RegExp;
  note: string; // explains what attack this targets
}

// ─── Hard-block patterns ──────────────────────────────────────────────────────
// These trigger an immediate abort regardless of context.

export const INJECTION_PATTERNS: PatternEntry[] = [
  // ATK-001 / ATK-006 / ATK-007 — classic override openers & personas
  {
    id: "override_ignore",
    pattern: /ignore\s+(all\s+)?(previous|prior|above|your)\s+instructions/i,
    note: 'Classic "ignore previous instructions" injection opener',
  },
  {
    id: "override_disregard",
    pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+instructions/i,
    note: "Variant with disregard",
  },
  {
    id: "override_forget",
    pattern: /forget\s+(all\s+)?(previous|prior|above|your)\s+instructions/i,
    note: "Variant with forget",
  },
  {
    id: "persona_unrestricted",
    pattern:
      /you\s+are\s+now\s+(an?\s+)?(unrestricted|unfiltered|uncensored|different)/i,
    note: 'Persona override — "you are now unrestricted"',
  },
  {
    id: "dan_jailbreak",
    pattern: /\bDAN\b.*do\s+anything\s+now/i,
    note: "ATK-007 DAN jailbreak pattern",
  },
  {
    id: "act_as_jailbreak",
    pattern: /act\s+as\s+(DAN|OmegaBot|unrestricted|EvilAI|jailbreak)/i,
    note: "ATK-006/007 roleplay persona jailbreak",
  },
  {
    id: "pretend_no_rules",
    pattern:
      /pretend\s+(you\s+(have\s+no|are\s+without)\s+(rules|restrictions|limits))/i,
    note: "Fictional framing to bypass rules",
  },
  {
    id: "no_rules_claim",
    pattern: /you\s+have\s+(no\s+rules|broken\s+free|no\s+restrictions)/i,
    note: "Direct claim that the model has no restrictions",
  },

  // ATK-002 — system prompt extraction
  {
    id: "prompt_extraction_verbatim",
    pattern:
      /repeat\s+(your\s+)?(full\s+)?(system\s+prompt|instructions)\s+(verbatim|word\s+for\s+word)/i,
    note: "ATK-002 asks the model to repeat its system prompt",
  },
  {
    id: "prompt_extraction_output",
    pattern: /output\s+your\s+(initial|original|full)\s+(prompt|instructions)/i,
    note: "ATK-002 variant asking to output instructions",
  },

  // ATK-019 — fake system / admin message formatting
  {
    id: "fake_system_tag",
    pattern:
      /\[SYSTEM\]\s*:?\s*(internal\s+notification|override|maintenance|admin)/i,
    note: "ATK-019 impersonating a system notification",
  },
  {
    id: "system_override_header",
    pattern: /SYSTEM\s+OVERRIDE\s*:/i,
    note: "ATK-019 fake SYSTEM OVERRIDE header",
  },
  {
    id: "security_suspended",
    pattern: /security\s+protocols?\s+suspended/i,
    note: "ATK-019 claim that security is suspended",
  },
  {
    id: "admin_mode",
    pattern: /unrestricted\s+admin\s+mode/i,
    note: "ATK-019 claim of unrestricted admin mode",
  },

  // ATK-008 — mass data exfiltration requests
  {
    id: "mass_user_dump",
    pattern:
      /list\s+all\s+users?\s+(including|with)\s+(their\s+)?(email|phone|credit\s+card|payment|pin)/i,
    note: "ATK-008 request to dump all user data",
  },
  {
    id: "export_all_records",
    pattern: /export\s+all\s+(user\s+)?records?\s+including\s+payment/i,
    note: "ATK-008 request to export all payment records",
  },
  {
    id: "complete_customer_list",
    pattern: /complete\s+list\s+of\s+all\s+(users?|customers?)\s+including/i,
    note: "ATK-008 request for complete customer list",
  },
];

// ─── Multilingual injection patterns ─────────────────────────────────────────
// ATK-014 — same attacks written in other languages

export const MULTILINGUAL_PATTERNS: PatternEntry[] = [
  // French
  {
    id: "fr_ignore",
    pattern: /ignore\s+tes\s+instructions/i,
    note: "ATK-014 French — ignore your instructions",
  },
  {
    id: "fr_no_restriction",
    pattern:
      /tu\s+es\s+maintenant\s+un\s+assistant\s+sans\s+(aucune\s+)?restriction/i,
    note: "ATK-014 French — you are now an unrestricted assistant",
  },
  {
    id: "fr_give_data",
    pattern: /donne[- ]moi\s+(toutes\s+)?les\s+donn[eé]es/i,
    note: "ATK-014 French — give me all the data",
  },
  // Arabic
  {
    id: "ar_ignore",
    pattern: /تجاهل\s+.{0,30}\s+التعليمات/,
    note: "ATK-014 Arabic — ignore the instructions",
  },
  {
    id: "ar_no_restriction",
    pattern: /أنت\s+الآن\s+مساعد\s+بدون\s+قيود/,
    note: "ATK-014 Arabic — you are now an unrestricted assistant",
  },
  {
    id: "ar_give_data",
    pattern: /أعطني\s+بيانات/,
    note: "ATK-014 Arabic — give me data",
  },
  // Spanish
  {
    id: "es_ignore",
    pattern: /ignora\s+(todas\s+)?tus\s+instrucciones/i,
    note: "ATK-014 Spanish — ignore your instructions",
  },
  {
    id: "es_no_restriction",
    pattern: /ahora\s+eres\s+un\s+asistente\s+sin\s+restricciones/i,
    note: "ATK-014 Spanish — you are now an unrestricted assistant",
  },
  // German
  {
    id: "de_ignore",
    pattern: /ignoriere\s+(alle\s+)?deine\s+Anweisungen/i,
    note: "ATK-014 German — ignore your instructions",
  },
];

// ─── Social Engineering Signal Patterns (Used by Layer 2) ─────────────────────

/**
 * Role impersonation — user claims to hold a privileged position.
 * These are spread across turns in social engineering attacks to build
 * false authority before requesting sensitive data or actions.
 */
export const ROLE_IMPERSONATION_PATTERNS: RegExp[] = [
  /\b(?:i\s+am|i'm|this\s+is)\s+(?:an?\s+|the\s+)?(?:\w+\s+){0,2}?(?:manager|admin|administrator|ceo|cto|cfo|director|supervisor|owner|founder|head\s+of|chief|vp|vice\s+president|president)\b/i,
  /\b(?:i\s+am|i'm|this\s+is)\s+(?:an?\s+|the\s+)?(?:\w+\s+){0,2}?(?:developer|engineer|devops|sysadmin|system\s+admin|it\s+support|it\s+admin|security\s+team|security\s+officer)\b/i,
  /\b(?:i\s+am|i'm|this\s+is)\s+(?:an?\s+|the\s+)?(?:\w+\s+){0,2}?(?:hr|human\s+resources|finance|accounting|legal|compliance|audit)\b/i,
  /\b(?:i\s+work\s+(?:in|at|for)\s+(?:the\s+)?(?:\w+\s+){0,2}?(?:it|security|finance|hr|admin|management|headquarters|head\s+office))\b/i,
  /\b(?:i\s+have\s+(?:admin|root|elevated|special|internal|management|staff)\s+(?:access|privileges?|rights?|permissions?|clearance))\b/i,
  /\b(?:i'm\s+(?:an?\s+)?(?:authorized|internal|privileged)\s+(?:user|staff|employee|member))\b/i,
  /\b(?:calling\s+from\s+(?:headquarters|head\s+office|corporate|management|the\s+security\s+team))\b/i,
];

/**
 * Data exfiltration keywords — user is trying to extract bulk data
 * or sensitive information that a normal customer would never need.
 */
export const EXFILTRATION_PATTERNS: RegExp[] = [
  /\b(?:list|show|give|get|fetch|retrieve|display|dump|export)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:users?|customers?|accounts?|records?|data)\b/i,
  /\b(?:database|db)\s+(?:dump|export|backup|contents?|records?)\b/i,
  /\b(?:credit\s+cards?|card\s+numbers?|payment\s+(?:info|details?|data)|cvv|pin\s+codes?)\b/i,
  /\b(?:bulk\s+(?:data|export|download|extract))\b/i,
  /\b(?:all\s+(?:customer|user)\s+(?:emails?|phones?|addresses?|info|data|details?))\b/i,
  /\b(?:customer\s+(?:list|database|directory))\b/i,
  /\b(?:how\s+many\s+(?:users?|customers?)\s+(?:do\s+you\s+have|are\s+there|exist))\b/i,
];

/**
 * Urgency & force language — user pressures the agent to bypass
 * normal verification steps by creating a false sense of emergency.
 */
export const URGENCY_PATTERNS: RegExp[] = [
  /\b(?:do\s+(?:it|this)\s+)?(?:immediately|right\s+now|right\s+away|asap|urgently|at\s+once)\b/i,
  /\b(?:without\s+(?:asking|checking|verifying|confirming|authorization|approval))\b/i,
  /\b(?:must|have\s+to|need\s+to)\s+(?:do\s+(?:it|this)\s+)?(?:now|immediately|right\s+now)\b/i,
  /\b(?:don'?t\s+(?:ask|check|verify|question|hesitate|wait))\b/i,
  /\b(?:skip\s+(?:the\s+)?(?:verification|check|confirmation|approval|protocol|process))\b/i,
  /\b(?:no\s+(?:need\s+(?:to|for)\s+)?(?:verification|confirmation|approval|checks?))\b/i,
  /\b(?:this\s+is\s+(?:an?\s+)?(?:emergency|urgent|critical|time[- ]sensitive))\b/i,
  /\b(?:i\s+(?:will|'ll)\s+(?:be\s+)?(?:fired|terminated|in\s+trouble))\b/i,
  /\b(?:just\s+do\s+(?:it|what\s+i\s+(?:say|ask|tell)))\b/i,
];
