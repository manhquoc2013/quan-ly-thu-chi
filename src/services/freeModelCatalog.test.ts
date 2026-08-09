import { describe, expect, it } from 'vitest';
import {
  buildOpenRouterFreeList,
  buildSiliconFlowFreeList,
  isLikelySiliconFlowFreeChat,
  isOpenRouterFreeTextChat,
  rankOpenRouterFreeIds,
} from './freeModelCatalog';

describe('freeModelCatalog OpenRouter', () => {
  it('accepts zero-price text->text models', () => {
    expect(
      isOpenRouterFreeTextChat({
        id: 'google/gemma-4-31b-it:free',
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
      }),
    ).toBe(true);
  });

  it('rejects audio/image free models', () => {
    expect(
      isOpenRouterFreeTextChat({
        id: 'google/lyria-3-pro-preview',
        pricing: { prompt: '0', completion: '0' },
        architecture: { modality: 'text->audio', input_modalities: ['text'], output_modalities: ['audio'] },
      }),
    ).toBe(false);
  });

  it('always puts openrouter/free first', () => {
    const list = buildOpenRouterFreeList(['openai/gpt-oss-20b:free', 'google/gemma-4-31b-it:free']);
    expect(list[0]).toBe('openrouter/free');
    expect(list).toContain('google/gemma-4-31b-it:free');
  });

  it('ranks smaller chat models ahead of huge ones', () => {
    const ranked = rankOpenRouterFreeIds([
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-31b-it:free',
    ]);
    expect(ranked[0]).toBe('google/gemma-4-31b-it:free');
  });
});

describe('freeModelCatalog SiliconFlow', () => {
  it('excludes Pro/ and non-chat modalities', () => {
    expect(isLikelySiliconFlowFreeChat('Pro/Qwen/Qwen2.5-7B-Instruct')).toBe(false);
    expect(isLikelySiliconFlowFreeChat('deepseek-ai/DeepSeek-OCR')).toBe(false);
  });

  it('keeps seed models that still exist live, drops removed ones from front', () => {
    const list = buildSiliconFlowFreeList([
      'Qwen/Qwen3-8B',
      'deepseek-ai/DeepSeek-V4-Pro',
      'Some/New-7B-Instruct',
    ]);
    expect(list[0]).toBe('Qwen/Qwen3-8B');
    expect(list).toContain('Some/New-7B-Instruct');
    expect(list).not.toContain('deepseek-ai/DeepSeek-V4-Pro');
  });
});
