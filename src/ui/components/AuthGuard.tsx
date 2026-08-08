/**
 * AuthGuard — Supabase session gate + optional WebLLM load when enabled.
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AuthScreen } from '@/ui/screens/auth/AuthScreen';
import { OnboardingScreen } from '@/ui/screens/onboarding/OnboardingScreen';
import { useWebLLMLoad } from '@/ui/components/WebLLMLoader';
import { getSupabase, isSupabaseConfigured } from '@/services/supabaseClient';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';

function AuthGuardSpinner() {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-background"
      role="status"
      aria-label="Đang xác thực..."
    >
      <div className="animate-spin size-8 border-2 border-accent-fg border-t-transparent rounded-full" />
    </div>
  );
}

function MissingSupabaseScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">Chưa cấu hình cloud</h1>
        <p className="text-sm text-muted-foreground">
          Thêm <code className="text-xs">VITE_SUPABASE_URL</code> và{' '}
          <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> vào <code className="text-xs">.env</code> rồi
          restart <code className="text-xs">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storeName = useAuthStore((s) => s.userProfile?.storeName);
  const [ready, setReady] = useState(false);
  const { progress, done: llmDone } = useWebLLMLoad();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          if (!useAuthStore.getState().isAuthenticated || useAuthStore.getState().userId !== data.session.user.id) {
            await bootstrapSessionAfterAuth();
          }
        } else {
          useAuthStore.setState({
            isAuthenticated: false,
            userId: null,
            userProfile: null,
            sessionToken: null,
            sessionExpiresAt: null,
          });
        }
      } catch (err) {
        console.error('[AuthGuard] session check failed', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isSupabaseConfigured()) {
    return <MissingSupabaseScreen />;
  }

  if (!ready) {
    return <AuthGuardSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen />
        {!llmDone && (
          <div className="fixed bottom-4 right-4 z-50 w-64 bg-card/95 backdrop-blur border rounded-lg shadow-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>🐱 Đang tải AI...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-fg rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  if (!storeName) {
    return <OnboardingScreen />;
  }

  return (
    <>
      <Outlet />
      {!llmDone && <WebLLMFab progress={progress} />}
    </>
  );
}

function WebLLMFab({ progress }: { progress: number }) {
  return (
    <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 bg-card/90 backdrop-blur border rounded-full shadow-lg px-3 py-1.5">
      <span className="text-sm">🐱</span>
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-fg rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
    </div>
  );
}
