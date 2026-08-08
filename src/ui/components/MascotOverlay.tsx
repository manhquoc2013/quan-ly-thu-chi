/**
 * MascotOverlay — Physics-bound cat with independent body-part animations.
 * Each part (head, arms, legs, tail, body) animates separately per action.
 */
import { useMascotStore } from '@/store/mascotStore';
import type { MascotActivity } from '@/store/mascotStore';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ═══ Types ═══ */

type Action = 'idle' | 'walk' | 'jump' | 'climb' | 'grapple' | 'spin' | 'flinch' | 'tossed';
export type { Action };

interface Platform { top: number; left: number; right: number; bottom: number; }

/* ═══ Constants ═══ */

const W = 63, H = 64;
const MARGIN = 10;

/* ═══════════════════════════════════════════════════════════════════════
   SVG Cat — independent body parts with per-action CSS animations
   ═══════════════════════════════════════════════════════════════════════ */

/** CSS for body-part animations — one @keyframes per part+action combo */
const PART_STYLES = `
@keyframes tail-idle{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(8deg)}}
@keyframes tail-walk{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(12deg)}}
@keyframes tail-flinch{0%,100%{transform:rotate(20deg)}50%{transform:rotate(30deg)}}
@keyframes tail-climb{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(6deg)}}
@keyframes tail-default{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(8deg)}}

@keyframes lleg-idle{0%,100%{transform:rotate(0deg)}}
@keyframes lleg-walk{0%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}100%{transform:rotate(-15deg)}}
@keyframes lleg-jump{0%{transform:rotate(-10deg)}40%{transform:rotate(10deg)}100%{transform:rotate(-10deg)}}
@keyframes lleg-climb{0%{transform:rotate(-10deg)}30%{transform:rotate(10deg)}60%{transform:rotate(-5deg)}100%{transform:rotate(-10deg)}}
@keyframes lleg-flinch{0%{transform:rotate(-5deg)}50%{transform:rotate(-15deg)}100%{transform:rotate(-5deg)}}
@keyframes lleg-default{0%,100%{transform:rotate(0deg)}}

@keyframes rleg-idle{0%,100%{transform:rotate(0deg)}}
@keyframes rleg-walk{0%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}100%{transform:rotate(15deg)}}
@keyframes rleg-jump{0%{transform:rotate(10deg)}40%{transform:rotate(-10deg)}100%{transform:rotate(10deg)}}
@keyframes rleg-climb{0%{transform:rotate(10deg)}30%{transform:rotate(-10deg)}60%{transform:rotate(5deg)}100%{transform:rotate(10deg)}}
@keyframes rleg-flinch{0%{transform:rotate(5deg)}50%{transform:rotate(15deg)}100%{transform:rotate(5deg)}}
@keyframes rleg-default{0%,100%{transform:rotate(0deg)}}

@keyframes larm-idle{0%,100%{transform:rotate(0deg)}}
@keyframes larm-walk{0%{transform:rotate(10deg)}50%{transform:rotate(-15deg)}100%{transform:rotate(10deg)}}
@keyframes larm-jump{0%{transform:rotate(-20deg)}50%{transform:rotate(-10deg)}100%{transform:rotate(-20deg)}}
@keyframes larm-climb{0%{transform:rotate(-25deg)}30%{transform:rotate(5deg)}60%{transform:rotate(-20deg)}100%{transform:rotate(-25deg)}}
@keyframes larm-grapple{0%{transform:rotate(-35deg)}50%{transform:rotate(-15deg)}100%{transform:rotate(-35deg)}}
@keyframes larm-flinch{0%{transform:rotate(5deg)}50%{transform:rotate(20deg)}100%{transform:rotate(5deg)}}
@keyframes larm-spin{0%{transform:rotate(-20deg)}100%{transform:rotate(-20deg)}}
@keyframes larm-default{0%,100%{transform:rotate(0deg)}}

@keyframes rarm-idle{0%,100%{transform:rotate(0deg)}}
@keyframes rarm-walk{0%{transform:rotate(-10deg)}50%{transform:rotate(15deg)}100%{transform:rotate(-10deg)}}
@keyframes rarm-jump{0%{transform:rotate(20deg)}50%{transform:rotate(10deg)}100%{transform:rotate(20deg)}}
@keyframes rarm-climb{0%{transform:rotate(25deg)}30%{transform:rotate(-5deg)}60%{transform:rotate(20deg)}100%{transform:rotate(25deg)}}
@keyframes rarm-grapple{0%{transform:rotate(35deg)}50%{transform:rotate(15deg)}100%{transform:rotate(35deg)}}
@keyframes rarm-flinch{0%{transform:rotate(-5deg)}50%{transform:rotate(-20deg)}100%{transform:rotate(-5deg)}}
@keyframes rarm-spin{0%{transform:rotate(20deg)}100%{transform:rotate(20deg)}}
@keyframes rarm-default{0%,100%{transform:rotate(0deg)}}

@keyframes body-idle{0%,100%{transform:translateY(0)}}
@keyframes body-walk{0%{transform:translateY(0)}25%{transform:translateY(-4px)}50%{transform:translateY(0)}75%{transform:translateY(-4px)}100%{transform:translateY(0)}}
@keyframes body-jump{0%{transform:translateY(0) scaleY(0.92)}30%{transform:translateY(-2px) scaleY(1.05)}70%{transform:translateY(2px) scaleY(0.9)}100%{transform:translateY(0) scaleY(1)}}
@keyframes body-climb{0%{transform:translateY(0)}40%{transform:translateY(-3px)}100%{transform:translateY(0)}}
@keyframes body-flinch{0%{transform:translateY(0)}30%{transform:translateY(-3px)}100%{transform:translateY(0)}}
@keyframes body-default{0%,100%{transform:translateY(0)}}

@keyframes head-idle{0%{transform:rotate(0deg)}25%{transform:rotate(2deg)}75%{transform:rotate(-1deg)}100%{transform:rotate(0deg)}}
@keyframes head-walk{0%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}100%{transform:rotate(-2deg)}}
@keyframes head-jump{0%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}100%{transform:rotate(-3deg)}}
@keyframes head-flinch{0%{transform:rotate(0deg)}30%{transform:rotate(-5deg)}60%{transform:rotate(3deg)}100%{transform:rotate(0deg)}}
@keyframes head-default{0%,100%{transform:rotate(0deg)}}

@keyframes eyes-blink{0%,90%{transform:scaleY(1)}95%{transform:scaleY(0.1)}100%{transform:scaleY(1)}}
@keyframes eyes-flinch{0%{transform:scaleY(1)}20%{transform:scaleY(0.15)}60%{transform:scaleY(0.15)}100%{transform:scaleY(1)}}
`;

