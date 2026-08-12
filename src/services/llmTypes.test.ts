import { describe, expect, it } from 'vitest';
import {
  AI_EXTRACT_PRIORITY,
  AI_PRIORITY_DEFAULT,
  mergeAiPriority,
  mergeExtractPriority,
} from './llmTypes';

describe('mergeExtractPriority', () => {
  it('puts Groq then Gemini then Kilo before free chat providers', () => {
    expect(mergeExtractPriority(AI_PRIORITY_DEFAULT)).toEqual([
      'groq',
      'gemini',
      'kilo',
      'openrouter',
      'siliconflow',
      'local',
    ]);
    expect(mergeExtractPriority(null)[0]).toBe('groq');
    expect(mergeExtractPriority(undefined).slice(0, 3)).toEqual(['groq', 'gemini', 'kilo']);
  });

  it('does not drop providers from the chat cascade', () => {
    const extract = mergeExtractPriority(['kilo', 'local']);
    const chat = mergeAiPriority(['kilo', 'local']);
    expect(extract).toHaveLength(chat.length);
    expect(new Set(extract)).toEqual(new Set(chat));
  });

  it('keeps extract head order even if user ranked Kilo first', () => {
    const extract = mergeExtractPriority(['kilo', 'openrouter', 'groq', 'gemini']);
    expect(extract.slice(0, 3)).toEqual(['groq', 'gemini', 'kilo']);
    expect(AI_EXTRACT_PRIORITY.slice(0, 3)).toEqual(['groq', 'gemini', 'kilo']);
  });
});
