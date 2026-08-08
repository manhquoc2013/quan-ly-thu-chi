/**
 * MascotOverlay — Physics-bound cat with smooth animations.
 */
import { useMascotStore } from '@/store/mascotStore';
import { useState, useEffect, useRef, useCallback } from 'react';

type Action = 'idle' | 'walk' | 'jump' | 'climb' | 'grapple' | 'spin' | 'flinch' | 'tossed';
export type { Action };
interface Platform { top: number; left: number; right: number; bottom: number; }

const W = 80, H = 82;
const MARGIN = 10;

/* ═══ SVG Cat — smooth body-part animations ═══ */

export function CatBody({ emotion, action }: { emotion: string; action: Action }) {
  const happy = emotion === 'happy' || emotion === 'celebrate';
  const walk = action === 'walk', climb = action === 'climb', grapple = action === 'grapple';
  const flinch = action === 'flinch', idle = action === 'idle';
  const ex = happy ? '3' : '4.5', ey = happy ? '2' : '4.5';
  const px = happy ? '49' : '50', py = happy ? '41' : '40';

  // Walk cycle: smooth pendulum with easing
  const walkLegVals = '0 45 115; -4 45 115; -8 45 115; -4 45 115; 0 45 115; 4 45 115; 8 45 115; 4 45 115; 0 45 115';
  const walkArmVals = '15 28 90; 10 28 90; 0 28 90; -10 28 90; -15 28 90; -10 28 90; 0 28 90; 10 28 90; 15 28 90';
  const walkArmValsR = '-15 92 90; -10 92 90; 0 92 90; 10 92 90; 15 92 90; 10 92 90; 0 92 90; -10 92 90; -15 92 90';

  return (
    <svg width={W} height={H} viewBox="0 0 140 125" className="drop-shadow-lg" overflow="visible">
      {/* Tail — wider viewBox to prevent clipping */}
      <path d="M95 75 Q118 68 128 82 Q132 98 110 95" fill="none" stroke="#E67E22" strokeWidth="6" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate"
          values={flinch ? '12 95 75;22 95 75;12 95 75' : '-6 95 75;8 95 75;-6 95 75'}
          dur={flinch ? '0.2s' : walk ? '0.8s' : '2s'} repeatCount="indefinite"
          calcMode="spline" keySplines={flinch ? '0.4 0 0.6 1;0.4 0 0.6 1' : '0.4 0 0.6 1;0.4 0 0.6 1'} />
      </path>

      {/* Hind legs — smooth alternating pendulum */}
      <g>
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values={walk ? walkLegVals : '0 45 115'}
            dur={walk ? '0.9s' : '1s'} repeatCount="indefinite"
            calcMode={walk ? 'spline' : 'linear'}
            keySplines={walk ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : undefined} />
          <ellipse cx="45" cy="115" rx="14" ry="8" fill="#E67E22" />
          <ellipse cx="45" cy="113" rx="10" ry="5" fill="#F5CBA7" />
        </g>
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values={walk ? '0 75 115; 4 75 115; 8 75 115; 4 75 115; 0 75 115; -4 75 115; -8 75 115; -4 75 115; 0 75 115' : '0 75 115'}
            dur={walk ? '0.9s' : '1s'} repeatCount="indefinite"
            calcMode={walk ? 'spline' : 'linear'}
            keySplines={walk ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : undefined} />
          <ellipse cx="75" cy="115" rx="14" ry="8" fill="#E67E22" />
          <ellipse cx="75" cy="113" rx="10" ry="5" fill="#F5CBA7" />
        </g>
      </g>

      {/* Body — gentle bob */}
      <g>
        <animateTransform attributeName="transform" type="translate"
          values={walk ? '0 0; 0 -2; 0 -3; 0 -2; 0 0; 0 2; 0 3; 0 2; 0 0' : climb ? '0 0; -1 -3; -2 -4; -1 -3; 0 0' : '0 0'}
          dur={walk ? '0.9s' : climb ? '0.7s' : '1s'} repeatCount="indefinite"
          calcMode={walk ? 'spline' : 'linear'}
          keySplines={walk ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : undefined} />
        <ellipse cx="60" cy="80" rx="35" ry="30" fill="#F39C12" />
        <ellipse cx="60" cy="88" rx="22" ry="18" fill="#FDEBD0" />
        {idle && (
          <ellipse cx="60" cy="80" rx="35" ry="30" fill="none" stroke="#FDEBD0" strokeWidth="2">
            <animate attributeName="opacity" values="0;0.12;0" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="rx" values="35;37;35" dur="3.5s" repeatCount="indefinite" />
          </ellipse>
        )}
      </g>

      {/* Front arms — smooth swinging */}
      <g>
        <animateTransform attributeName="transform" type="rotate"
          values={walk ? walkArmVals : climb ? '30 28 90; 20 28 90; 5 28 90; -5 28 90; -10 28 90; -5 28 90; 5 28 90; 20 28 90; 30 28 90' : grapple ? '-25 28 90; -15 28 90; -25 28 90' : '15 28 90'}
          dur={walk ? '0.9s' : climb ? '0.8s' : grapple ? '0.5s' : '1s'} repeatCount="indefinite"
          calcMode={walk || climb ? 'spline' : 'linear'}
          keySplines={walk ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : climb ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : undefined} />
        <ellipse cx="28" cy="90" rx="8" ry="12" fill="#F39C12" />
        <ellipse cx="26" cy="100" rx="7" ry="5" fill="#F5CBA7" />
      </g>
      <g>
        <animateTransform attributeName="transform" type="rotate"
          values={walk ? walkArmValsR : climb ? '-30 92 90; -20 92 90; -5 92 90; 5 92 90; 10 92 90; 5 92 90; -5 92 90; -20 92 90; -30 92 90' : grapple ? '25 92 90; 15 92 90; 25 92 90' : '-15 92 90'}
          dur={walk ? '0.9s' : climb ? '0.8s' : grapple ? '0.5s' : '1s'} repeatCount="indefinite"
          calcMode={walk || climb ? 'spline' : 'linear'}
          keySplines={walk ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : climb ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : undefined} />
        <ellipse cx="92" cy="90" rx="8" ry="12" fill="#F39C12" />
        <ellipse cx="94" cy="100" rx="7" ry="5" fill="#F5CBA7" />
      </g>

      {/* Head */}
      <g>
        <animateTransform attributeName="transform" type="translate"
          values={walk ? '0 0; 1 -1; 1 0; 1 -1; 0 0; -1 1; -1 0; -1 1; 0 0' : flinch ? '0 0; 0 -2; 0 0' : '0 0'}
          dur={flinch ? '0.15s' : walk ? '0.9s' : '1s'} repeatCount="indefinite"
          calcMode={walk ? 'spline' : 'linear'}
          keySplines={walk ? '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1' : undefined} />
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values={idle ? '0 60 45; 2 60 45; 0 60 45; -1.5 60 45; 0 60 45' : '0 60 45'}
            dur={idle ? '6s' : '1s'} repeatCount="indefinite"
            calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
          <ellipse cx="60" cy="45" rx="30" ry="27" fill="#F39C12" />
          <polygon points="33,30 28,5 45,20" fill="#F39C12" /><polygon points="35,25 32,12 42,20" fill="#F5B7B1" />
          <polygon points="87,30 92,5 75,20" fill="#F39C12" /><polygon points="85,25 88,12 78,20" fill="#F5B7B1" />
          {idle && <polygon points="33,30 28,5 45,20" fill="#FDEBD0">
            <animate attributeName="opacity" values="0;0;0;0.15;0" dur="7s" repeatCount="indefinite" />
          </polygon>}
          <ellipse cx="60" cy="52" rx="22" ry="17" fill="#FDEBD0" />
          {/* Eyes */}
          <ellipse cx="48" cy="42" rx={ex} ry={ey} fill="#2C3E50">
            <animate attributeName="ry" values={flinch ? `${ey};0.2;0.2;${ey}` : `${ey};${ey};0.2;${ey}`}
              keyTimes={flinch ? '0;0.2;0.5;1' : '0;0.92;0.96;1'} dur={flinch ? '0.3s' : '3.5s'} repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="72" cy="42" rx={ex} ry={ey} fill="#2C3E50">
            <animate attributeName="ry" values={flinch ? `${ey};0.2;0.2;${ey}` : `${ey};${ey};0.2;${ey}`}
              keyTimes={flinch ? '0;0.2;0.5;1' : '0;0.92;0.96;1'} dur={flinch ? '0.3s' : '3.5s'} repeatCount="indefinite" />
          </ellipse>
          <circle cx={px} cy={py} r="2" fill="white" />
          <circle cx={happy ? '73' : '74'} cy={py} r="2" fill="white" />
          {flinch && (<>
            <line x1="42" y1="36" x2="54" y2="48" stroke="#E74C3C" strokeWidth="1">
              <animate attributeName="opacity" values="0;0.6;0" dur="0.35s" fill="freeze" /></line>
            <line x1="78" y1="36" x2="66" y2="48" stroke="#E74C3C" strokeWidth="1">
              <animate attributeName="opacity" values="0;0.6;0" dur="0.35s" fill="freeze" /></line>
          </>)}
          <ellipse cx="60" cy="52" rx="3" ry="2" fill="#E74C3C" />
          {happy ? <path d="M54 56 Q60 62 66 56" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
          : emotion === 'sad' ? <path d="M54 58 Q60 54 66 58" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
          : flinch ? <ellipse cx="60" cy="57" rx="5" ry="3" fill="#2C3E50" />
          : <line x1="56" y1="57" x2="64" y2="57" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />}
          <line x1="28" y1="50" x2="42" y2="52" stroke="#BDC3C7" strokeWidth="0.6" />
          <line x1="28" y1="54" x2="42" y2="54" stroke="#BDC3C7" strokeWidth="0.6" />
          <line x1="78" y1="52" x2="92" y2="50" stroke="#BDC3C7" strokeWidth="0.6" />
          <line x1="78" y1="54" x2="92" y2="54" stroke="#BDC3C7" strokeWidth="0.6" />
          {happy && (<><ellipse cx="38" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity="0.5" /><ellipse cx="82" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity="0.5" /></>)}
          <path d="M54 30 L56 35 L60 32 L64 35 L66 30" fill="none" stroke="#D68910" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          {flinch && <text x="75" y="25" fontSize="18" fontWeight="bold" fill="#E74C3C" textAnchor="middle" opacity="0">!
            <animate attributeName="opacity" values="0;1;1;0" dur="0.5s" fill="freeze" />
            <animate attributeName="y" values="25;14;8;2" dur="0.5s" fill="freeze" /></text>}
        </g>
      </g>
    </svg>
  );
}

