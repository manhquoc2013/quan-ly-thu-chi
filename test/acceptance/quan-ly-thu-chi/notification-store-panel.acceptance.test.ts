/**
 * Acceptance tests: Notification Store + Bell Panel (TRI-1786204432263-fb1c)
 *
 * Gray-box: unit tests for the Zustand store (no HTTP endpoint).
 * Bell panel rendering is verified via code review (component unit tests require
 * React Testing Library + shadcn/ui setup which is out of scope for this module).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../../../src/store/notificationStore';
import type { NotificationType } from '../../../src/store/notificationStore';

function resetStore() {
  useNotificationStore.setState({ notifications: [] });
}

describe('Notification Store API', () => {
  beforeEach(() => resetStore());

  // AC-NS-01 — addNotification stores entries with correct shape
  it('AC-NS-01: addNotification stores entry with id, type, title, message, timestamp, read=false', () => {
    useNotificationStore.getState().addNotification('sync', 'Đồng bộ dữ liệu', 'Đã đồng bộ 5 thay đổi');
    const items = useNotificationStore.getState().notifications;
    expect(items).toHaveLength(1);
    const n = items[0];
    expect(n.id).toBeDefined();
    expect(typeof n.id).toBe('string');
    expect(n.type).toBe('sync');
    expect(n.title).toBe('Đồng bộ dữ liệu');
    expect(n.message).toBe('Đã đồng bộ 5 thay đổi');
    expect(typeof n.timestamp).toBe('number');
    expect(n.read).toBe(false);
  });

  // AC-NS-02 — markRead sets read=true on the target, others unchanged
  it('AC-NS-02: markRead sets read=true on target, others unchanged', () => {
    const store = useNotificationStore.getState();
    store.addNotification('import', 'Nhập dữ liệu', 'Đã lưu 1 khoản');
    store.addNotification('error', 'Lỗi đồng bộ', '2 thay đổi không đồng bộ được');
    const items = useNotificationStore.getState().notifications;
    expect(items).toHaveLength(2);

    useNotificationStore.getState().markRead(items[0].id);
    const updated = useNotificationStore.getState().notifications;
    expect(updated[0].read).toBe(true);
    expect(updated[1].read).toBe(false);
  });

  // AC-NS-03 — markRead is idempotent (no-op on unknown id)
  it('AC-NS-03: markRead is idempotent — no-op for unknown id', () => {
    useNotificationStore.getState().addNotification('ai', 'AI phân tích', 'Phân tích hoàn tất');
    useNotificationStore.getState().markRead('nonexistent-id');
    const items = useNotificationStore.getState().notifications;
    expect(items).toHaveLength(1);
    expect(items[0].read).toBe(false); // unchanged
  });

  // AC-NS-04 — markAllRead marks all
  it('AC-NS-04: markAllRead marks all notifications as read', () => {
    const store = useNotificationStore.getState();
    store.addNotification('sync', 'A', 'msg A');
    store.addNotification('import', 'B', 'msg B');
    store.addNotification('error', 'C', 'msg C');
    useNotificationStore.getState().markAllRead();
    const items = useNotificationStore.getState().notifications;
    expect(items.every((n) => n.read)).toBe(true);
  });

  // AC-NS-05 — markAllRead safe on empty
  it('AC-NS-05: markAllRead is safe on empty list', () => {
    expect(() => useNotificationStore.getState().markAllRead()).not.toThrow();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  // AC-NS-06 — unread count logic (via getState, since useUnreadCount is a React hook)
  it('AC-NS-06: unread count returns correct number via getState', () => {
    const store = useNotificationStore.getState();
    store.addNotification('sync', 'A', 'msg');
    store.addNotification('import', 'B', 'msg');
    store.addNotification('realtime', 'C', 'msg');
    // mark 1 as read
    const [first] = useNotificationStore.getState().notifications;
    useNotificationStore.getState().markRead(first.id);
    // unread count computed directly from state (same logic as useUnreadCount selector)
    const unread = useNotificationStore.getState().notifications.filter((n) => !n.read).length;
    expect(unread).toBe(2);
  });

  // AC-NS-07 — max 50: adding 51st trims oldest
  it('AC-NS-07: adding 51st notification trims oldest (max 50)', () => {
    const store = useNotificationStore.getState();
    for (let i = 0; i < 55; i++) {
      store.addNotification('sync', `Title ${i}`, `Message ${i}`);
    }
    const items = useNotificationStore.getState().notifications;
    expect(items).toHaveLength(50);
    // First 5 should be trimmed; oldest kept should be index 5
    expect(items[0].title).toBe('Title 5');
    expect(items[49].title).toBe('Title 54');
  });

  // AC-NS-08 — clear removes all
  it('AC-NS-08: clear removes all notifications', () => {
    const store = useNotificationStore.getState();
    store.addNotification('sync', 'A', 'msg');
    store.addNotification('import', 'B', 'msg');
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
    useNotificationStore.getState().clear();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  // AC-NS-09 — all 5 notification types accepted
  it('AC-NS-09: all 5 NotificationType values accepted', () => {
    const types: NotificationType[] = ['sync', 'import', 'ai', 'realtime', 'error'];
    const store = useNotificationStore.getState();
    types.forEach((t) => { store.addNotification(t, `Title ${t}`, `Message ${t}`); });
    const items = useNotificationStore.getState().notifications;
    expect(items).toHaveLength(5);
    expect(items.map((n) => n.type).sort()).toEqual(types.sort());
  });

  // AC-NS-10 — notifications ordered by insertion (newest last)
  it('AC-NS-10: notifications maintain insertion order (newest at end)', () => {
    const store = useNotificationStore.getState();
    store.addNotification('sync', 'First', 'msg');
    store.addNotification('import', 'Second', 'msg');
    store.addNotification('error', 'Third', 'msg');
    const items = useNotificationStore.getState().notifications;
    expect(items[0].title).toBe('First');
    expect(items[1].title).toBe('Second');
    expect(items[2].title).toBe('Third');
  });

  // AC-NS-11 — clear then add works (state reset)
  it('AC-NS-11: clear then add works correctly after reset', () => {
    const store = useNotificationStore.getState();
    store.addNotification('sync', 'Old', 'msg');
    store.clear();
    store.addNotification('realtime', 'New after clear', 'msg');
    const items = useNotificationStore.getState().notifications;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('New after clear');
  });
});
