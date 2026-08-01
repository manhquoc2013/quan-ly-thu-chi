/**
 * Auth Store — Google Drive connection, Gemini API key, user info.
 *
 * Zustand 5 + Immer for safe mutable updates.
 *
 * Usage:
 *   const { isGoogleConnected, geminiConfigured } = useAuthStore();
 *   const { setGoogleConnected, setGeminiApiKey, disconnectGoogle } = useAuthStore();
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface AuthState {
  isGoogleConnected: boolean;
  googleUser: GoogleUser | null;
  geminiApiKey: string | null;
  geminiConfigured: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface AuthActions {
  setGoogleConnected: (isGoogleConnected: boolean) => void;
  setGoogleUser: (googleUser: GoogleUser | null) => void;
  setGeminiApiKey: (key: string | null) => void;
  disconnectGoogle: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  immer((set) => ({
    isGoogleConnected: false,
    googleUser: null,
    geminiApiKey: null,
    geminiConfigured: false,

    // ── Mutations ──────────────────────────────────────────────────────────

    setGoogleConnected: (isGoogleConnected) =>
      set((state) => {
        state.isGoogleConnected = isGoogleConnected;
      }),

    setGoogleUser: (googleUser) =>
      set((state) => {
        state.googleUser = googleUser;
        // If a user is set, assume connected
        if (googleUser) {
          state.isGoogleConnected = true;
        }
      }),

    setGeminiApiKey: (geminiApiKey) =>
      set((state) => {
        state.geminiApiKey = geminiApiKey;
        state.geminiConfigured = !!geminiApiKey;
      }),

    disconnectGoogle: () =>
      set((state) => {
        state.isGoogleConnected = false;
        state.googleUser = null;
      }),
  })),
);
