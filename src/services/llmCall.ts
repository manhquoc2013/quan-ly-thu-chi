/**
 * Shared LLM cascade: Kilo Free → Gemini → WebLLM.
 */

import { useAuthStore } from '@/store/authStore';
import { geminiService } from './geminiService';
import { kiloService } from './kiloService';
import { webLLM } from './webLLM';

/** Who actually answered — UI should not label all cloud as Gemini. */
export type LlmSource = 'kilo' | 'gemini' | 'local';

export async function callLlmCascade(
  prompt: string,
  localMode: 'raw' | 'chat' = 'raw',
): Promise<{ text: string; source: LlmSource } | null> {
  const { geminiConfigured, enableKiloFree } = useAuthStore.getState();

  // 1. Kilo Auto Free (online, via Vite proxy in DEV)
  if (enableKiloFree !== false && navigator.onLine && kiloService.isEnabled) {
    try {
      const text = await kiloService.generateContent(prompt);
      if (text) return { text, source: 'kilo' };
    } catch {
      /* Gemini / local */
    }
  }

  // 2. Gemini (if key configured)
  if (geminiConfigured && navigator.onLine && geminiService.isConfigured) {
    try {
      const text = await geminiService.generateContent(prompt);
      if (text && !text.startsWith('Lỗi Gemini:') && !text.startsWith('[Gemini chưa')) {
        return { text, source: 'gemini' };
      }
    } catch {
      /* local */
    }
  }

  // 3. WebLLM local
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
      return { text, source: 'local' };
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** True when any online cloud path may be used (longer finance context OK). */
export function canUseCloudLlm(): boolean {
  const { geminiConfigured, enableKiloFree } = useAuthStore.getState();
  if (!navigator.onLine) return false;
  if (enableKiloFree !== false && kiloService.isEnabled) return true;
  return !!(geminiConfigured && geminiService.isConfigured);
}

export function llmSourceLabel(source: string | undefined): string {
  switch (source) {
    case 'kilo':
      return '🟢 Kilo Free';
    case 'gemini':
    case 'cloud':
      return '🟢 Gemini';
    case 'tesseract':
      return '🔤 Tesseract OCR';
    default:
      return '⚡ Local';
  }
}
