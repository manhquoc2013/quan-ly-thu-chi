/**
 * AuthProvider — token auto-refresh and visibility-aware session management.
 *
 * - On mount: verifies the stored session token.
 * - Schedules periodic token refresh based on expiry time.
 * - Pauses refresh timers when the tab is hidden; resumes on focus.
 *
 * Must wrap all authenticated routes.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  getStoredToken,
  verifyToken,
  isTokenExpired,
  getRemainingTime,
  clearToken,
  generateToken,
} from '@/services/tokenService';
import { getUserCredentials, clearAuth } from '@/services/authService';

export function AuthProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userProfile = useAuthStore((s) => s.userProfile);
  const logout = useAuthStore((s) => s.logout);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !userProfile) return;

    let cancelled = false;

    const scheduleRefresh = async () => {
      if (cancelled) return;

      const token = getStoredToken();
      if (!token) {
        logout();
        clearAuth();
        return;
      }

      const creds = getUserCredentials();
      if (!creds) {
        logout();
        clearToken();
        clearAuth();
        return;
      }

      try {
        const sigValid = await verifyToken(token, creds.passwordHash);
        if (!sigValid || isTokenExpired(token)) {
          logout();
          clearToken();
          clearAuth();
          return;
        }

        const remaining = getRemainingTime(token);

        // If less than 1 hour remaining, refresh silently
        if (remaining < 60 * 60 * 1000 && remaining > 0) {
          const { useAuthStore: store } = await import('@/store/authStore');
          const userId = store.getState().userId;
          if (userId) {
            await generateToken(userId, creds.passwordHash);
          }
        }

        if (cancelled) return;

        // Schedule next check: half the remaining time or 1 hour, whichever is less
        const nextCheck = remaining > 0 ? Math.min(remaining / 2, 60 * 60 * 1000) : 5 * 60 * 1000;
        refreshTimerRef.current = setTimeout(() => {
          void scheduleRefresh();
        }, nextCheck);
        scheduledRef.current = true;
      } catch {
        logout();
        clearToken();
        clearAuth();
      }
    };

    void scheduleRefresh();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      scheduledRef.current = false;
    };
  }, [isAuthenticated, userProfile, logout]);

  // Pause/resume on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
          scheduledRef.current = false;
        }
      } else {
        if (isAuthenticated && userProfile && !scheduledRef.current) {
          const token = getStoredToken();
          if (!token) {
            logout();
            clearAuth();
            return;
          }

          const creds = getUserCredentials();
          if (!creds) {
            logout();
            clearToken();
            clearAuth();
            return;
          }

          verifyToken(token, creds.passwordHash)
            .then((sigValid) => {
              if (!sigValid || isTokenExpired(token)) {
                logout();
                clearToken();
                clearAuth();
              }
            })
            .catch(() => {
              logout();
              clearToken();
              clearAuth();
            });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isAuthenticated, userProfile, logout]);

  return <>{children}</>;
}
