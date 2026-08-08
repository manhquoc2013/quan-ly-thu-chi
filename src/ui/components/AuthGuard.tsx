/**
 * AuthGuard — Supabase session gate + optional WebLLM load when enabled.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AuthScreen } from '@/ui/screens/auth/AuthScreen';
import { OnboardingScreen } from '@/ui/screens/onboarding/OnboardingScreen';
import { useWebLLMLoad } from '@/ui/components/WebLLMLoader';
import { getSupabase, isSupabaseConfigured } from '@/services/supabaseClient';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';

function AuthGuardSpinner() {
  const titleChars = [...'Quản Lý Tài Chính'];
  const catRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const cat = catRef.current;
    if (!cat) return;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    function hop() {
      const el = charRefs.current[step];
      if (!el || !cat) { step = 0; timer = setTimeout(hop, 70); return; }
      const wrap = el.parentElement?.getBoundingClientRect();
      const rc = el.getBoundingClientRect();
      if (!wrap) return;
      cat.style.left = `${rc.left - wrap.left + rc.width / 2 - 8}px`;
      cat.style.transform = 'translateY(-14px) rotate(-8deg)';
      setTimeout(() => { if (cat) cat.style.transform = 'translateY(0) rotate(0deg)'; }, 100);
      step = (step + 1) % titleChars.length;
      timer = setTimeout(hop, step === 0 ? 140 : 70);
    }

    timer = setTimeout(hop, 120);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-bg" />
      <div className="auth-loading-content">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="Quản Lý Tài Chính"
          className="auth-loading-logo"
        />
        <div className="auth-loading-title-wrap">
          <h1 className="auth-loading-title">
            {titleChars.map((ch, i) => (
              <span
                key={i}
                ref={(el) => { charRefs.current[i] = el; }}
                className="auth-char"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </h1>
          <span ref={catRef} className="auth-cat">🐱</span>
        </div>
      </div>
      <style>{`
        .auth-loading-screen {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
        }
        .auth-loading-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 30% 20%, rgba(13,148,136,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 75% 75%, rgba(20,184,166,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(15,118,110,0.08) 0%, transparent 60%),
            linear-gradient(160deg, #0a1628 0%, #0f1f3a 40%, #132840 70%, #0d1a2d 100%);
        }
        .auth-loading-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 15% 25%, rgba(255,255,255,0.03) 0%, transparent 50%),
            radial-gradient(circle at 85% 60%, rgba(255,255,255,0.02) 0%, transparent 40%),
            radial-gradient(circle at 50% 85%, rgba(13,148,136,0.06) 0%, transparent 45%);
        }
        .auth-loading-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(255,255,255,0.008) 60px, rgba(255,255,255,0.008) 61px),
            repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.008) 60px, rgba(255,255,255,0.008) 61px);
        }
        .auth-loading-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .auth-loading-logo {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(13,148,136,0.25);
          animation: auth-logo-breathe 2.5s ease-in-out infinite;
        }
        .auth-loading-title-wrap {
          position: relative;
          display: inline-block;
        }
        .auth-loading-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #e2e8f0;
          display: flex;
          gap: 1px;
        }
        .auth-char {
          display: inline-block;
          opacity: 0;
          animation: auth-char-pop 0.35s ease-out forwards;
        }
        .auth-cat {
          position: absolute;
          top: -28px;
          left: -8px;
          font-size: 1.1rem;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          pointer-events: none;
          z-index: 2;
          transition: left 0.08s ease-out, transform 0.12s ease-out;
        }
        @keyframes auth-logo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes auth-char-pop {
          0% { opacity: 0; transform: translateY(10px) scale(0.5); }
          60% { opacity: 1; transform: translateY(-3px) scale(1.1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auth-cat-hop {
          0%   { left: -8px;  transform: translateY(0) rotate(0deg); }
          5%   { left: 0px;   transform: translateY(-14px) rotate(-8deg); }
          10%  { left: 8px;   transform: translateY(0) rotate(0deg); }
          15%  { left: 16px;  transform: translateY(-14px) rotate(8deg); }
          20%  { left: 24px;  transform: translateY(0) rotate(0deg); }
          25%  { left: 32px;  transform: translateY(-14px) rotate(-6deg); }
          30%  { left: 40px;  transform: translateY(0) rotate(0deg); }
          35%  { left: 48px;  transform: translateY(-14px) rotate(6deg); }
          40%  { left: 56px;  transform: translateY(0) rotate(0deg); }
          45%  { left: 64px;  transform: translateY(-14px) rotate(-8deg); }
          50%  { left: 74px;  transform: translateY(0) rotate(0deg); }
          55%  { left: 82px;  transform: translateY(-14px) rotate(8deg); }
          60%  { left: 90px;  transform: translateY(0) rotate(0deg); }
          65%  { left: 98px;  transform: translateY(-14px) rotate(-6deg); }
          70%  { left: 106px; transform: translateY(0) rotate(0deg); }
          75%  { left: 114px; transform: translateY(-14px) rotate(6deg); }
          80%  { left: 122px; transform: translateY(0) rotate(0deg); }
          85%  { left: 130px; transform: translateY(-14px) rotate(-8deg); }
          90%  { left: 138px; transform: translateY(0) rotate(0deg); }
          95%  { left: 146px; transform: translateY(-10px) rotate(8deg); }
          100% { left: 154px; transform: translateY(0) rotate(0deg); }
        }
      `}</style>
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

export function AuthGuard({ children }: { children?: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storeName = useAuthStore((s) => s.userProfile?.storeName);
  const [ready, setReady] = useState(false);
  // Only eager-load WebLLM after login (never on AuthScreen / cold Pages visit)
  const { progress, done: llmDone } = useWebLLMLoad({ enabled: isAuthenticated });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const maxRetries = 3;

    const tryGetSession = async (): Promise<boolean> => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (cancelled) return true;
        if (data.session?.user) {
          if (!useAuthStore.getState().isAuthenticated || useAuthStore.getState().userId !== data.session.user.id) {
            await bootstrapSessionAfterAuth();
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error('[AuthGuard] session check failed', err);
        return false;
      }
    };

    const attempt = async () => {
      for (let i = 0; i < maxRetries; i++) {
        const ok = await tryGetSession();
        if (ok) { if (!cancelled) setReady(true); return; }
        if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 500));
      }
      // All retries failed — genuinely no session
      useAuthStore.setState({
        isAuthenticated: false, userId: null, userProfile: null,
        sessionToken: null, sessionExpiresAt: null,
      });
      if (!cancelled) setReady(true);
    };

    void attempt();
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
    return <AuthScreen />;
  }

  if (!storeName) {
    return <OnboardingScreen />;
  }

  return (
    <>
      {children || <Outlet />}
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
