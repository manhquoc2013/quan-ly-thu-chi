import { describe, it, expect } from 'vitest';
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
import { MODEL_ID } from './webLLM';

describe('webLLM configuration', () => {
  it('uses a model ID present in prebuiltAppConfig.model_list', () => {
    const exists = prebuiltAppConfig.model_list.some((m) => m.model_id === MODEL_ID);
    expect(exists).toBe(true);
  });
});
