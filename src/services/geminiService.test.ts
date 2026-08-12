import { describe, expect, it } from 'vitest';
import {
  GEMINI_FLASH,
  GEMINI_FLASH_LITE,
  modelsForGeminiTask,
} from './geminiService';

describe('modelsForGeminiTask', () => {
  it('uses flash first for extract and vision', () => {
    expect(modelsForGeminiTask('extract')[0]).toBe(GEMINI_FLASH);
    expect(modelsForGeminiTask('vision')[0]).toBe(GEMINI_FLASH);
    expect(modelsForGeminiTask('extract')).toEqual([GEMINI_FLASH, GEMINI_FLASH_LITE]);
  });

  it('uses flash-lite first for chat', () => {
    expect(modelsForGeminiTask('chat')[0]).toBe(GEMINI_FLASH_LITE);
    expect(modelsForGeminiTask('chat')).toEqual([GEMINI_FLASH_LITE, GEMINI_FLASH]);
  });

  it('prefers newer live flash models when catalog is provided', () => {
    const live = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash-lite'];
    expect(modelsForGeminiTask('extract', live)[0]).toBe('gemini-3.6-flash');
    expect(modelsForGeminiTask('chat', live)).toContain('gemini-2.5-flash-lite');
  });
});