const partAnim = (part: string, action: Action): string => {
  const key = `${part}-${action}`;
  // Falls back to idle if the specific action doesn't have a named keyframe
  const dur =
    action === 'flinch' ? '0.2s' :
    action === 'jump' ? '0.5s' :
    action === 'climb' ? '0.7s' :
    action === 'grapple' ? '0.5s' :
    action === 'spin' ? '0.6s' :
    action === 'walk' ? '0.55s' :
    '2s';
  return `${key} ${dur} ease-in-out infinite`;
};

export function CatBody({ emotion, action }: { emotion: string; action: Action }) {
  const happy = emotion === 'happy' || emotion === 'celebrate';
  const isFlinch = action === 'flinch';
  const eyeRx = happy ? '3' : '4.5';
  const eyeRy = happy ? '2' : '4.5';

  return (
    <svg width={W} height={H} viewBox="0 0 145 125" overflow="visible" className="drop-shadow-lg">
      <style>{PART_STYLES}</style>

      {/* ═══ TAIL ═══ */}
      <g style={{ transformOrigin: '95px 75px', animation: partAnim('tail', action) }}>
        <path d="M95 75 Q120 65 130 78 Q135 95 110 92" fill="none"
          stroke="#D35400" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* ═══ LEFT HIND LEG — thigh + shin + paw ═══ */}
      <g style={{ transformOrigin: '45px 100px', animation: partAnim('lleg', action) }}>
        <ellipse cx="45" cy="104" rx="11" ry="12" fill="#D35400" stroke="#A04000" strokeWidth="1" />
        <ellipse cx="45" cy="114" rx="9" ry="11" fill="#C05000" stroke="#A04000" strokeWidth="0.8" />
        <ellipse cx="45" cy="122" rx="13" ry="6" fill="#E67E22" />
        <ellipse cx="45" cy="121" rx="9" ry="4" fill="#F5CBA7" />
      </g>

      {/* ═══ RIGHT HIND LEG — thigh + shin + paw ═══ */}
      <g style={{ transformOrigin: '75px 100px', animation: partAnim('rleg', action) }}>
        <ellipse cx="75" cy="104" rx="11" ry="12" fill="#D35400" stroke="#A04000" strokeWidth="1" />
        <ellipse cx="75" cy="114" rx="9" ry="11" fill="#C05000" stroke="#A04000" strokeWidth="0.8" />
        <ellipse cx="75" cy="122" rx="13" ry="6" fill="#E67E22" />
        <ellipse cx="75" cy="121" rx="9" ry="4" fill="#F5CBA7" />
      </g>

      {/* ═══ BODY ═══ */}
      <g style={{ transformOrigin: '60px 80px', animation: partAnim('body', action) }}>
        <ellipse cx="60" cy="80" rx="35" ry="30" fill="#F39C12" stroke="#E67E22" strokeWidth="1" />
        <ellipse cx="60" cy="88" rx="22" ry="18" fill="#FDEBD0" />
      </g>

      {/* ═══ LEFT ARM — upper arm + forearm + paw ═══ */}
      <g style={{ transformOrigin: '30px 72px', animation: partAnim('larm', action) }}>
        <ellipse cx="30" cy="78" rx="8" ry="13" fill="#E67E22" stroke="#C05A00" strokeWidth="1" />
        <ellipse cx="30" cy="90" rx="7" ry="11" fill="#D4700A" stroke="#B05000" strokeWidth="0.8" />
        <ellipse cx="28" cy="99" rx="8" ry="5" fill="#F5CBA7" stroke="#D4A373" strokeWidth="0.5" />
      </g>

      {/* ═══ RIGHT ARM — upper arm + forearm + paw ═══ */}
      <g style={{ transformOrigin: '90px 72px', animation: partAnim('rarm', action) }}>
        <ellipse cx="90" cy="78" rx="8" ry="13" fill="#E67E22" stroke="#C05A00" strokeWidth="1" />
        <ellipse cx="90" cy="90" rx="7" ry="11" fill="#D4700A" stroke="#B05000" strokeWidth="0.8" />
        <ellipse cx="92" cy="99" rx="8" ry="5" fill="#F5CBA7" stroke="#D4A373" strokeWidth="0.5" />
      </g>

      {/* ═══ HEAD ═══ */}
      <g style={{ transformOrigin: '60px 45px', animation: partAnim('head', action) }}>
        <ellipse cx="60" cy="45" rx="30" ry="27" fill="#F39C12" />
        {/* Ears */}
        <polygon points="33,30 28,5 45,20" fill="#F39C12" />
        <polygon points="35,25 32,12 42,20" fill="#F5B7B1" />
        <polygon points="87,30 92,5 75,20" fill="#F39C12" />
        <polygon points="85,25 88,12 78,20" fill="#F5B7B1" />
        {/* Face */}
        <ellipse cx="60" cy="52" rx="22" ry="17" fill="#FDEBD0" />

        {/* Eyes with blink */}
        <g style={{ transformOrigin: '48px 42px', animation: isFlinch ? 'eyes-flinch 0.3s ease-out' : 'eyes-blink 3.5s ease-in-out infinite' }}>
          <ellipse cx="48" cy="42" rx={eyeRx} ry={eyeRy} fill="#2C3E50" />
          <circle cx={happy ? '49' : '50'} cy={happy ? '41' : '40'} r="2" fill="white" />
        </g>
        <g style={{ transformOrigin: '72px 42px', animation: isFlinch ? 'eyes-flinch 0.3s ease-out' : 'eyes-blink 3.5s ease-in-out infinite' }}>
          <ellipse cx="72" cy="42" rx={eyeRx} ry={eyeRy} fill="#2C3E50" />
          <circle cx={happy ? '73' : '74'} cy={happy ? '41' : '40'} r="2" fill="white" />
        </g>

        {/* Flinch cross-eyes */}
        {isFlinch && (<>
          <line x1="42" y1="36" x2="54" y2="48" stroke="#E74C3C" strokeWidth="1.5" opacity="0.8" />
          <line x1="78" y1="36" x2="66" y2="48" stroke="#E74C3C" strokeWidth="1.5" opacity="0.8" />
        </>)}

        {/* Nose */}
        <ellipse cx="60" cy="52" rx="3" ry="2" fill="#E74C3C" />

        {/* Mouth */}
        {happy ? (
          <path d="M54 56 Q60 62 66 56" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
        ) : emotion === 'sad' ? (
          <path d="M54 58 Q60 54 66 58" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
        ) : isFlinch ? (
          <ellipse cx="60" cy="57" rx="5" ry="3.5" fill="#2C3E50" />
        ) : (
          <line x1="56" y1="57" x2="64" y2="57" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
        )}

        {/* Whiskers */}
        <line x1="28" y1="50" x2="42" y2="52" stroke="#BDC3C7" strokeWidth="0.6" />
        <line x1="28" y1="54" x2="42" y2="54" stroke="#BDC3C7" strokeWidth="0.6" />
        <line x1="78" y1="52" x2="92" y2="50" stroke="#BDC3C7" strokeWidth="0.6" />
        <line x1="78" y1="54" x2="92" y2="54" stroke="#BDC3C7" strokeWidth="0.6" />

        {/* Blush */}
        {happy && (<>
          <ellipse cx="38" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity="0.5" />
          <ellipse cx="82" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity="0.5" />
        </>)}

        {/* Forehead stripes */}
        <path d="M54 30 L56 35 L60 32 L64 35 L66 30" fill="none"
          stroke="#D68910" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />

        {/* "!" on flinch */}
        {isFlinch && (
          <text x="78" y="22" fontSize="20" fontWeight="bold" fill="#E74C3C" textAnchor="middle"
            style={{ animation: 'head-flinch 0.2s ease-out' }}>!</text>
        )}
      </g>
    </svg>
  );
}

