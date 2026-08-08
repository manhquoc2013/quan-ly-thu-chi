/**
 * Auth Store — Gemini/Groq/Kilo settings, Supabase user session, household.
 *
 * Auth gate is Supabase session (see AuthGuard). Settings hydrate from cloud on login;
 * local persist is a cache for offline.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { geminiService } from '@/services/geminiService';
import { groqService } from '@/services/groqService';
import { kiloService } from '@/services/kiloService';
import { webLLM } from '@/services/webLLM';
import { type LlmSource, AI_PRIORITY_DEFAULT } from '@/services/llmTypes';
import type { UserProfile } from '@/services/authService';
import { clearToken } from '@/services/tokenService';
import { closeDatabase } from '@/services/database';
import { setCacheUserId } from '@/services/cacheManager';
import { clearOutbox, pendingCount } from '@/services/syncOutbox';

interface AuthState {
  geminiApiKey: string | null;
  geminiConfigured: boolean;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  userId: string | null;
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  isAdmin: boolean;
  enableWebLLM: boolean;
  enableKiloFree: boolean;
  kiloApiKey: string | null;
  groqApiKey: string | null;
  groqConfigured: boolean;
  enableGroq: boolean;
  aiPriority: LlmSource[];
  householdId: string | null;
  householdName: string | null;
  householdRole: 'owner' | 'member' | null;
  supabaseEmail: string | null;
}

export interface AuthActions {
  setGeminiApiKey: (key: string | null) => void;
  setEnableWebLLM: (v: boolean) => void;
  setEnableKiloFree: (v: boolean) => void;
  setKiloApiKey: (key: string | null) => void;
  setGroqApiKey: (key: string | null) => void;
  setEnableGroq: (v: boolean) => void;
  setAiPriority: (order: LlmSource[]) => void;
  setHousehold: (
    info: {
      householdId: string;
      householdName: string;
      role: 'owner' | 'member';
    } | null,
  ) => void;
  setSupabaseEmail: (email: string | null) => void;
  /** @deprecated Prefer bootstrapSessionAfterAuth — kept for rare local profile hydrate */
  login: (email: string, profile: UserProfile) => void;
  logout: (opts?: { discardPending?: boolean }) => Promise<void>;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  setSession: (userId: string, token: string, expiresAt: number) => void;
  clearSession: () => void;
}

type AuthStore = AuthState & AuthActions;

function syncGeminiService(apiKey: string | null): void {
  if (apiKey) geminiService.configure(apiKey);
  else geminiService.disconnect();
}

function syncGroqService(apiKey: string | null): void {
  if (apiKey) groqService.configure(apiKey);
  else groqService.disconnect();
}

