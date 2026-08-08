/**
 * AuthGuard — Supabase session gate + animated mascot loading screen.
 */
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { CatBody, type Action } from '@/ui/components/MascotOverlay';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AuthScreen } from '@/ui/screens/auth/AuthScreen';
import { OnboardingScreen } from '@/ui/screens/onboarding/OnboardingScreen';
import { useWebLLMLoad } from '@/ui/components/WebLLMLoader';
import { getSupabase, isSupabaseConfigured } from '@/services/supabaseClient';
import { bootstrapSessionAfterAuth } from '@/services/sessionBootstrap';

function AuthGuardSpinner() {
  const titleChars = [...'Quản Lý Tài Chính'];
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'intro' | 'reveal' | 'play'>('intro');
  const [catAction, setCatAction] = useState<Action>('idle');
  const [catX, setCatX] = useState(-40);
  const [catOnTitle, setCatOnTitle] = useState(false);
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 1: intro — cat walks in from left
  useEffect(() => {
    setPhase('intro');
    setCatAction('walk');
    const t = setTimeout(() => setCatX(0), 100);
    const t2 = setTimeout(() => { setPhase('reveal'); stepRef.current = 0; }, 800);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  // Phase 2: reveal — cat hops to each character as it appears
  useEffect(() => {
    if (phase !== 'reveal') return;

    function hopToNext() {
      const idx = stepRef.current;
      if (idx >= titleChars.length) {
        // All chars revealed → play phase
        setPhase('play');
        return;
      }

      const el = charRefs.current[idx];
      const wrap = wrapRef.current;
      if (!el || !wrap) {
        stepRef.current = 0;
        timerRef.current = setTimeout(hopToNext, 60);
        return;
      }

      const wr = wrap.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const targetX = er.left - wr.left + er.width / 2 - 28;

      setCatAction('walk');
      setCatX(targetX);

      stepRef.current = idx + 1;
      timerRef.current = setTimeout(hopToNext, idx === 0 ? 180 : 80);
    }

    timerRef.current = setTimeout(hopToNext, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, titleChars.length]);

  // Phase 3: play — random actions along the title
  useEffect(() => {
    if (phase !== 'play') return;

    const actions: Action[] = ['walk', 'jump', 'spin', 'walk', 'jump', 'walk', 'spin', 'jump', 'climb'];
    let i = 0;
    let onTitle = false;

    function nextAction() {
      const act = actions[i % actions.length]!;
      i++;

      if (act === 'climb' && !onTitle) {
        // Jump onto the title text
        setCatAction('jump');
        setCatOnTitle(true);
        onTitle = true;
        setTimeout(() => setCatAction('climb'), 400);
        timerRef.current = setTimeout(nextAction, 1500);
      } else if (act === 'walk') {
        setCatAction('walk');
        // Walk back and forth along the title
        const wrap = wrapRef.current;
        if (wrap) {
          const w = wrap.getBoundingClientRect().width;
          setCatX(i % 4 < 2 ? 10 : Math.max(10, w - 70));
        }
        timerRef.current = setTimeout(nextAction, 1200);
      } else if (act === 'jump') {
        setCatAction('jump');
        timerRef.current = setTimeout(nextAction, 800);
      } else if (act === 'spin') {
        setCatAction('spin');
        timerRef.current = setTimeout(nextAction, 900);
      }
    }

    timerRef.current = setTimeout(nextAction, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-bg" />
      <div className="auth-loading-content">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="Quản Lý Tài Chính"
          className="auth-loading-logo"
        />
        <div ref={wrapRef} className="auth-loading-title-wrap">
          <h1 className="auth-loading-title">
            {titleChars.map((ch, i) => (
              <span
                key={i}
                ref={(el) => { charRefs.current[i] = el; }}
                className="auth-char"
                style={{ animationDelay: phase === 'intro' ? '99s' : `${i * 0.06}s` }}
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </h1>
          <span
            className="auth-cat"
            style={{
              width: 56, height: 58, display: 'inline-block',
              left: catX, top: catOnTitle ? -58 : -28,
              transition: 'left 0.3s ease-out, top 0.4s ease-out',
            }}
          >
            <CatBody emotion="happy" action={catAction} />
          </span>
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
          padding-top: 36px;
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
          left: -40px;
          top: -28px;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
          pointer-events: none;
          z-index: 2;
        }
        @keyframes auth-logo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes auth-char-pop {
          0% { opacity: 0; transform: translateY(6px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ═══ Rest of AuthGuard ═══ */

function WebLLMFab({ progress }: { progress: number }) {
  return (
    <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 bg-card/90 backdrop-blur border rounded-full shadow-lg px-3 py-1.5">
      <span className="text-sm" style={{ width: 36, height: 38, display: 'inline-block' }}>
        <CatBody emotion="thinking" action="walk" />
      </span>
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-fg rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children?: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
  const { progress } = useWebLLMLoad();
  const [checking, setChecking] = useState(true);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [fullyReady, setFullyReady] = useState(false);

  // Restore Supabase session
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) { setSupabaseReady(true); setChecking(false); setFullyReady(true); }
        return;
      }
      try {
        const sb = getSupabase();
        const { data } = await sb.auth.getSession();
        if (!cancelled && data.session?.user) {
          await bootstrapSessionAfterAuth();
        }
      } catch { /* offline / not configured */ }
      if (!cancelled) { setSupabaseReady(true); setChecking(false); setFullyReady(true); }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  if (checking) return <AuthGuardSpinner />;

  if (fullyReady && !isAuthenticated && supabaseReady) {
    return (
      <>
        <AuthScreen />
        {progress < 100 && <WebLLMFab progress={progress} />}
      </>
    );
  }

  if (fullyReady && isAuthenticated && userId) {
    const needsOnboarding = !useAuthStore.getState().householdId;
    if (needsOnboarding) return <OnboardingScreen />;
    return <>{children ?? <Outlet />}</>;
  }

  return <AuthGuardSpinner />;
}
