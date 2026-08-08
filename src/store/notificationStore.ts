/**
 * Notification Store — centralized in-memory notification history.
 *
 * Holds up to 50 notifications (oldest trimmed on overflow).
 * Exposes add, markRead, markAllRead, clear actions and an unreadCount selector.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type NotificationType = 'sync' | 'import' | 'ai' | 'realtime' | 'error';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number; // Date.now()
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
}

export interface NotificationActions {
  /** Add a notification. If the store has 50 entries, the oldest is trimmed. */
  addNotification: (type: NotificationType, title: string, message: string) => void;
  /** Mark a single notification as read by id. No-op if id not found. */
  markRead: (id: string) => void;
  /** Mark all notifications as read. */
  markAllRead: () => void;
  /** Remove all notifications. */
  clear: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

const MAX_NOTIFICATIONS = 50;

export const useNotificationStore = create<NotificationStore>()(
  immer((set) => ({
    notifications: [],

    addNotification: (type, title, message) =>
      set((state) => {
        const item: NotificationItem = {
          id: crypto.randomUUID(),
          type,
          title,
          message,
          timestamp: Date.now(),
          read: false,
        };
        state.notifications.push(item);
        if (state.notifications.length > MAX_NOTIFICATIONS) {
          state.notifications = state.notifications.slice(-MAX_NOTIFICATIONS);
        }
      }),

    markRead: (id) =>
      set((state) => {
        const target = state.notifications.find((n) => n.id === id);
        if (target) {
          target.read = true;
        }
      }),

    markAllRead: () =>
      set((state) => {
        state.notifications.forEach((n) => {
          n.read = true;
        });
      }),

    clear: () =>
      set((state) => {
        state.notifications = [];
      }),
  })),
);

/** Selector: count of unread notifications. */
export function useUnreadCount(): number {
  return useNotificationStore((s) => s.notifications.filter((n) => !n.read).length);
}
