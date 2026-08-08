/**
 * Shared LLM types and constants.
 *
 * MUST have zero imports — used by both llmCall.ts and authStore.ts
 * to avoid a circular dependency.
 */

/** Who actually answered — UI should not label all cloud as Gemini. */
export type LlmSource = 'kilo' | 'groq' | 'gemini' | 'local';

/** Default priority order. User can reorder in Settings. */
export const AI_PRIORITY_DEFAULT: LlmSource[] = ['kilo', 'groq', 'gemini', 'local'];

/** Source → human label (used in AIChatScreen & ChatPanel). */
export const LLM_SOURCE_LABELS: Record<LlmSource, string> = {
  kilo: '🟢 Kilo Free',
  groq: '🟣 Groq',
  gemini: '🟢 Gemini',
  local: '⚡ Local',
};
