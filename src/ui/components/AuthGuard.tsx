/**
 * AuthGuard — Supabase session gate + animated mascot loading screen.
 */
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { CatBody, type Action } from '@/ui/components/MascotOverlay';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AuthScreen } from '@/ui/screens/auth/AuthScreen';
import { OnboardingScreen } from '@/ui/screens/onboarding/OnboardingScreen';
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

  // Phase 1: intro — cat walks in; letters start popping immediately (no wait)
  useEffect(() => {
    setPhase('intro');
    setCatAction('walk');
    const t = setTimeout(() => setCatX(0), 40);
    // Hop along title as soon as first letters are visible
    const t2 = setTimeout(() => { setPhase('reveal'); stepRef.current = 0; }, 80);
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
        timerRef.current = setTimeout(hopToNext, 40);
        return;
      }

      const wr = wrap.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const targetX = er.left - wr.left + er.width / 2 - 28;

      setCatAction('walk');
      setCatX(targetX);

      stepRef.current = idx + 1;
      // Keep pace with char stagger (0.06s) so cat lands as each letter pops
      timerRef.current = setTimeout(hopToNext, idx === 0 ? 90 : 70);
    }

    timerRef.current = setTimeout(hopToNext, 40);
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

  const bgUrl = `${import.meta.env.BASE_URL}auth-bg.png`;

  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-bg" style={{ backgroundImage: `url(${bgUrl})` }} />
      <div className="auth-loading-scrim" />
      <div className="auth-loading-content">
        <div className="auth-loading-stage">
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
                  style={{ animationDelay: `${i * 0.055}s` }}
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
          <p className="auth-loading-subtitle">
            Đang tải dữ liệu
            <span className="auth-dots"><span>.</span><span>.</span><span>.</span></span>
          </p>
        </div>
      </div>
      <style>{`
        .auth-loading-screen {
          position: relative; display: flex; align-items: center; justify-content: center;
          min-height: 100vh; overflow: hidden; background: #0a1628;
        }
        .auth-loading-bg {
          position: absolute; inset: -4%; background-size: cover; background-position: center;
          image-rendering: auto; opacity: 0.65;
          animation: auth-bg-drift 22s ease-in-out infinite alternate;
        }
        .auth-loading-scrim {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 50% at 50% 40%, transparent 0%, rgba(10,22,40,0.55) 60%, rgba(6,14,28,0.85) 100%);
        }
        .auth-loading-content {
          position: relative; z-index: 1; display: flex; flex-direction: column;
          align-items: center; padding: 32px;
        }
        .auth-loading-stage {
          display: flex; flex-direction: column; align-items: center; gap: 24px;
          padding: 40px 48px 36px; border-radius: 28px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          animation: auth-stage-in 0.6s ease-out both;
        }
        .auth-loading-logo {
          width: 80px; height: 80px; border-radius: 20px;
          box-shadow: 0 12px 36px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.1);
          animation: auth-logo-breathe 3s ease-in-out infinite;
        }
        .auth-loading-title-wrap {
          position: relative; display: flex; flex-direction: column;
          align-items: center; gap: 8px; padding-top: 32px; min-width: 240px;
        }
        .auth-loading-title {
          font-size: 1.5rem; font-weight: 700; color: #f1f5f9;
          letter-spacing: 0.02em; display: flex; gap: 2px;
          text-shadow: 0 2px 16px rgba(0,0,0,0.5);
        }
        .auth-loading-subtitle {
          font-size: 0.8rem; color: rgba(203,213,225,0.7); font-weight: 400;
          letter-spacing: 0.04em; text-shadow: 0 1px 4px rgba(0,0,0,0.4);
          animation: auth-fade-in 0.5s 0.8s ease-out both;
        }
        .auth-char {
          display: inline-block; opacity: 0;
          animation: auth-char-pop 0.35s ease-out forwards;
        }
        .auth-cat {
          position: absolute; left: -40px; top: -28px;
          filter: drop-shadow(0 8px 18px rgba(0,0,0,0.5));
          pointer-events: none; z-index: 2;
        }
        @keyframes auth-bg-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-1.5%, 1%); }
        }
        @keyframes auth-stage-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auth-logo-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes auth-char-pop {
          0% { opacity: 0; transform: translateY(8px) scale(0.85); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auth-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-dots span { animation: auth-dot-bounce 1.4s ease-in-out infinite; }
        .auth-dots span:nth-child(2) { animation-delay: 0.2s; }
        .auth-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes auth-dot-bounce {
          0%, 80%, 100% { opacity: 0; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

/* ═══ Rest of AuthGuard ═══ */

export function AuthGuard({ children }: { children?: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
  const storeName = useAuthStore((s) => s.userProfile?.storeName?.trim() ?? '');
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
    // AuthScreen mounts interactive MascotOverlay on the login form
    return <AuthScreen />;
  }

  if (fullyReady && isAuthenticated && userId) {
    // Only first-time users without store info — household is optional (Settings).
    if (!storeName) return <OnboardingScreen />;
    return <>{children ?? <Outlet />}</>;
  }

  return <AuthGuardSpinner />;
}
