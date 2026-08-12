/**
 * Shared LLM cascade: user-configurable priority order.
 *
 * Chat: Kilo Free → OpenRouter → SiliconFlow → Groq → Gemini → WebLLM.
 * Extract (create/update/paste/slots): Groq → Gemini → Kilo → rest.
 */

import { useAuthStore } from '@/store/authStore';
import { geminiService } from './geminiService';
import { groqService } from './groqService';
import { kiloService } from './kiloService';
import { openRouterService } from './openRouterService';
import { siliconFlowService } from './siliconFlowService';
import { webLLM } from './webLLM';
import {
  type LlmSource,
  AI_PRIORITY_DEFAULT,
  LLM_SOURCE_LABELS,
  mergeAiPriority,
  mergeExtractPriority,
} from './llmTypes';

// Re-export for backward compatibility — callers import from llmCall.
export type { LlmSource } from './llmTypes';
export { AI_PRIORITY_DEFAULT, mergeExtractPriority } from './llmTypes';

export type LlmCascadeProfile = 'chat' | 'extract';

async function tryProvider(
  source: LlmSource,
  prompt: string,
  localMode: 'raw' | 'chat',
  profile: LlmCascadeProfile,
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
    case 'openrouter': {
      if (openRouterService.isEnabled && openRouterService.isConfigured && navigator.onLine) {
        try {
          return await openRouterService.generateContent(prompt);
        } catch { /* fall through */ }
      }
      return null;
    }
    case 'siliconflow': {
      if (siliconFlowService.isEnabled && siliconFlowService.isConfigured && navigator.onLine) {
        try {
          return await siliconFlowService.generateContent(prompt);
        } catch { /* fall through */ }
      }
      return null;
    }
    case 'groq': {
      if (groqService.isEnabled && groqService.isConfigured && navigator.onLine) {
        try {
          return await groqService.generateContent(prompt, {
            task: profile === 'extract' ? 'extract' : 'chat',
          });
        } catch { /* fall through */ }
      }
      return null;
    }
    case 'gemini': {
      if (geminiService.isConfigured && navigator.onLine) {
        try {
          const text = await geminiService.generateContent(prompt, {
            task: profile === 'extract' ? 'extract' : 'chat',
          });
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
  profile: LlmCascadeProfile = 'chat',
): Promise<{ text: string; source: LlmSource } | null> {
  const { aiPriority } = useAuthStore.getState();
  const order =
    profile === 'extract' ? mergeExtractPriority(aiPriority) : mergeAiPriority(aiPriority);

  for (const source of order) {
    const text = await tryProvider(source, prompt, localMode, profile);
    if (text) return { text, source };
  }

  return null;
}

/** True when any online cloud path may be used (longer finance context OK). */
export function canUseCloudLlm(): boolean {
  const { geminiConfigured, groqConfigured, openRouterConfigured, siliconFlowConfigured, enableKiloFree, enableGroq, enableOpenRouter, enableSiliconFlow } = useAuthStore.getState();
  if (!navigator.onLine) return false;
  if (enableKiloFree !== false && kiloService.isEnabled) return true;
  if (enableOpenRouter !== false && openRouterConfigured && openRouterService.isConfigured) return true;
  if (enableSiliconFlow !== false && siliconFlowConfigured && siliconFlowService.isConfigured) return true;
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