/* ═══ Helpers ═══ */

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

function scanPlatforms(groundY: number): Platform[] {
  // Scan ALL visible elements that are tall enough to stand on
  const all = document.querySelectorAll(
    'div, section, article, main, aside, nav, header, footer, ' +
    'table, thead, tbody, tr, th, td, ' +
    'button, a, [role="button"], ' +
    'p, h1, h2, h3, h4, h5, h6, span, label, ' +
    'input, textarea, select, ' +
    'ul, ol, li, ' +
    'form, fieldset, ' +
    '[class*="card"],[class*="Card"],[class*="panel"],[class*="Panel"],' +
    '[class*="dialog"],[class*="Dialog"],[class*="sidebar"],[class*="Sidebar"],' +
    '[class*="container"],[class*="row"],[class*="cell"]'
  );
  const out: Platform[] = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) continue;
    if (r.top >= groundY || r.bottom <= 0) continue;
    // Deduplicate: skip elements whose rect nearly matches one already in the list
    const isDup = out.some(o => Math.abs(o.top - r.top) < 4 && Math.abs(o.left - r.left) < 4);
    if (isDup) continue;
    out.push({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
  }
  return out.sort((a, b) => a.top - b.top).slice(0, 15);
}

function findSurface(platforms: Platform[], x: number, footY: number, groundY: number): number {
  const candidates = platforms
    .filter(p => x + W > p.left + 5 && x < p.right - 5)
    .sort((a, b) => a.top - b.top);
  for (const p of candidates) {
    if (footY <= p.top + 15) return p.top - H;
  }
  return groundY;
}

