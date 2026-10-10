/**
 * Motion Store — Global animation, transition & visual effects configuration.
 *
 * Provides granular control over:
 * - Motion Level: 'full' (rich 60fps) | 'reduced' (subtle fades) | 'off' (instant 0ms)
 * - Splash Screen animation & initial loading intro
 * - Cursor Glow interactive particle effects
 * - Page & Route transition animations
 * - Mascot micro-animations & physics intensity
 * - Hardware GPU acceleration hints
 *
 * Persists in localStorage and applies data-motion attribute to <html>.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MotionLevel = 'full' | 'reduced' | 'off';

export interface MotionLevelInfo {
  label: string;
  desc: string;
  icon: string;
  badge: string;
}

export const MOTION_LEVELS: Record<MotionLevel, MotionLevelInfo> = {
  full: {
    label: 'Đầy đủ (Sống động)',
    desc: 'Hiệu ứng hoạt hoạ đầy đủ 60fps, chuyển động tự nhiên, mượt mà và sống động',
    icon: '✨',
    badge: 'Mặc định',
  },
  reduced: {
    label: 'Nhẹ nhàng (Tiết kiệm)',
    desc: 'Giảm 50% thời lượng, chuyển động mờ dần tinh tế, tiết kiệm pin và tải CPU',
    icon: '🍃',
    badge: 'Tối ưu pin',
  },
  off: {
    label: 'Tức thì (Tắt hoạt hoạ)',
    desc: '0ms chuyển cảnh, phản hồi tức thời, loại bỏ toàn bộ hiệu ứng rung lắc',
    icon: '⚡',
    badge: 'Tốc độ tối đa',
  },
};

export interface MotionState {
  motionLevel: MotionLevel;
  cursorGlow: boolean;
  splashAnimation: boolean;
  pageTransitions: boolean;
  mascotAnimations: boolean;
  gpuAcceleration: boolean;
}

export interface MotionActions {
  setMotionLevel: (level: MotionLevel) => void;
  setCursorGlow: (enabled: boolean) => void;
  setSplashAnimation: (enabled: boolean) => void;
  setPageTransitions: (enabled: boolean) => void;
  setMascotAnimations: (enabled: boolean) => void;
  setGpuAcceleration: (enabled: boolean) => void;
  resetDefaults: () => void;
  resetMotionSettings: () => void;
}

const defaultState: MotionState = {
  motionLevel: 'full',
  cursorGlow: true,
  splashAnimation: true,
  pageTransitions: true,
  mascotAnimations: true,
  gpuAcceleration: true,
};

function applyDOMAttributes(state: MotionState): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.setAttribute('data-motion', state.motionLevel);
  root.style.setProperty(
    '--motion-duration-factor',
    state.motionLevel === 'off' ? '0' : state.motionLevel === 'reduced' ? '0.5' : '1'
  );

  if (state.motionLevel === 'off') {
    root.classList.add('motion-off');
    root.classList.remove('motion-reduced');
  } else if (state.motionLevel === 'reduced') {
    root.classList.add('motion-reduced');
    root.classList.remove('motion-off');
  } else {
    root.classList.remove('motion-off', 'motion-reduced');
  }

  if (state.gpuAcceleration) {
    root.style.setProperty('--motion-will-change', 'transform, opacity');
  } else {
    root.style.removeProperty('--motion-will-change');
  }
}

export const useMotionStore = create<MotionState & MotionActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setMotionLevel: (motionLevel) => {
        set({ motionLevel });
        applyDOMAttributes({ ...get(), motionLevel });
      },

      setCursorGlow: (cursorGlow) => {
        set({ cursorGlow });
        applyDOMAttributes({ ...get(), cursorGlow });
      },

      setSplashAnimation: (splashAnimation) => {
        set({ splashAnimation });
        applyDOMAttributes({ ...get(), splashAnimation });
      },

      setPageTransitions: (pageTransitions) => {
        set({ pageTransitions });
        applyDOMAttributes({ ...get(), pageTransitions });
      },

      setMascotAnimations: (mascotAnimations) => {
        set({ mascotAnimations });
        applyDOMAttributes({ ...get(), mascotAnimations });
      },

      setGpuAcceleration: (gpuAcceleration) => {
        set({ gpuAcceleration });
        applyDOMAttributes({ ...get(), gpuAcceleration });
      },

      resetDefaults: () => {
        set({ ...defaultState });
        applyDOMAttributes(defaultState);
      },

      resetMotionSettings: () => {
        set({ ...defaultState });
        applyDOMAttributes(defaultState);
      },
    }),
    {
      name: 'motion-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyDOMAttributes(state);
        }
      },
    }
  )
);

// Apply on initial module import if in browser
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('motion-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state) {
        applyDOMAttributes(parsed.state);
      }
    } else {
      applyDOMAttributes(defaultState);
    }
  } catch {
    applyDOMAttributes(defaultState);
  }
}
