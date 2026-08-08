import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueOutbox, listOutbox, clearOutbox, pendingCount } from './syncOutbox';

describe('syncOutbox', () => {
  beforeEach(() => {
    clearOutbox('user-1');
  });

  it('coalesces upserts for same entityId keeping newest payload', () => {
    enqueueOutbox({
      userId: 'user-1',
      entity: 'user_settings',
      entityId: 'user-1',
      op: 'upsert',
      payload: { enable_web_llm: true },
      mutatedAt: '2026-08-08T10:00:00.000Z',
    });
    enqueueOutbox({
      userId: 'user-1',
      entity: 'user_settings',
      entityId: 'user-1',
      op: 'upsert',
      payload: { enable_web_llm: false },
      mutatedAt: '2026-08-08T10:01:00.000Z',
    });
    const items = listOutbox('user-1');
    expect(items).toHaveLength(1);
    expect(items[0]!.payload.enable_web_llm).toBe(false);
    expect(pendingCount('user-1')).toBe(1);
  });
});
