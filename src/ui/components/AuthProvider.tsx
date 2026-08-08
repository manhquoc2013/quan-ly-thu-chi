/**
 * AuthProvider — Supabase auth state + sync engine while signed in.
 */

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getSupabase, isSupabaseConfigured } from '@/services/supabaseClient';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';
import { startSyncEngine } from '@/services/syncEngine';

export function AuthProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        useAuthStore.setState({
          isAuthenticated: false,
          userId: null,
          userProfile: null,
          sessionToken: null,
          sessionExpiresAt: null,
          householdId: null,
          householdName: null,
          householdRole: null,
          supabaseEmail: null,
        });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        const currentId = useAuthStore.getState().userId;
        if (!useAuthStore.getState().isAuthenticated || currentId !== session.user.id) {
          void bootstrapSessionAfterAuth().catch((err) => {
            console.error('[AuthProvider] bootstrap failed', err);
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    return startSyncEngine();
  }, [isAuthenticated]);

  return <>{children}</>;
}
