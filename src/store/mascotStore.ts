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
export type VoiceTone = 'cute' | 'natural' | 'calm' | 'energetic';
export type MascotOutfit = 'financial' | 'support' | 'tech' | 'marketing' | 'system';

export interface OutfitPreset {
  id: MascotOutfit;
  name: string;
  role: string;
  desc: string;
  icon: string;
  greeting: string;
  primaryColor: string;
}

export const OUTFIT_PRESETS: Record<MascotOutfit, OutfitPreset> = {
  financial: {
    id: 'financial',
    name: 'Trợ lý Tài chính',
    role: 'Financial Advisor',
    desc: 'Vest navy, sơ mi trắng, chân váy bút chì, kính mắt, kẹp tài liệu & heo đất may mắn',
    icon: '💼',
    greeting: 'Meow! Em là Nấm - Trợ lý Tài chính. Em đã sẵn sàng đối soát thu chi và tối ưu tài chính cho anh/chị rồi ạ! 📈',
    primaryColor: '#1E3A8A',
  },
  support: {
    id: 'support',
    name: 'Chăm sóc Khách hàng',
    role: 'Customer Care',
    desc: 'Áo polo pastel dấu chân mèo, tai nghe headset kèm micro chuyên nghiệp',
    icon: '🎧',
    greeting: 'Meow! Em Nấm CSKH nghe đây ạ! Em có thể hỗ trợ giải đáp hay xử lý đơn hàng nào cho anh/chị ạ? 🐾',
    primaryColor: '#6366F1',
  },
  tech: {
    id: 'tech',
    name: 'Chuyên gia Công nghệ',
    role: 'Tech & Dev Specialist',
    desc: 'Hoodie xám năng động, kính chống ánh sáng xanh, ôm laptop kim loại',
    icon: '💻',
    greeting: 'Hệ thống vận hành trơn tru, data đồng bộ an toàn! Để Nấm theo dõi hiệu năng hệ thống cho nhé! ⚡',
    primaryColor: '#0EA5E9',
  },
  marketing: {
    id: 'marketing',
    name: 'Ưu đãi & Khuyến mãi',
    role: 'Sales & Marketing',
    desc: 'Áo khoác varsity đỏ-trắng, chân váy xếp ly, loa cầm tay megaphone & bảng SALE',
    icon: '📢',
    greeting: 'Ưu đãi bùng nổ! Tăng tốc doanh số và bão đơn hôm nay cùng Nấm nào! 🔥',
    primaryColor: '#EC4899',
  },
  system: {
    id: 'system',
    name: 'Nghỉ ngơi & Nạp năng lượng',
    role: 'System / Sleep / Coffee',
    desc: 'Bộ pajama pastel ấm áp, tách cà phê bốc khói, thong thả thư giãn nạp năng lượng',
    icon: '☕',
    greeting: 'Làm việc chăm chỉ rồi, anh/chị nhấp ngụm cà phê ấm rồi nghỉ mắt một chút cùng Nấm nhé! 🌸',
    primaryColor: '#8B5CF6',
  },
};

export const VOICE_TONES: Record<VoiceTone, { label: string; pitch: number; rate: number; desc: string }> = {
  cute: { label: 'Dễ thương (Mèo con)', pitch: 1.35, rate: 1.08, desc: 'Giọng cao trong trẻo, tinh nghịch' },
  natural: { label: 'Tự nhiên (Thân thiện)', pitch: 1.12, rate: 1.02, desc: 'Giọng cân bằng, ấm áp' },
  calm: { label: 'Điềm đạm (Trợ lý)', pitch: 0.95, rate: 0.96, desc: 'Giọng trầm ổn, tập trung' },
  energetic: { label: 'Năng động (Cổ vũ)', pitch: 1.25, rate: 1.18, desc: 'Giọng nhanh nhẹn, sôi nổi' },
};

export interface MascotState {
  visible: boolean;
  message: string;
  emotion: MascotEmotion;
  activity: MascotActivity;
  queue: Array<{ message: string; emotion: MascotEmotion }>;
  
  // Costume & Wardrobe Modules
  outfit: MascotOutfit;
  autoOutfit: boolean;
  isTransforming: boolean;
  requestedAction: string | null;
  
  // Audio & Voice (TalkingHead inspired)
  voiceEnabled: boolean;
  soundEnabled: boolean;
  isTalking: boolean;
  viseme: VisemeShape;
  voiceURI?: string;
  voiceTone: VoiceTone;
  voicePitch: number;
  voiceRate: number;
  announceOrders: boolean; // Tự động thông báo giọng nói khi có đơn mới / hoàn thành
  
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
  
  // Costume & Wardrobe Actions
  setOutfit: (outfit: MascotOutfit, options?: { silent?: boolean }) => void;
  setAutoOutfit: (enabled: boolean) => void;
  adaptOutfitForContext: (contextKey: string) => void;
  triggerAction: (action: string) => void;
  clearRequestedAction: () => void;
  
