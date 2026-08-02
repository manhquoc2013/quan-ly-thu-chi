/**
 * AuthGuard — route-level authentication gate.
 *
 * - While zustand persist is hydrating, renders a centered spinner.
 * - When not authenticated, renders <AuthScreen /> standalone (no layout).
 * - When authenticated, renders the nested <Outlet />.
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AuthScreen } from '@/ui/screens/auth/AuthScreen';
import { OnboardingScreen } from '@/ui/screens/onboarding/OnboardingScreen';
import { Outlet } from 'react-router-dom';
import { initAdminAccount } from '@/services/authService';
import { useWebLLMLoad } from '@/ui/components/WebLLMLoader';

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

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Zustand persist hydration tracking (zustand v5)
  const [hydrated, setHydrated] = useState(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    useAuthStore.persist?.hasHydrated?.() ?? false,
  );
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Ensure admin account exists before showing auth screen
  useEffect(() => {
    void initAdminAccount().then(() => setBootstrapped(true));
  }, []);

  // Eager-load WebLLM model (non-blocking — show subtle progress indicator)
  const { progress, done: llmDone } = useWebLLMLoad();

  // Still hydrating or bootstrapping — show spinner
  if (!hydrated || !bootstrapped) {
    return <AuthGuardSpinner />;
  }

  // Not authenticated — show auth screen standalone (no layout)
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

  // Authenticated but no store name → onboarding
  if (isAuthenticated) {
    const storeName = useAuthStore.getState().userProfile?.storeName;
    if (!storeName) {
      return <OnboardingScreen />;
    }
  }

  // Authenticated — render child routes
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
