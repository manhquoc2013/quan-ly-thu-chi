/**
 * Shared LLM cascade: user-configurable priority order.
 *
 * Default: Kilo Free → Groq → Gemini → WebLLM.
 */

import { useAuthStore } from '@/store/authStore';
import { geminiService } from './geminiService';
import { groqService } from './groqService';
import { kiloService } from './kiloService';
import { webLLM } from './webLLM';
import { type LlmSource, AI_PRIORITY_DEFAULT, LLM_SOURCE_LABELS } from './llmTypes';

// Re-export for backward compatibility — callers import from llmCall.
export type { LlmSource } from './llmTypes';
export { AI_PRIORITY_DEFAULT } from './llmTypes';

async function tryProvider(
  source: LlmSource,
  prompt: string,
  localMode: 'raw' | 'chat',
): Promise<string | null> {
  switch (source) {
    case 'kilo': {
      if (kiloService.isEnabled && navigator.onLine) {
        try {
          return await kiloService.generateContent(prompt);
        } catch { /* fall through */ }
      }
      return null;
    }
    case 'groq': {
      if (groqService.isEnabled && groqService.isConfigured && navigator.onLine) {
        try {
          return await groqService.generateContent(prompt);
        } catch { /* fall through */ }
      }
      return null;
    }
    case 'gemini': {
      if (geminiService.isConfigured && navigator.onLine) {
        try {
          const text = await geminiService.generateContent(prompt);
          if (text && !text.startsWith('Lỗi Gemini:') && !text.startsWith('[Gemini chưa')) {
            return text;
          }
        } catch { /* fall through */ }
      }
      return null;
    }
    case 'local': {
      const { enableWebLLM } = useAuthStore.getState();
      if (enableWebLLM === false) return null;
      try {
        const text = await webLLM.generate(prompt, {
          mode: localMode,
          maxTokens: localMode === 'raw' ? 256 : 512,
        });
        if (
          text &&
          !text.startsWith('⚠️') &&
          !text.startsWith('⏳') &&
          !text.startsWith('⏹️') &&
          !text.startsWith('⏱️') &&
          !text.startsWith('Lỗi sinh')
        ) {
          return text;
        }
      } catch { /* fall through */ }
      return null;
    }
    default:
      return null;
  }
}

export async function callLlmCascade(
  prompt: string,
  localMode: 'raw' | 'chat' = 'raw',
): Promise<{ text: string; source: LlmSource } | null> {
  const { aiPriority } = useAuthStore.getState();
  const order = aiPriority?.length ? aiPriority : AI_PRIORITY_DEFAULT;

  for (const source of order) {
    const text = await tryProvider(source, prompt, localMode);
    if (text) return { text, source };
  }

  return null;
}

/** True when any online cloud path may be used (longer finance context OK). */
export function canUseCloudLlm(): boolean {
  const { geminiConfigured, groqConfigured, enableKiloFree, enableGroq } = useAuthStore.getState();
  if (!navigator.onLine) return false;
  if (enableKiloFree !== false && kiloService.isEnabled) return true;
  if (enableGroq !== false && groqConfigured && groqService.isConfigured) return true;
  return !!(geminiConfigured && geminiService.isConfigured);
}

export function llmSourceLabel(source: string | undefined): string {
  if (source && source in LLM_SOURCE_LABELS) {
    return LLM_SOURCE_LABELS[source as LlmSource];
  }
  switch (source) {
    case 'tesseract':
      return '🔤 Tesseract OCR';
    default:
      return '⚡ Local';
  }
}