function currentPlatform(platforms: Platform[], x: number, footY: number): Platform | null {
  return platforms.find(p => Math.abs(p.top - footY) < 6 && x + W > p.left + 5 && x < p.right - 5) ?? null;
}

/* ═══ Component ═══ */

export function MascotOverlay() {
  const visible = useMascotStore((s) => s.visible);
  const message = useMascotStore((s) => s.message);
  const emotion = useMascotStore((s) => s.emotion);

  const maxX = window.innerWidth - W - 5;
  const groundY = window.innerHeight - H - MARGIN;

  const [pos, setPos] = useState({ x: rand(30, maxX), y: groundY });
  const [action, setAction] = useState<Action>('idle');
  const [showMsg, setShowMsg] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });

  useEffect(() => {
    const s = () => setPlatforms(scanPlatforms(groundY));
    s();
    const id = setInterval(s, 4000);
    window.addEventListener('resize', s);
    window.addEventListener('scroll', s, true);
    return () => { clearInterval(id); window.removeEventListener('resize', s); window.removeEventListener('scroll', s, true); };
  }, [groundY]);

  useEffect(() => {
    if (busy.current) return;
    const maxX2 = window.innerWidth - W - 5;
    const gY = window.innerHeight - H - MARGIN;
    setPos(p => {
      const x = clamp(p.x, 5, maxX2);
      const footY = p.y + H;
      let y = clamp(p.y, 0, gY);
      if (y < gY - 5 && !currentPlatform(platforms, x, footY)) {
        y = findSurface(platforms, x, footY, gY);
      }
      if (x !== p.x || y !== p.y) return { x, y };
      return p;
    });
  }, [platforms]);

  useEffect(() => {
    if (message) { setShowMsg(true); const t = setTimeout(() => setShowMsg(false), 4000); return () => clearTimeout(t); }
  }, [message]);

  const doWalk = useCallback((tx: number) => {
    busy.current = true; setAction('walk');
    setPos(p => {
      const plat = currentPlatform(platforms, p.x, p.y + H);
      const range = plat ? { lo: plat.left + 5, hi: plat.right - W - 5 } : { lo: 5, hi: window.innerWidth - W - 5 };
      return { x: clamp(tx, range.lo, range.hi), y: p.y };
    });
    setTimeout(() => { setAction('idle'); busy.current = false; }, 700);
  }, [platforms]);

  const doJump = useCallback((tx?: number) => {
    busy.current = true; setAction('jump');
    setPos(p => ({ x: tx !== undefined ? clamp(tx, 5, window.innerWidth - W - 5) : p.x, y: p.y }));
    setTimeout(() => { setAction('idle'); busy.current = false; }, 600);
  }, []);

  const doClimb = useCallback((targetY: number, targetX: number) => {
    busy.current = true; setAction('climb');
    setPos(p => ({ x: clamp(targetX, 5, window.innerWidth - W - 5), y: p.y }));
    setTimeout(() => setPos(p => ({ ...p, y: targetY })), 250);
    setTimeout(() => { setAction('idle'); busy.current = false; }, 1100);
  }, []);

  const doGrapple = useCallback((targetY: number, targetX: number) => {
    busy.current = true; setAction('grapple');
    setTimeout(() => setPos({ x: clamp(targetX, 5, window.innerWidth - W - 5), y: targetY }), 500);
    setTimeout(() => { setAction('idle'); busy.current = false; }, 900);
  }, []);

  const schedule = useCallback(() => {
    if (busy.current || dragging.current) { timer.current = setTimeout(schedule, 1500); return; }
    timer.current = setTimeout(() => {
      if (busy.current || dragging.current) { schedule(); return; }
      const plats = scanPlatforms(groundY); setPlatforms(plats);
      const footY = pos.y + H;
      const onGround = footY >= groundY + H - 5;
      const onPlat = currentPlatform(plats, pos.x, footY);
      const surfY = onPlat ? onPlat.top : groundY;
      const roll = Math.random();

      if (roll < 0.1) {
        const above = plats.filter(p => p.top < surfY - 40 && p.left < pos.x + 60 && p.right > pos.x - 60);
        if (above.length) {
          const t = above[above.length - 1]!;
          doGrapple(t.top - H, clamp(t.left + (t.right - t.left) / 2, 5, window.innerWidth - W - 5));
          schedule(); return;
        }
      }
      if (roll < 0.22) {
        const cand = plats.filter(p => pos.x > p.left - 40 && pos.x < p.right + 40 && p.top < surfY - 25).sort((a, b) => a.top - b.top);
        if (cand.length) {
          const t = cand[0]!;
          doClimb(t.top - H, clamp(t.left + (t.right - t.left) / 2, 5, window.innerWidth - W - 5));
          schedule(); return;
        }
      }
      if (roll < 0.62) {
        const range = onPlat ? { lo: onPlat.left + 5, hi: onPlat.right - W - 5 } : { lo: 5, hi: window.innerWidth - W - 5 };
        doWalk(clamp(pos.x + rand(-80, 80), range.lo, range.hi));
        schedule(); return;
      }
      if (roll < 0.77) { doJump(); schedule(); return; }
      if (roll < 0.85) { busy.current = true; setAction('spin'); setTimeout(() => { setAction('idle'); busy.current = false; }, 600); schedule(); return; }
      if (roll < 0.9 && !onGround) {
        busy.current = true; setAction('jump'); setPos(p => ({ ...p, y: groundY }));
        setTimeout(() => { setAction('idle'); busy.current = false; }, 600); schedule(); return;
      }
      doWalk(clamp(pos.x + rand(-60, 60), 5, window.innerWidth - W - 5));
      schedule();
    }, rand(2500, 5500));
  }, [pos, groundY, doWalk, doJump, doClimb, doGrapple]);

  useEffect(() => { schedule(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [schedule]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragging.current = true; busy.current = true; setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: pos.x, cy: pos.y };
    setAction('flinch');

    const move = (ev: MouseEvent) => setPos({ x: dragStart.current.cx + ev.clientX - dragStart.current.mx, y: dragStart.current.cy + ev.clientY - dragStart.current.my });
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      dragging.current = false; setIsDragging(false);
      const dx = ev.clientX - dragStart.current.mx, dy = ev.clientY - dragStart.current.my;
      if (Math.hypot(dx, dy) < 8) { setTimeout(() => { setAction('idle'); busy.current = false; schedule(); }, 400); return; }
      const plats = scanPlatforms(groundY);
      const tossX = clamp(dragStart.current.cx + dx * 1.2, 5, window.innerWidth - W - 5);
      const tossFootY = dragStart.current.cy + dy * 1.2 + H;
      const landY = findSurface(plats, tossX, tossFootY, groundY);
      setAction('tossed');
      setPos({ x: tossX, y: landY });
      setTimeout(() => { setAction('idle'); busy.current = false; schedule(); }, 700);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }, [pos, groundY, schedule]);

  return (
    <div className="fixed z-50 select-none" style={{ left: pos.x, top: pos.y, transition: action === 'walk' ? 'left 0.7s linear' : action === 'climb' ? 'top 0.8s ease-in-out' : action === 'tossed' ? 'top 0.5s ease-in, left 0.4s ease-out' : action === 'jump' ? 'top 0.35s ease-out' : 'none', cursor: isDragging ? 'grabbing' : 'grab' }} onMouseDown={onMouseDown} title="🐱 Kéo để ném · Click để chọc">
      {showMsg && message && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 max-w-[200px] rounded-xl bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-lg border border-gray-200 animate-mcSlideUp whitespace-nowrap">
          {message}<div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45" /></div>
      )}
      <div className="origin-bottom" style={{ animation: action === 'walk' ? 'mcWalkCycle 0.45s ease-in-out infinite' : action === 'jump' || action === 'tossed' ? 'mcJump 0.5s ease-out' : action === 'climb' ? 'mcClimbUp 0.9s ease-in-out' : action === 'grapple' ? 'mcPullUp 0.5s ease-out' : action === 'spin' ? 'mcSpin 0.6s ease-in-out' : 'none' }}>
        <CatBody emotion={visible ? emotion : 'idle'} action={action} />
      </div>
      <style>{`
        .animate-mcSlideUp{animation:mcSlideUp .3s ease-out}
        @keyframes mcSlideUp{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes mcWalkCycle{0%{transform:translateY(0) rotate(0deg) scale(1,1)}25%{transform:translateY(-6px) rotate(-2deg) scale(1.02,0.98)}50%{transform:translateY(0) rotate(0deg) scale(1,1)}75%{transform:translateY(-6px) rotate(2deg) scale(1.02,0.98)}100%{transform:translateY(0) rotate(0deg) scale(1,1)}}
        @keyframes mcJump{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-44px) scale(.84,1.16)}55%{transform:translateY(-52px) scale(.76,1.24)}75%{transform:translateY(-20px) scale(1.08,.92)}90%{transform:translateY(0) scale(1.04,.96)}100%{transform:translateY(0) scale(1,1)}}
        @keyframes mcClimbUp{0%{transform:translateY(40px) scale(1,.8)}35%{transform:translateY(14px) scale(.94,1.06)}65%{transform:translateY(-4px) scale(.92,1.08)}100%{transform:translateY(0) scale(1,1)}}
        @keyframes mcPullUp{0%{transform:translateY(0)}50%{transform:translateY(-26px) scale(.9,1.1)}100%{transform:translateY(0) scale(1,1)}}
        @keyframes mcSpin{0%{transform:rotate(0deg) scale(1)}30%{transform:rotate(15deg) scale(1.06)}60%{transform:rotate(-15deg) scale(1.06)}100%{transform:rotate(0deg) scale(1)}}
      `}</style>
    </div>
  );
}