  // Sound & Voice
  setVoiceEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVoiceURI: (voiceURI: string | undefined) => void;
  setVoiceTone: (tone: VoiceTone) => void;
  setVoicePitch: (pitch: number) => void;
  setVoiceRate: (rate: number) => void;
  setAnnounceOrders: (enabled: boolean) => void;
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
      
      outfit: 'financial',
      autoOutfit: true,
      isTransforming: false,
      requestedAction: null,
      
      voiceEnabled: false,
      soundEnabled: true,
      isTalking: false,
      viseme: 'closed',
      voiceURI: undefined,
      voiceTone: 'cute',
      voicePitch: 1.35,
      voiceRate: 1.08,
      announceOrders: true,
      
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
            voiceURI: state.voiceURI,
            pitch: state.voicePitch,
            rate: state.voiceRate,
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

      setOutfit: (outfit, options) => {
        const current = get();
        if (current.outfit === outfit && !current.isTransforming) return;
        if (current.soundEnabled && !options?.silent) lucyAudio.transform();
        set({ outfit, isTransforming: true, emotion: 'happy' });
        const preset = OUTFIT_PRESETS[outfit];
        if (!options?.silent) {
          current.speak(preset.greeting, 'happy', { forceVoice: current.voiceEnabled });
        }
        setTimeout(() => {
          set({ isTransforming: false });
        }, 750);
      },

      setAutoOutfit: (autoOutfit) => set({ autoOutfit }),

      adaptOutfitForContext: (contextKey) => {
        const state = get();
        if (!state.autoOutfit) return;

        let target: MascotOutfit | null = null;
        const lower = contextKey.toLowerCase();

        if (state.focusMode) {
          target = 'system';
        } else if (lower.includes('ai') || lower.includes('chat') || lower.includes('cskh') || lower.includes('support')) {
          target = 'support';
        } else if (lower.includes('setting') || lower.includes('sync') || lower.includes('tech') || lower.includes('model')) {
          target = 'tech';
        } else if (lower.includes('product') || lower.includes('platform') || lower.includes('customer') || lower.includes('sale') || lower.includes('order')) {
          target = 'marketing';
        } else if (lower === '/' || lower.includes('expense') || lower.includes('revenue') || lower.includes('report') || lower.includes('dashboard')) {
          target = 'financial';
        }

        if (target && target !== state.outfit) {
          state.setOutfit(target, { silent: false });
        }
      },

      triggerAction: (requestedAction) => set({ requestedAction }),

      clearRequestedAction: () => set({ requestedAction: null }),

      setVoiceEnabled: (voiceEnabled) => {
        set({ voiceEnabled });
        if (!voiceEnabled) {
          speechService.stopSpeaking();
          set({ isTalking: false, viseme: 'closed' });
        }
      },

      setSoundEnabled: (soundEnabled) => {
        set({ soundEnabled });
        lucyAudio.setEnabled(soundEnabled);
      },

      setVoiceURI: (voiceURI) => set({ voiceURI }),

      setVoiceTone: (voiceTone) => {
        const preset = VOICE_TONES[voiceTone];
        set({
          voiceTone,
          voicePitch: preset.pitch,
          voiceRate: preset.rate,
        });
      },

      setVoicePitch: (voicePitch) => set({ voicePitch }),

      setVoiceRate: (voiceRate) => set({ voiceRate }),

      setAnnounceOrders: (announceOrders) => set({ announceOrders }),

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
          `Bắt đầu phiên tập trung ${minutes} phút! Nấm sẽ cùng chủ tiệm làm việc hết mình nhé. 🎯`,
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
            ? 'Nấm đã ngồi ngay ngắn tại góc bàn để bạn tập trung làm việc nhé! 🐾'
            : 'Nấm lại được tung tăng đi dạo quanh màn hình rồi! 🐱',
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
          'Purr purr... Nấm nạp đầy năng lượng rồi nè! ✨',
          'Xoa đầu mèo lấy hên hôm nay buôn may bán đắt nha! 🍀',
          'Mèo Nấm yêu chủ tiệm nhất trần đời! 🐾',
        ];
        const line = purrLines[Math.floor(Math.random() * purrLines.length)]!;
        get().speak(line, 'happy');
      },
    }),
    {
      name: 'mascot-settings',
      partialize: (state) => ({
        outfit: state.outfit,
        autoOutfit: state.autoOutfit,
        activity: state.activity,
        voiceEnabled: state.voiceEnabled,
        soundEnabled: state.soundEnabled,
        isDocked: state.isDocked,
        voiceURI: state.voiceURI,
        voiceTone: state.voiceTone,
        voicePitch: state.voicePitch,
        voiceRate: state.voiceRate,
        announceOrders: state.announceOrders,
      }),
    },
  ),
);