/* ═══ Helpers ═══ */

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

function scanPlatforms(groundY: number): Platform[] {
  const all = document.querySelectorAll(
    'div, section, article, main, aside, nav, header, footer, ' +
    'table, thead, tbody, tr, th, td, ' +
    'button, a, [role="button"], ' +
    'p, h1, h2, h3, h4, h5, h6, span, label, ' +
    'input, textarea, select, ' +
    'ul, ol, li, form, fieldset, ' +
    '[class*="card"],[class*="Card"],[class*="panel"],[class*="Panel"],' +
    '[class*="dialog"],[class*="Dialog"],[class*="sidebar"],[class*="Sidebar"],' +
    '[class*="container"],[class*="row"],[class*="cell"]'
  );
  const out: Platform[] = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) continue;
    if (r.top >= groundY || r.bottom <= 0) continue;
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
  const activity = useMascotStore((s) => s.activity);
  const setActivity = useMascotStore((s) => s.setActivity);

  // Activity → delay range (ms)
  const actDelay = (activity === 'high' ? [800, 2000] : activity === 'low' ? [4000, 9000] : [2000, 5000]) as [number, number];

  const maxX = window.innerWidth - W - 5;
  const groundY = window.innerHeight - H - MARGIN;

  const [pos, setPos] = useState({ x: rand(30, maxX), y: groundY });
  const [action, setAction] = useState<Action>('idle');
  const [facingRight, setFacingRight] = useState(true);
  const [showMsg, setShowMsg] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });
  const lastClick = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const interacting = useRef(false);

  // Double-click to cycle activity level
  const cycleActivity = () => {
    const now = Date.now();
    if (now - lastClick.current < 400) {
      const next: Record<string, MascotActivity> = { low: 'medium', medium: 'high', high: 'low' };
      setActivity(next[activity] ?? 'medium');
    }
    lastClick.current = now;
  };

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
    setFacingRight(tx >= pos.x);
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
    const clampedY = clamp(targetY, 0, groundY);
    setPos(p => ({ x: clamp(targetX, 5, window.innerWidth - W - 5), y: p.y }));
    setTimeout(() => setPos(p => ({ ...p, y: clampedY })), 250);
    setTimeout(() => { setAction('idle'); busy.current = false; }, 1100);
  }, [groundY]);

  const doGrapple = useCallback((targetY: number, targetX: number) => {
    busy.current = true; setAction('grapple');
    const clampedY = clamp(targetY, 0, groundY);
    setTimeout(() => setPos({ x: clamp(targetX, 5, window.innerWidth - W - 5), y: clampedY }), 500);
    setTimeout(() => { setAction('idle'); busy.current = false; }, 900);
  }, [groundY]);

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
    }, rand(actDelay[0], actDelay[1]));
  }, [pos, groundY, doWalk, doJump, doClimb, doGrapple, actDelay]);

  useEffect(() => { schedule(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [schedule]);

  // Idle chatter — say random things when nothing has happened for a while
  useEffect(() => {
    const phrases = [
      'Hôm nay bán được gì chưa? 🛒',
      'Nhớ ghi chép chi tiêu nhé! ✍️',
      'Mèo đang canh khoản chi nè... 👀',
      'Có đơn hàng mới không ta? 📦',
      'Lợi nhuận tháng này ổn không? 💰',
      'Mèo thích đếm tiền lắm! 🪙',
      'Đói bụng quá, có ai cho mèo ăn không? 🐟',
      'Chăm chỉ ghi sổ nhé, đừng lười! 📝',
      'Hôm nay là một ngày tốt lành! ☀️',
      'Mèo Lucky luôn ở đây canh khoản thu chi! 🐱',
    ];
    let idleTimer: ReturnType<typeof setTimeout>;
    let lastSpeak = Date.now();

    const tick = () => {
      if (interacting.current || busy.current) { idleTimer = setTimeout(tick, 5000); return; }
      const elapsed = Date.now() - lastSpeak;
      if (elapsed > 20000) {
        const msg = phrases[Math.floor(Math.random() * phrases.length)]!;
        useMascotStore.getState().speak(msg, 'idle');
        lastSpeak = Date.now();
      }
      idleTimer = setTimeout(tick, 5000);
    };
    idleTimer = setTimeout(tick, 15000);
    return () => clearTimeout(idleTimer);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    interacting.current = true;
    dragging.current = true; busy.current = true; setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: pos.x, cy: pos.y };
    setAction('flinch');
    // Random flinch reaction
    const flinchPhrases = ['Á!', 'Ui!', 'Hức!', 'Nyaa~', 'Sao thế?', 'Ơ kìa!', 'Chọc mèo à?'];
    useMascotStore.getState().speak(flinchPhrases[Math.floor(Math.random() * flinchPhrases.length)]!, 'warning');
    const move = (ev: MouseEvent) => setPos({
      x: clamp(dragStart.current.cx + ev.clientX - dragStart.current.mx, 5, window.innerWidth - W - 5),
      y: clamp(dragStart.current.cy + ev.clientY - dragStart.current.my, 0, groundY),
    });
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      dragging.current = false; setIsDragging(false);
      const dx = ev.clientX - dragStart.current.mx, dy = ev.clientY - dragStart.current.my;
      if (Math.hypot(dx, dy) < 8) {
        cycleActivity();
        setTimeout(() => { setAction('idle'); interacting.current = false; busy.current = false; schedule(); }, 400); return;
      }
      const plats = scanPlatforms(groundY);
      const tossX = clamp(dragStart.current.cx + dx * 1.2, 5, window.innerWidth - W - 5);
      const tossFootY = dragStart.current.cy + dy * 1.2 + H;
      const landY = clamp(findSurface(plats, tossX, tossFootY, groundY), 0, groundY);
      setAction('tossed');
      
      // Animate fall with Web Animations API, then sync React state
      const el = containerRef.current;
      if (el) {
        const fromY = el.getBoundingClientRect().top;
        const anim = el.animate(
          [{ top: `${fromY}px`, offset: 0 }, { top: `${landY}px`, offset: 1 }],
          { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.7, 1)', fill: 'forwards' },
        );
        anim.onfinish = () => {
          setPos({ x: tossX, y: landY });
          setAction('idle');
          interacting.current = false;
          busy.current = false;
          schedule();
        };
      }
      // Set X immediately, Y will be animated
      setPos(p => ({ x: tossX, y: p.y }));
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }, [pos, groundY, schedule]);

  return (
    <div ref={containerRef} className="fixed z-50 select-none" style={{
      left: pos.x, top: pos.y,
      transition: action === 'walk' ? 'left 0.4s ease-in-out' :
        action === 'climb' ? 'top 0.8s ease-in-out' :
        action === 'tossed' ? 'top 1s ease-in, left 0.5s ease-out' :
        action === 'jump' ? 'top 0.35s ease-out' : 'none',
      cursor: isDragging ? 'grabbing' : 'grab',
    }} onMouseDown={onMouseDown} title="🐱 Kéo để ném · Click để chọc">
      {message && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 max-w-[200px] rounded-xl bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-lg border border-gray-200 animate-mcSlideUp whitespace-nowrap">
          {message}<div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45" /></div>
      )}
      {/* Parachute during free fall */}
      {action === 'tossed' && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10" style={{ animation: 'chuteOpen 0.3s ease-out' }}>
          <svg width="72" height="36" viewBox="0 0 72 36">
            <path d="M4 4 Q36 -28 68 4" fill="#FCA5A5" stroke="#EF4444" strokeWidth="2" />
            <path d="M12 6 Q36 -18 60 6" fill="#FEE2E2" stroke="#FCA5A5" strokeWidth="1" />
            <line x1="18" y1="4" x2="36" y2="32" stroke="#9CA3AF" strokeWidth="0.7" />
            <line x1="36" y1="4" x2="36" y2="32" stroke="#9CA3AF" strokeWidth="0.7" />
            <line x1="54" y1="4" x2="36" y2="32" stroke="#9CA3AF" strokeWidth="0.7" />
          </svg>
        </div>
      )}
      <div className="origin-bottom" style={{
        animation: action === 'walk' ? 'catBob 0.35s ease-in-out infinite' :
          action === 'jump' || action === 'tossed' ? 'catJump 0.5s ease-out' :
          action === 'climb' ? 'catClimb 0.9s ease-in-out' :
          action === 'grapple' ? 'catPullUp 0.5s ease-out' :
          action === 'spin' ? 'catSpin 0.6s ease-in-out' : 'none',
      }}>
        <span style={{ display: 'inline-block', transform: `scaleX(${facingRight ? 1 : -1})` }}>
          <CatBody emotion={visible ? emotion : 'idle'} action={action} />
        </span>
      </div>
      {/* Flip to face walking direction */}
      <style>{`
        .mc-flip { display: inline-block; }
      `}</style>
      <style>{`
        .animate-mcSlideUp{animation:catSlideUp .3s ease-out}
        @keyframes catSlideUp{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes catBob{0%{transform:translateY(0) rotate(-4deg) scale(1,1)}25%{transform:translateY(-10px) rotate(-2deg) scale(1.03,0.97)}50%{transform:translateY(-14px) rotate(0deg) scale(1,1)}75%{transform:translateY(-6px) rotate(2deg) scale(1.02,0.98)}100%{transform:translateY(0) rotate(-4deg) scale(1,1)}}
        @keyframes catJump{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-40px) scale(.85,1.15)}55%{transform:translateY(-48px) scale(.78,1.22)}75%{transform:translateY(-16px) scale(1.07,.93)}100%{transform:translateY(0) scale(1,1)}}
        @keyframes catClimb{0%{transform:translateY(36px) scale(1,.82)}35%{transform:translateY(12px) scale(.94,1.06)}65%{transform:translateY(-4px) scale(.92,1.08)}100%{transform:translateY(0) scale(1,1)}}
        @keyframes catPullUp{0%{transform:translateY(0)}50%{transform:translateY(-24px) scale(.9,1.1)}100%{transform:translateY(0) scale(1,1)}}
        @keyframes catSpin{0%{transform:rotate(0deg) scale(1)}30%{transform:rotate(15deg) scale(1.06)}60%{transform:rotate(-15deg) scale(1.06)}100%{transform:rotate(0deg) scale(1)}}
        @keyframes chuteOpen{from{transform:scale(0) translateY(10px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
      `}</style>
    </div>
  );
}
