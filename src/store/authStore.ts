/**
 * Auth Store — Google Drive connection, Gemini API key, user info, session management.
 *
 * Persists Gemini API key and auth state to localStorage so it survives reload.
 * Session tokens are stored in sessionStorage (not persisted to localStorage).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { geminiService } from '@/services/geminiService';
import { kiloService } from '@/services/kiloService';
import type { UserProfile } from '@/services/authService';
import { getUserCredentials, getUserByEmail } from '@/services/authService';
import { generateToken, storeToken, clearToken, getStoredToken, isTokenExpired } from '@/services/tokenService';
import { closeDatabase, initDatabase, getOrCreateEncryptionKey } from '@/services/database';
import { setCacheUserId } from '@/services/cacheManager';

const encoder = new TextEncoder();

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

interface AuthState {
  // Google Drive / Gemini state
  isGoogleConnected: boolean;
  googleUser: GoogleUser | null;
  geminiApiKey: string | null;
  geminiConfigured: boolean;
  // EmailJS state
  emailjsServiceId: string | null;
  emailjsTemplateId: string | null;
  emailjsPublicKey: string | null;
  emailjsPrivateKey: string | null;
  emailjsConfigured: boolean;
  // Local email auth state (Wave 1)
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  // Session management (Wave 1.5)
  userId: string | null;
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  // Admin flag
  isAdmin: boolean;
  // WebLLM toggle
  enableWebLLM: boolean;
  // Kilo Free cloud (default on when online)
  enableKiloFree: boolean;
  kiloApiKey: string | null;
}

export interface AuthActions {
  // Google Drive / Gemini actions
  setGoogleConnected: (isGoogleConnected: boolean) => void;
  setGoogleUser: (googleUser: GoogleUser | null) => void;
  setGeminiApiKey: (key: string | null) => void;
  disconnectGoogle: () => void;
  // EmailJS actions
  setEmailJSConfig: (config: { serviceId: string; templateId: string; publicKey: string; privateKey?: string }) => void;
  clearEmailJSConfig: () => void;
  // WebLLM toggle
  setEnableWebLLM: (v: boolean) => void;
  // Kilo Free
  setEnableKiloFree: (v: boolean) => void;
  setKiloApiKey: (key: string | null) => void;
  // Local email auth actions (Wave 1)
  login: (email: string, profile: UserProfile) => void;
  logout: () => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  // Session management (Wave 1.5)
  setSession: (userId: string, token: string, expiresAt: number) => void;
  clearSession: () => void;
}

type AuthStore = AuthState & AuthActions;

function syncGeminiService(apiKey: string | null): void {
  if (apiKey) geminiService.configure(apiKey);
  else geminiService.disconnect();
}

function syncKiloService(opts: { enabled: boolean; apiKey: string | null }): void {
  kiloService.setEnabled(opts.enabled);
  kiloService.configure(opts.apiKey);
}

/** Derive a user ID from an email address using SHA-256. */
async function deriveUserId(email: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(email.toLowerCase()));
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set) => ({
      // Google Drive / Gemini state
      isGoogleConnected: false,
      googleUser: null,
      geminiApiKey: null,
      geminiConfigured: false,
      // EmailJS state
      emailjsServiceId: null,
      emailjsTemplateId: null,
      emailjsPublicKey: null,
      emailjsPrivateKey: null,
      emailjsConfigured: false,
      // WebLLM toggle (default: enabled)
      enableWebLLM: true,
      // Kilo Free (default: on — cloud free before Gemini/WebLLM)
      enableKiloFree: true,
      kiloApiKey: null,
      // Local email auth state (Wave 1)
      isAuthenticated: false,
      userProfile: null,
      // Session management (Wave 1.5)
      userId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      // Admin flag
      isAdmin: false,

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

      // EmailJS actions
      setEmailJSConfig: (config) =>
        set((state) => {
          state.emailjsServiceId = config.serviceId;
          state.emailjsTemplateId = config.templateId;
          state.emailjsPublicKey = config.publicKey;
          state.emailjsPrivateKey = config.privateKey ?? null;
          state.emailjsConfigured = !!(config.serviceId && config.templateId && config.publicKey);
        }),

      clearEmailJSConfig: () =>
        set((state) => {
          state.emailjsServiceId = null;
          state.emailjsTemplateId = null;
          state.emailjsPublicKey = null;
          state.emailjsPrivateKey = null;
          state.emailjsConfigured = false;
        }),

      // WebLLM toggle
      setEnableWebLLM: (enableWebLLM) =>
        set((state) => {
          state.enableWebLLM = enableWebLLM;
        }),

      setEnableKiloFree: (enableKiloFree) => {
        set((state) => {
          state.enableKiloFree = enableKiloFree;
        });
        const { kiloApiKey } = useAuthStore.getState();
        syncKiloService({ enabled: enableKiloFree, apiKey: kiloApiKey });
      },

      setKiloApiKey: (kiloApiKey) => {
        set((state) => {
          state.kiloApiKey = kiloApiKey;
        });
        const { enableKiloFree } = useAuthStore.getState();
        syncKiloService({ enabled: enableKiloFree !== false, apiKey: kiloApiKey });
      },

      // Local email auth actions (Wave 1)
      login: async (email, profile) => {
        const userId = await deriveUserId(email);
        const creds = getUserByEmail(email);
        let token: string | null = null;
        let expiresAt: number | null = null;
        if (creds?.passwordHash) {
          const now = Date.now();
          token = await generateToken(userId, creds.passwordHash);
          expiresAt = now + 24 * 60 * 60 * 1000;
          storeToken(token);
          // Wire DB encryption
          try {
            const dbKey = await getOrCreateEncryptionKey(creds.passwordHash, userId);
            await initDatabase(userId, dbKey);
            setCacheUserId(userId);
          } catch (err) {
            console.error('Failed to initialize encrypted database:', err);
          }
        }
        set((state) => {
          state.isAuthenticated = true;
          state.userProfile = { ...profile };
          state.userId = userId;
          state.sessionToken = token;
          state.sessionExpiresAt = expiresAt;
          state.isAdmin = creds?.isAdmin ?? false;
        });
      },

      logout: () => {
        clearToken();
        closeDatabase();
        setCacheUserId(null);
        set((state) => {
          state.isAuthenticated = false;
          state.userProfile = null;
          state.userId = null;
          state.sessionToken = null;
          state.sessionExpiresAt = null;
          state.isAdmin = false;
        });
      },

      updateUserProfile: (profile) =>
        set((state) => {
          if (state.userProfile) {
            state.userProfile = { ...state.userProfile, ...profile };
          }
        }),

      // Session management (Wave 1.5)
      setSession: (userId, token, expiresAt) => {
        storeToken(token);
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
        emailjsServiceId: state.emailjsServiceId,
        emailjsTemplateId: state.emailjsTemplateId,
        emailjsPublicKey: state.emailjsPublicKey,
        emailjsPrivateKey: state.emailjsPrivateKey,
        emailjsConfigured: state.emailjsConfigured,
        enableWebLLM: state.enableWebLLM,
        enableKiloFree: state.enableKiloFree,
        kiloApiKey: state.kiloApiKey,
        isAuthenticated: state.isAuthenticated,
        userProfile: state.userProfile,
        userId: state.userId,
        sessionExpiresAt: state.sessionExpiresAt,
        isAdmin: state.isAdmin,
      }),
      onRehydrateStorage: () => async (state) => {
        if (state?.geminiApiKey) {
          syncGeminiService(state.geminiApiKey);
          state.geminiConfigured = true;
        }
        syncKiloService({
          enabled: state?.enableKiloFree !== false,
          apiKey: state?.kiloApiKey ?? null,
        });
        if (state && state.enableKiloFree === undefined) {
          state.enableKiloFree = true;
        }
        if (state?.userId && state?.isAuthenticated) {
          const storedToken = getStoredToken();
          if (!storedToken || isTokenExpired(storedToken)) {
            state.isAuthenticated = false;
            state.sessionToken = null;
            state.sessionExpiresAt = null;
            clearToken();
          } else {
            // Restore DB encryption
            try {
              const creds = getUserCredentials();
              if (creds?.passwordHash) {
                const dbKey = await getOrCreateEncryptionKey(creds.passwordHash, state.userId);
                await initDatabase(state.userId, dbKey);
                setCacheUserId(state.userId);
              }
            } catch {
              // non-critical
            }
          }
        }
      },
    },
  ),
);
