/**
 * Auth Store — Google Drive connection, Gemini API key, user info.
 *
 * Persists Gemini API key to localStorage so it survives reload.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { geminiService } from '@/services/geminiService';

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

interface AuthState {
  isGoogleConnected: boolean;
  googleUser: GoogleUser | null;
  geminiApiKey: string | null;
  geminiConfigured: boolean;
}

export interface AuthActions {
  setGoogleConnected: (isGoogleConnected: boolean) => void;
  setGoogleUser: (googleUser: GoogleUser | null) => void;
  setGeminiApiKey: (key: string | null) => void;
  disconnectGoogle: () => void;
}

type AuthStore = AuthState & AuthActions;

function syncGeminiService(apiKey: string | null): void {
  if (apiKey) geminiService.configure(apiKey);
  else geminiService.disconnect();
}

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set) => ({
      isGoogleConnected: false,
      googleUser: null,
      geminiApiKey: null,
      geminiConfigured: false,

      setGoogleConnected: (isGoogleConnected) =>
        set((state) => {
          state.isGoogleConnected = isGoogleConnected;
        }),

      setGoogleUser: (googleUser) =>
        set((state) => {
          state.googleUser = googleUser;
          if (googleUser) state.isGoogleConnected = true;
        }),

      setGeminiApiKey: (geminiApiKey) => {
        set((state) => {
          state.geminiApiKey = geminiApiKey;
          state.geminiConfigured = !!geminiApiKey;
        });
        syncGeminiService(geminiApiKey);
      },

      disconnectGoogle: () =>
        set((state) => {
          state.isGoogleConnected = false;
          state.googleUser = null;
        }),
    })),
    {
      name: 'ql-tc-auth',
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        geminiConfigured: !!state.geminiApiKey,
        // Drive session restored from IndexedDB token via bootstrap (not zustand)
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.geminiApiKey) {
          syncGeminiService(state.geminiApiKey);
          state.geminiConfigured = true;
        }
      },
    },
  ),
);