function syncKiloService(opts: { enabled: boolean; apiKey: string | null }): void {
  kiloService.setEnabled(opts.enabled);
  kiloService.configure(opts.apiKey);
}

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set, get) => ({
      geminiApiKey: null,
      geminiConfigured: false,
      enableWebLLM: true,
      enableKiloFree: true,
      kiloApiKey: null,
      groqApiKey: null,
      groqConfigured: false,
      enableGroq: true,
      aiPriority: AI_PRIORITY_DEFAULT,
      householdId: null,
      householdName: null,
      householdRole: null,
      supabaseEmail: null,
      isAuthenticated: false,
      userProfile: null,
      userId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      isAdmin: false,

      setGeminiApiKey: (geminiApiKey) => {
        set((state) => {
          state.geminiApiKey = geminiApiKey;
          state.geminiConfigured = !!geminiApiKey;
        });
        syncGeminiService(geminiApiKey);
      },

      setEnableWebLLM: (enableWebLLM) => {
        set((state) => {
          state.enableWebLLM = enableWebLLM;
        });
        webLLM.setDisabled(!enableWebLLM);
      },

      setEnableKiloFree: (enableKiloFree) => {
        set((state) => {
          state.enableKiloFree = enableKiloFree;
        });
        const { kiloApiKey } = get();
        syncKiloService({ enabled: enableKiloFree, apiKey: kiloApiKey });
      },

      setKiloApiKey: (kiloApiKey) => {
        set((state) => {
          state.kiloApiKey = kiloApiKey;
        });
        const { enableKiloFree } = get();
        syncKiloService({ enabled: enableKiloFree !== false, apiKey: kiloApiKey });
      },

      setGroqApiKey: (groqApiKey) => {
        set((state) => {
          state.groqApiKey = groqApiKey;
          state.groqConfigured = !!groqApiKey;
        });
        syncGroqService(groqApiKey);
      },

      setEnableGroq: (enableGroq) => {
        set((state) => {
          state.enableGroq = enableGroq;
        });
        groqService.setEnabled(enableGroq);
      },

      setAiPriority: (aiPriority) =>
        set((state) => {
          state.aiPriority = aiPriority;
        }),

      setHousehold: (info) =>
        set((state) => {
          if (!info) {
            state.householdId = null;
            state.householdName = null;
            state.householdRole = null;
            return;
          }
          state.householdId = info.householdId;
          state.householdName = info.householdName;
          state.householdRole = info.role;
        }),

      setSupabaseEmail: (supabaseEmail) =>
        set((state) => {
          state.supabaseEmail = supabaseEmail;
        }),

      login: (email, profile) => {
        set((state) => {
          state.isAuthenticated = true;
          state.userProfile = { ...profile, email: profile.email || email };
          state.supabaseEmail = email;
        });
      },

      logout: async (opts) => {
        const userId = get().userId;
        if (userId && pendingCount(userId) > 0 && !opts?.discardPending) {
          const { flushOutbox } = await import('@/services/syncEngine');
          if (navigator.onLine) {
            await flushOutbox(userId);
          }
        }
        clearToken();
        closeDatabase();
        setCacheUserId(null);
        if (userId) clearOutbox(userId);
        try {
          const { signOutSupabase } = await import('@/services/householdService');
          await signOutSupabase();
        } catch {
          // ignore
        }
        set((state) => {
          state.isAuthenticated = false;
          state.userProfile = null;
          state.userId = null;
          state.sessionToken = null;
          state.sessionExpiresAt = null;
          state.isAdmin = false;
          state.householdId = null;
          state.householdName = null;
          state.householdRole = null;
          state.supabaseEmail = null;
        });
      },

      updateUserProfile: (profile) =>
        set((state) => {
          if (state.userProfile) {
            state.userProfile = { ...state.userProfile, ...profile };
          }
        }),

      setSession: (userId, token, expiresAt) => {
        set((state) => {
          state.userId = userId;
          state.sessionToken = token;
          state.sessionExpiresAt = expiresAt;
        });
      },

      clearSession: () => {
        clearToken();
        set((state) => {
          state.userId = null;
          state.sessionToken = null;
          state.sessionExpiresAt = null;
        });
      },
    })),
    {
      name: 'ql-tc-auth',
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        geminiConfigured: !!state.geminiApiKey,
        enableWebLLM: state.enableWebLLM,
        enableKiloFree: state.enableKiloFree,
        kiloApiKey: state.kiloApiKey,
        groqApiKey: state.groqApiKey,
        enableGroq: state.enableGroq,
        aiPriority: state.aiPriority,
        // Do not persist isAuthenticated — AuthGuard restores from Supabase session
        userProfile: state.userProfile,
        userId: state.userId,
        isAdmin: state.isAdmin,
        householdId: state.householdId,
        householdName: state.householdName,
        householdRole: state.householdRole,
        supabaseEmail: state.supabaseEmail,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.geminiApiKey) {
          syncGeminiService(state.geminiApiKey);
          state.geminiConfigured = true;
        }
        if (state.groqApiKey) {
          syncGroqService(state.groqApiKey);
          state.groqConfigured = true;
        }
        syncKiloService({
          enabled: state.enableKiloFree !== false,
          apiKey: state.kiloApiKey ?? null,
        });
        webLLM.setDisabled(state.enableWebLLM === false);
        if (!state.aiPriority || state.aiPriority.length === 0) {
          state.aiPriority = AI_PRIORITY_DEFAULT;
        }
        state.isAuthenticated = false;
      },
    },
  ),
);
