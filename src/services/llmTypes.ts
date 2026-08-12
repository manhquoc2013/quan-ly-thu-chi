/**
 * Shared LLM types and constants.
 *
 * MUST have zero imports — used by both llmCall.ts and authStore.ts
 * to avoid a circular dependency.
 */

/** Who actually answered — UI should not label all cloud as Gemini. */
export type LlmSource = 'kilo' | 'openrouter' | 'siliconflow' | 'groq' | 'gemini' | 'local';

/** Default priority order. User can reorder in Settings. */
export const AI_PRIORITY_DEFAULT: LlmSource[] = ['kilo', 'openrouter', 'siliconflow', 'groq', 'gemini', 'local'];

/** JSON extract (create/update/paste/slots): prefer stronger models, then free. */
export const AI_EXTRACT_PRIORITY: LlmSource[] = ['groq', 'gemini', 'kilo', 'openrouter', 'siliconflow', 'local'];

/** Source → human label (used in AIChatScreen & ChatPanel). */
export const LLM_SOURCE_LABELS: Record<LlmSource, string> = {
  kilo: '🟢 Kilo Free',
  openrouter: '🟠 OpenRouter',
  siliconflow: '🔵 SiliconFlow',
  groq: '🟣 Groq',
  gemini: '🟢 Gemini',
  local: '⚡ Local',
};

/**
 * Keep user's saved order, but append any sources missing from older saves
 * (e.g. openrouter/siliconflow added after user already persisted aiPriority).
 */
export function mergeAiPriority(saved: LlmSource[] | null | undefined): LlmSource[] {
  const base = saved?.length ? saved : [];
  const seen = new Set<LlmSource>();
  const out: LlmSource[] = [];
  for (const src of base) {
    if (seen.has(src)) continue;
    if (!(src in LLM_SOURCE_LABELS)) continue;
    seen.add(src);
    out.push(src);
  }
  for (const src of AI_PRIORITY_DEFAULT) {
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out.length > 0 ? out : [...AI_PRIORITY_DEFAULT];
}

/**
 * Extract cascade: Groq → Gemini → Kilo first, then remaining chat-order providers.
 * Disabled/unconfigured providers are skipped at call time.
 */
export function mergeExtractPriority(saved: LlmSource[] | null | undefined): LlmSource[] {
  const chatOrder = mergeAiPriority(saved);
  const head = AI_EXTRACT_PRIORITY.slice(0, 3);
  const tail = chatOrder.filter((src) => !head.includes(src));
  const out = [...head.filter((src) => chatOrder.includes(src)), ...tail];
  return out.length > 0 ? out : [...AI_EXTRACT_PRIORITY];
}
