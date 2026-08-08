/**
 * Mascot Store — Lucky the cat overlay state.
 *
 * Shows a floating mascot overlay with emotion and speech bubble
 * triggered by new transactions.
 */

import { create } from 'zustand';

export type MascotEmotion = 'happy' | 'sad' | 'warning' | 'celebrate' | 'thinking' | 'idle';
export type MascotActivity = 'low' | 'medium' | 'high';

export interface MascotState {
  visible: boolean;
  message: string;
  emotion: MascotEmotion;
  activity: MascotActivity;
  queue: Array<{ message: string; emotion: MascotEmotion }>;
}

export interface MascotActions {
  speak: (message: string, emotion: MascotEmotion) => void;
  hide: () => void;
  setEmotion: (emotion: MascotEmotion) => void;
  setActivity: (level: MascotActivity) => void;
}

type MascotStore = MascotState & MascotActions;

export const useMascotStore = create<MascotStore>((set, get) => ({
  visible: false,
  message: '',
  emotion: 'idle',
  activity: 'medium',
  queue: [],

  speak: (message, emotion) => {
    const state = get();
    if (state.visible) {
      // Queue it — show after current message hides
      set((s) => ({ queue: [...s.queue, { message, emotion }] }));
      return;
    }
    set({ visible: true, message, emotion, queue: [] });
    // Auto-hide after 4 seconds, then process queue
    setTimeout(() => {
      const current = get();
      const next = current.queue[0];
      if (next) {
        set({ message: next.message, emotion: next.emotion, queue: current.queue.slice(1) });
        // Schedule hide for this next message
        setTimeout(() => {
          set({ visible: false, message: '', emotion: 'idle' });
        }, 4000);
      } else {
        set({ visible: false, message: '', emotion: 'idle' });
      }
    }, 4000);
  },

  hide: () => set({ visible: false, message: '', emotion: 'idle', queue: [] }),

  setEmotion: (emotion) => set({ emotion }),

  setActivity: (activity) => set({ activity }),
}));
