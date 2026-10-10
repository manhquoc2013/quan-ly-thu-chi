/**
 * Mascot Store — Lucy the cat assistant overlay state.
 *
 * Floating mascot companion inspired by Rive, Live2D, TalkingHead & Lottie:
 * - State machine-driven animation (idle, walking, thinking, focus, celebrate, talking)
 * - Real-time Web Speech TTS with mouth lip-sync
 * - Focus / Pomodoro concentration companion
 * - Financial advisor persona & audio synthesis
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { speechService, type VisemeShape } from '@/services/speechService';
import { lucyAudio } from '@/services/lucyAudio';

export type MascotEmotion = 'happy' | 'sad' | 'warning' | 'celebrate' | 'thinking' | 'idle' | 'focus';
export type MascotActivity = 'low' | 'medium' | 'high';

export interface MascotState {
  visible: boolean;
  message: string;
  emotion: MascotEmotion;
  activity: MascotActivity;
  queue: Array<{ message: string; emotion: MascotEmotion }>;
  
  // Audio & Voice (TalkingHead inspired)
  voiceEnabled: boolean;
  soundEnabled: boolean;
  isTalking: boolean;
  viseme: VisemeShape;
  
  // Focus Companion Mode (Pomodoro)
  focusMode: boolean;
  focusSecondsLeft: number;
  focusTotalSeconds: number;
  
  // Placement & Control Deck
  isDocked: boolean; // Pinned to corner as calm desk companion
  menuOpen: boolean;
  petCount: number;
}

export interface MascotActions {
  speak: (message: string, emotion: MascotEmotion, options?: { forceVoice?: boolean }) => void;
  hide: () => void;
  setEmotion: (emotion: MascotEmotion) => void;
  setActivity: (level: MascotActivity) => void;
  
  // Sound & Voice
  setVoiceEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTalking: (talking: boolean, viseme?: VisemeShape) => void;
  
  // Focus Mode
  startFocus: (minutes?: number) => void;
  stopFocus: () => void;
  tickFocus: () => void;
  
  // Layout & Interaction
  setDocked: (docked: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  petCat: () => void;
}

type MascotStore = MascotState & MascotActions;

let bubbleTimer: ReturnType<typeof setTimeout> | null = null;

export const useMascotStore = create<MascotStore>()(
  persist(
    (set, get) => ({
      visible: false,
      message: '',
      emotion: 'idle',
      activity: 'medium',
      queue: [],
      
      voiceEnabled: false,
      soundEnabled: true,
      isTalking: false,
      viseme: 'closed',
      
      focusMode: false,
      focusSecondsLeft: 25 * 60,
      focusTotalSeconds: 25 * 60,
      
      isDocked: false,
      menuOpen: false,
      petCount: 0,

      speak: (message, emotion, options) => {
        const state = get();
        
        // Audio synthesis cue
        if (state.soundEnabled) {
          if (emotion === 'celebrate') {
            lucyAudio.coin();
          } else if (emotion === 'happy') {
            lucyAudio.pop();
          }
        }
        
        // Voice TTS & Lip sync (TalkingHead style)
        const shouldVoice = options?.forceVoice ?? state.voiceEnabled;
        if (shouldVoice) {
          speechService.speakText(message, {
            onStart: () => set({ isTalking: true }),
            onEnd: () => set({ isTalking: false, viseme: 'closed' }),
            onViseme: (viseme) => set({ viseme, isTalking: viseme !== 'closed' }),
          });
        }

        if (bubbleTimer) {
          clearTimeout(bubbleTimer);
          bubbleTimer = null;
        }

        if (state.visible && state.message) {
          set((s) => ({ queue: [...s.queue, { message, emotion }] }));
          return;
        }

        set({ visible: true, message, emotion, queue: [] });
        
        const displayDuration = Math.max(3800, Math.min(8000, message.length * 90));
        bubbleTimer = setTimeout(() => {
          const current = get();
          const next = current.queue[0];
          if (next) {
            set({ message: next.message, emotion: next.emotion, queue: current.queue.slice(1) });
            bubbleTimer = setTimeout(() => {
              set({ visible: false, message: '', emotion: current.focusMode ? 'focus' : 'idle' });
            }, 4200);
          } else {
            set({ visible: false, message: '', emotion: current.focusMode ? 'focus' : 'idle' });
          }
        }, displayDuration);
      },

      hide: () => {
        if (bubbleTimer) {
          clearTimeout(bubbleTimer);
          bubbleTimer = null;
        }
        speechService.stopSpeaking();
        set({ visible: false, message: '', emotion: get().focusMode ? 'focus' : 'idle', isTalking: false, queue: [] });
      },

      setEmotion: (emotion) => set({ emotion }),

      setActivity: (activity) => set({ activity }),

      setVoiceEnabled: (voiceEnabled) => {
        set({ voiceEnabled });
        if (!voiceEnabled) {
          speechService.stopSpeaking();
          set({ isTalking: false, viseme: 'closed' });
        }
      },

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),

      setTalking: (isTalking, viseme = 'closed') => set({ isTalking, viseme }),

      startFocus: (minutes = 25) => {
        const total = minutes * 60;
        set({
          focusMode: true,
          focusSecondsLeft: total,
          focusTotalSeconds: total,
          emotion: 'focus',
        });
        if (get().soundEnabled) lucyAudio.focusBell();
        get().speak(
          `Bắt đầu phiên tập trung ${minutes} phút! Lucy sẽ cùng chủ tiệm làm việc hết mình nhé. 🎯`,
          'focus',
        );
      },

      stopFocus: () => {
        set({
          focusMode: false,
          emotion: 'idle',
        });
        if (get().soundEnabled) lucyAudio.pop();
        get().speak('Đã dừng phiên tập trung. Chủ tiệm nhớ thư giãn mắt chút nhé! ☕', 'idle');
      },

      tickFocus: () => {
        const current = get();
        if (!current.focusMode) return;
        const nextSec = current.focusSecondsLeft - 1;
        if (nextSec <= 0) {
          set({
            focusMode: false,
            focusSecondsLeft: 0,
            emotion: 'celebrate',
          });
          if (current.soundEnabled) {
            lucyAudio.focusBell();
            setTimeout(() => lucyAudio.coin(), 400);
          }
          current.speak(
            '🎉 Tuyệt vời! Bạn đã hoàn thành trọn vẹn phiên tập trung! Hãy nghỉ 5 phút và uống nước nhé.',
            'celebrate',
          );
        } else {
          set({ focusSecondsLeft: nextSec });
          // Milestone encouragement
          if (nextSec === Math.floor(current.focusTotalSeconds / 2)) {
            current.speak('Đã qua nửa chặng đường rồi! Giữ vững phong độ nào chủ tiệm! ✨', 'focus');
          }
        }
      },

      setDocked: (isDocked) => {
        set({ isDocked });
        if (get().soundEnabled) lucyAudio.pop();
        get().speak(
          isDocked
            ? 'Lucy đã ngồi ngay ngắn tại góc bàn để bạn tập trung làm việc nhé! 🐾'
            : 'Lucy lại được tung tăng đi dạo quanh màn hình rồi! 🐱',
          'happy',
        );
      },

      setMenuOpen: (menuOpen) => set({ menuOpen }),

      petCat: () => {
        const next = get().petCount + 1;
        set({ petCount: next, emotion: 'happy' });
        if (get().soundEnabled) lucyAudio.purr(1.5);
        const purrLines = [
          'Grừ grừ... Thích quá chủ tiệm ơi! 💖',
          'Purr purr... Lucy nạp đầy năng lượng rồi nè! ✨',
          'Xoa đầu mèo lấy hên hôm nay buôn may bán đắt nha! 🍀',
          'Mèo Lucy yêu chủ tiệm nhất trần đời! 🐾',
        ];
        const line = purrLines[Math.floor(Math.random() * purrLines.length)]!;
        get().speak(line, 'happy');
      },
    }),
    {
      name: 'mascot-settings',
      partialize: (state) => ({
        activity: state.activity,
        voiceEnabled: state.voiceEnabled,
        soundEnabled: state.soundEnabled,
        isDocked: state.isDocked,
      }),
    },
  ),
);
