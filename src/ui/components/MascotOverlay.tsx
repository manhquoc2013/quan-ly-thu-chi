/**
 * MascotOverlay — SVG puppet with pixel-inspired actions.
 * RAF owns position (anti-teleport); limbs/face animate per action.
 * Motion vocabulary referenced from FREE_Cat 2D Pixel Art (not rendered).
 */
import { useMascotStore } from '@/store/mascotStore';
import type { MascotActivity } from '@/store/mascotStore';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ═══ Types ═══ */

type CoreAction =
  | 'idle' | 'walk' | 'run' | 'jump' | 'runJump'
  | 'climb' | 'crawl' | 'attack' | 'hurt' | 'fall' | 'dead';

/** Includes legacy aliases used by AuthGuard / chat loaders */
export type Action = CoreAction | 'grapple' | 'spin' | 'flinch' | 'tossed';

interface Platform { top: number; left: number; right: number; bottom: number }

interface ActivityProfile {
  delay: [number, number];
  maxSpeed: number;
  walkDur: number;
  runDur: number;
  weights: { walk: number; run: number; jump: number; climb: number; crawl: number; attack: number; runJump: number };
}

type MotionKind = 'loco' | 'climb' | 'fall' | 'jump' | 'settle';

interface Motion {
  kind: MotionKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
  parachute: boolean;
  /** When true, fall motion never deploys the parachute (voluntary drop). */
  noChute?: boolean;
  hardLand: boolean;
  locoAction: 'walk' | 'run';
  onDone?: (landed: { x: number; y: number; hard: boolean }) => void;
}

/* ═══ Constants ═══ */

const W = 63, H = 64;
const MARGIN = 10;
const HARD_TOSS = 140;

/** Pixels traveled per full limb cycle — keeps gait from looking like a slide. */
const STRIDE = { walk: 30, run: 42, crawl: 24 } as const;

interface RopeAnchor { ax: number; ay: number }

const PROFILES: Record<MascotActivity, ActivityProfile> = {
  low: {
    delay: [4000, 9000],
    maxSpeed: 2.4,
    walkDur: 0.85,
    runDur: 0.58,
    weights: { walk: 0.55, run: 0.05, jump: 0.08, climb: 0.08, crawl: 0.06, attack: 0.04, runJump: 0.02 },
  },
  medium: {
    delay: [2000, 5000],
    maxSpeed: 4.5,
    walkDur: 0.68,
    runDur: 0.48,
    weights: { walk: 0.4, run: 0.12, jump: 0.12, climb: 0.14, crawl: 0.1, attack: 0.06, runJump: 0.06 },
  },
  high: {
    delay: [800, 2000],
    maxSpeed: 7,
    walkDur: 0.52,
    runDur: 0.38,
    weights: { walk: 0.18, run: 0.28, jump: 0.12, climb: 0.16, crawl: 0.1, attack: 0.08, runJump: 0.08 },
  },
};

/* ═══ Part CSS ═══ */

const PART_STYLES = `
.mc-part{transform-box:fill-box;transform-origin:center center}
.mc-leg{transform-box:fill-box;transform-origin:50% 18%}
.mc-arm{transform-box:fill-box;transform-origin:50% 12%}
/* Tail on the LEFT hip — behind the body when facing right (local +X = forward) */
.mc-tail{transform-box:view-box;transform-origin:30px 80px}
.mc-body{transform-box:fill-box;transform-origin:50% 55%}
.mc-head{transform-box:view-box;transform-origin:60px 55px}

@keyframes tail-idle{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-10deg)}}
/* Sway behind (left) while stepping forward */
@keyframes tail-walk{
  0%{transform:rotate(28deg) scale(1,1)}
  25%{transform:rotate(4deg) scale(1.04,0.96)}
  50%{transform:rotate(-30deg) scale(1,1)}
  75%{transform:rotate(-6deg) scale(1.04,0.96)}
  100%{transform:rotate(28deg) scale(1,1)}
}
@keyframes tail-run{
  0%{transform:rotate(38deg) scale(1,0.95)}
  25%{transform:rotate(6deg) scale(1.06,0.92)}
  50%{transform:rotate(-36deg) scale(1,0.95)}
  75%{transform:rotate(-8deg) scale(1.06,0.92)}
  100%{transform:rotate(38deg) scale(1,0.95)}
}
@keyframes tail-jump{0%{transform:rotate(-8deg)}40%{transform:rotate(-32deg)}100%{transform:rotate(-12deg)}}
@keyframes tail-climb{0%,100%{transform:rotate(12deg)}50%{transform:rotate(-14deg)}}
@keyframes tail-crawl{0%,100%{transform:rotate(30deg)}50%{transform:rotate(8deg)}}
@keyframes tail-attack{0%{transform:rotate(5deg)}50%{transform:rotate(-28deg)}100%{transform:rotate(5deg)}}
@keyframes tail-hurt{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(-34deg)}}
@keyframes tail-fall{0%,100%{transform:rotate(-18deg)}50%{transform:rotate(-32deg)}}
@keyframes tail-dead{0%,100%{transform:rotate(-40deg)}}
@keyframes tail-default{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-10deg)}}

/* Contact → Down → Passing → Up (classic walk cycle), opposite phase L/R */
@keyframes lleg-idle{0%,100%{transform:rotate(0)}}
@keyframes lleg-walk{
  0%{transform:rotate(-32deg) translateY(0)}
  25%{transform:rotate(-8deg) translateY(3px)}
  50%{transform:rotate(32deg) translateY(0)}
  75%{transform:rotate(10deg) translateY(-5px)}
  100%{transform:rotate(-32deg) translateY(0)}
}
@keyframes lleg-run{
  0%{transform:rotate(-42deg) translateY(0)}
  25%{transform:rotate(-12deg) translateY(4px)}
  50%{transform:rotate(42deg) translateY(0)}
  75%{transform:rotate(14deg) translateY(-7px)}
  100%{transform:rotate(-42deg) translateY(0)}
}
@keyframes lleg-jump{0%{transform:rotate(-20deg)}40%{transform:rotate(8deg)}100%{transform:rotate(-5deg)}}
@keyframes lleg-runJump{0%{transform:rotate(-25deg)}40%{transform:rotate(12deg)}100%{transform:rotate(-8deg)}}
@keyframes lleg-climb{0%{transform:rotate(-18deg) translateY(2px)}35%{transform:rotate(20deg) translateY(-4px)}70%{transform:rotate(-10deg)}100%{transform:rotate(-18deg)}}
@keyframes lleg-crawl{0%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}100%{transform:rotate(-14deg)}}
@keyframes lleg-attack{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(10deg)}}
@keyframes lleg-hurt{0%{transform:rotate(-8deg)}50%{transform:rotate(-20deg)}100%{transform:rotate(-8deg)}}
@keyframes lleg-fall{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(10deg)}}
@keyframes lleg-dead{0%,100%{transform:rotate(-20deg)}}
@keyframes lleg-default{0%,100%{transform:rotate(0)}}

@keyframes rleg-idle{0%,100%{transform:rotate(0)}}
@keyframes rleg-walk{
  0%{transform:rotate(32deg) translateY(0)}
  25%{transform:rotate(10deg) translateY(-5px)}
  50%{transform:rotate(-32deg) translateY(0)}
  75%{transform:rotate(-8deg) translateY(3px)}
  100%{transform:rotate(32deg) translateY(0)}
}
@keyframes rleg-run{
  0%{transform:rotate(42deg) translateY(0)}
  25%{transform:rotate(14deg) translateY(-7px)}
  50%{transform:rotate(-42deg) translateY(0)}
  75%{transform:rotate(-12deg) translateY(4px)}
  100%{transform:rotate(42deg) translateY(0)}
}
@keyframes rleg-jump{0%{transform:rotate(20deg)}40%{transform:rotate(-8deg)}100%{transform:rotate(5deg)}}
@keyframes rleg-runJump{0%{transform:rotate(25deg)}40%{transform:rotate(-12deg)}100%{transform:rotate(8deg)}}
@keyframes rleg-climb{0%{transform:rotate(18deg) translateY(2px)}35%{transform:rotate(-20deg) translateY(-4px)}70%{transform:rotate(10deg)}100%{transform:rotate(18deg)}}
@keyframes rleg-crawl{0%{transform:rotate(14deg)}50%{transform:rotate(-14deg)}100%{transform:rotate(14deg)}}
@keyframes rleg-attack{0%,100%{transform:rotate(5deg)}50%{transform:rotate(-10deg)}}
@keyframes rleg-hurt{0%{transform:rotate(8deg)}50%{transform:rotate(20deg)}100%{transform:rotate(8deg)}}
@keyframes rleg-fall{0%,100%{transform:rotate(15deg)}50%{transform:rotate(-10deg)}}
@keyframes rleg-dead{0%,100%{transform:rotate(25deg)}}
@keyframes rleg-default{0%,100%{transform:rotate(0)}}

@keyframes larm-idle{0%,100%{transform:rotate(0)}}
@keyframes larm-walk{0%{transform:rotate(28deg)}50%{transform:rotate(-30deg)}100%{transform:rotate(28deg)}}
@keyframes larm-run{0%{transform:rotate(38deg)}50%{transform:rotate(-40deg)}100%{transform:rotate(38deg)}}
@keyframes larm-jump{0%{transform:rotate(-30deg)}50%{transform:rotate(-15deg)}100%{transform:rotate(-25deg)}}
@keyframes larm-runJump{0%{transform:rotate(-35deg)}50%{transform:rotate(-18deg)}100%{transform:rotate(-28deg)}}
@keyframes larm-climb{0%{transform:rotate(-48deg)}40%{transform:rotate(8deg)}100%{transform:rotate(-48deg)}}
@keyframes larm-crawl{0%{transform:rotate(-8deg)}50%{transform:rotate(16deg)}100%{transform:rotate(-8deg)}}
@keyframes larm-attack{0%{transform:rotate(10deg)}40%{transform:rotate(-55deg)}100%{transform:rotate(10deg)}}
@keyframes larm-hurt{0%{transform:rotate(8deg)}50%{transform:rotate(28deg)}100%{transform:rotate(8deg)}}
@keyframes larm-fall{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(20deg)}}
@keyframes larm-dead{0%,100%{transform:rotate(25deg)}}
@keyframes larm-default{0%,100%{transform:rotate(0)}}

@keyframes rarm-idle{0%,100%{transform:rotate(0)}}
@keyframes rarm-walk{0%{transform:rotate(-28deg)}50%{transform:rotate(30deg)}100%{transform:rotate(-28deg)}}
@keyframes rarm-run{0%{transform:rotate(-38deg)}50%{transform:rotate(40deg)}100%{transform:rotate(-38deg)}}
@keyframes rarm-jump{0%{transform:rotate(30deg)}50%{transform:rotate(15deg)}100%{transform:rotate(25deg)}}
@keyframes rarm-runJump{0%{transform:rotate(35deg)}50%{transform:rotate(18deg)}100%{transform:rotate(28deg)}}
@keyframes rarm-climb{0%{transform:rotate(48deg)}40%{transform:rotate(-8deg)}100%{transform:rotate(48deg)}}
@keyframes rarm-crawl{0%{transform:rotate(8deg)}50%{transform:rotate(-16deg)}100%{transform:rotate(8deg)}}
@keyframes rarm-attack{0%{transform:rotate(-5deg)}40%{transform:rotate(50deg)}100%{transform:rotate(-5deg)}}
@keyframes rarm-hurt{0%{transform:rotate(-8deg)}50%{transform:rotate(-28deg)}100%{transform:rotate(-8deg)}}
@keyframes rarm-fall{0%,100%{transform:rotate(25deg)}50%{transform:rotate(-20deg)}}
@keyframes rarm-dead{0%,100%{transform:rotate(-30deg)}}
@keyframes rarm-default{0%,100%{transform:rotate(0)}}

@keyframes body-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes body-walk{0%,50%,100%{transform:translateY(0) rotate(-2deg)}25%,75%{transform:translateY(-4px) rotate(-2deg)}}
@keyframes body-run{0%,50%,100%{transform:translateY(0) rotate(-5deg)}25%,75%{transform:translateY(-6px) rotate(-5deg)}}
@keyframes body-jump{0%{transform:translateY(0) scaleY(0.9)}35%{transform:translateY(-3px) scaleY(1.08)}70%{transform:translateY(2px) scaleY(0.92)}100%{transform:scaleY(1)}}
@keyframes body-runJump{0%{transform:translateY(0) scaleY(0.88) rotate(-5deg)}40%{transform:translateY(-4px) scaleY(1.1) rotate(-5deg)}100%{transform:scaleY(1) rotate(0)}}
@keyframes body-climb{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-4px) rotate(-4deg)}}
@keyframes body-crawl{0%,100%{transform:translateY(6px) scaleY(0.7) scaleX(1.15)}50%{transform:translateY(5px) scaleY(0.68) scaleX(1.18)}}
@keyframes body-attack{0%{transform:rotate(0)}40%{transform:rotate(-12deg) translateX(4px)}100%{transform:rotate(0)}}
@keyframes body-hurt{0%{transform:translateY(0)}30%{transform:translateY(-4px) rotate(-6deg)}100%{transform:translateY(0)}}
@keyframes body-fall{0%,100%{transform:scaleY(1.05)}}
@keyframes body-dead{0%,100%{transform:translateY(0) scaleY(0.9)}}
@keyframes body-default{0%,100%{transform:translateY(0)}}

@keyframes head-idle{0%{transform:rotate(0)}30%{transform:rotate(2deg)}70%{transform:rotate(-1deg)}100%{transform:rotate(0)}}
/* Nod with stride + slight forward lean (looks into travel direction after scaleX flip) */
@keyframes head-walk{
  0%,100%{transform:rotate(-5deg) translate(2px,-1px)}
  25%{transform:rotate(1deg) translate(1px,2px)}
  50%{transform:rotate(4deg) translate(2px,-1px)}
  75%{transform:rotate(-2deg) translate(1px,2px)}
}
@keyframes head-run{
  0%,100%{transform:rotate(-8deg) translate(3px,0)}
  25%{transform:rotate(0deg) translate(2px,2px)}
  50%{transform:rotate(5deg) translate(3px,0)}
  75%{transform:rotate(-3deg) translate(2px,2px)}
}
@keyframes head-jump{0%{transform:rotate(-6deg) translateY(2px)}40%{transform:rotate(4deg) translateY(-2px)}100%{transform:rotate(-2deg)}}
@keyframes head-runJump{0%{transform:rotate(-8deg)}40%{transform:rotate(5deg)}100%{transform:rotate(-3deg)}}
@keyframes head-climb{0%,100%{transform:rotate(-10deg) translateY(-3px)}50%{transform:rotate(-6deg) translateY(-1px)}}
@keyframes head-crawl{0%,100%{transform:rotate(10deg) translateY(5px)}}
@keyframes head-attack{0%{transform:rotate(0)}40%{transform:rotate(-10deg)}100%{transform:rotate(0)}}
@keyframes head-hurt{0%{transform:rotate(0)}30%{transform:rotate(-8deg)}60%{transform:rotate(5deg)}100%{transform:rotate(0)}}
@keyframes head-fall{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes head-dead{0%,100%{transform:rotate(0deg)}}
@keyframes head-default{0%,100%{transform:rotate(0)}}

@keyframes eyes-blink{0%,88%{transform:scaleY(1)}94%{transform:scaleY(0.08)}100%{transform:scaleY(1)}}
@keyframes eyes-hurt{0%{transform:scaleY(1)}25%{transform:scaleY(0.12)}70%{transform:scaleY(0.12)}100%{transform:scaleY(1)}}
@keyframes eyes-half{0%,100%{transform:scaleY(0.45)}}
/* Pupils glance forward while walking */
@keyframes pupils-look{
  0%,100%{transform:translate(1.5px,0)}
  50%{transform:translate(2.5px,0.5px)}
}
`;

const PART_KEYS: Record<string, Set<CoreAction>> = {
  tail: new Set(['idle', 'walk', 'run', 'jump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
  lleg: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
  rleg: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
  larm: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
  rarm: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
  body: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
  head: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead']),
};

export function normalizeAction(action: Action): CoreAction {
  if (action === 'flinch') return 'hurt';
  if (action === 'tossed') return 'fall';
  if (action === 'spin') return 'attack';
  if (action === 'grapple') return 'climb';
  return action;
}

function partAnim(part: string, action: Action, walkDur = 0.75, runDur = 0.5): string {
  const core = normalizeAction(action);
  const safe = PART_KEYS[part]?.has(core)
    ? core
    : core === 'runJump' && PART_KEYS[part]?.has('run')
      ? 'run'
      : 'idle';
  const key = `${part}-${safe}`;
  const once = core === 'hurt' || core === 'attack' || core === 'dead' || core === 'jump' || core === 'runJump';
  const loco = core === 'walk' || core === 'run' || core === 'crawl' || core === 'climb';
  const dur =
    core === 'hurt' ? '0.28s' :
    core === 'attack' ? '0.55s' :
    core === 'dead' ? '1.4s' :
    core === 'jump' || core === 'runJump' ? '0.55s' :
    core === 'climb' ? '0.55s' :
    core === 'crawl' ? '0.45s' :
    core === 'fall' ? '0.45s' :
    core === 'run' ? `${runDur}s` :
    core === 'walk' ? `${walkDur}s` :
    '2.4s';
  // Linear gait timing so limb phase stays locked to constant travel speed
  const ease = once ? 'ease-out' : loco ? 'linear' : 'ease-in-out';
  const iter = once ? '1 forwards' : 'infinite';
  return `${key} ${dur} ${ease} ${iter}`;
}

export function CatBody({
  emotion,
  action,
  walkDur = 0.75,
  runDur = 0.5,
}: {
  emotion: string;
  action: Action;
  walkDur?: number;
  runDur?: number;
}) {
  const core = normalizeAction(action);
  const happy = emotion === 'happy' || emotion === 'celebrate';
  const faceHurt = core === 'hurt' || core === 'fall';
  const faceDead = core === 'dead';
  const faceAttack = core === 'attack';
  const faceClimb = core === 'climb';
  const faceCrawl = core === 'crawl';
  const faceLoco = core === 'walk' || core === 'run' || core === 'runJump';
  const overrideFace = faceHurt || faceDead || faceAttack || faceClimb || faceCrawl;

  let eyeRx = happy && !overrideFace ? '3.2' : '4.8';
  let eyeRy = happy && !overrideFace ? '2.2' : '4.8';
  if (faceLoco) { eyeRx = '4.6'; eyeRy = '4.2'; } // alert while moving
  if (faceAttack) { eyeRx = '4'; eyeRy = '3'; }
  if (faceCrawl) { eyeRx = '4.5'; eyeRy = '2.2'; }
  if (faceClimb) { eyeRx = '4.5'; eyeRy = '4.5'; }

  const eyeAnim = faceHurt || faceDead
    ? 'eyes-hurt 0.35s ease-out'
    : faceCrawl
      ? 'eyes-half 1s ease-in-out infinite'
      : faceLoco
        ? 'eyes-blink 4.2s ease-in-out infinite'
        : 'eyes-blink 3.5s ease-in-out infinite';

  // Local +X is "forward" after the parent scaleX flip for facing
  const pupilY = faceClimb ? 38 : faceCrawl ? 43 : faceLoco ? 40.5 : 40;
  const pupilXOff = faceAttack ? 0 : faceLoco ? 3.2 : 2;
  const showSmile = (happy || faceLoco) && !overrideFace && emotion !== 'sad';

  return (
    <svg width={W} height={H} viewBox="0 0 145 125" overflow="visible" className="drop-shadow-lg">
      <style>{PART_STYLES}</style>

      {/* Thick tapered tail — LEFT hip so it stays behind when facing +X (forward) */}
      <g className="mc-part mc-tail" style={{ animation: partAnim('tail', action, walkDur, runDur) }}>
        <path
          d="M30 80 C16 68 -2 66 -12 78 C-16 86 -8 96 6 94 C16 93 24 88 30 80 Z"
          fill="#E67E22"
          stroke="#C05A00"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <ellipse cx="-8" cy="80" rx="5" ry="4.5" fill="#D35400" />
        <path d="M24 82 Q8 74 -4 80" fill="none" stroke="#F5B041" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      </g>

      <g className="mc-part mc-leg" style={{ animation: partAnim('lleg', action, walkDur, runDur) }}>
        <ellipse cx="45" cy="104" rx="11" ry="12" fill="#D35400" stroke="#A04000" strokeWidth="1" />
        <ellipse cx="45" cy="114" rx="9" ry="11" fill="#C05000" stroke="#A04000" strokeWidth="0.8" />
        <ellipse cx="45" cy="122" rx="13" ry="6" fill="#E67E22" />
        <ellipse cx="45" cy="121" rx="9" ry="4" fill="#F5CBA7" />
      </g>

      <g className="mc-part mc-leg" style={{ animation: partAnim('rleg', action, walkDur, runDur) }}>
        <ellipse cx="75" cy="104" rx="11" ry="12" fill="#D35400" stroke="#A04000" strokeWidth="1" />
        <ellipse cx="75" cy="114" rx="9" ry="11" fill="#C05000" stroke="#A04000" strokeWidth="0.8" />
        <ellipse cx="75" cy="122" rx="13" ry="6" fill="#E67E22" />
        <ellipse cx="75" cy="121" rx="9" ry="4" fill="#F5CBA7" />
      </g>

      <g className="mc-part mc-body" style={{ animation: partAnim('body', action, walkDur, runDur) }}>
        <ellipse cx="60" cy="80" rx="35" ry="30" fill="#F39C12" stroke="#E67E22" strokeWidth="1" />
        <ellipse cx="60" cy="88" rx="22" ry="18" fill="#FDEBD0" />
      </g>

      <g className="mc-part mc-arm" style={{ animation: partAnim('larm', action, walkDur, runDur) }}>
        <ellipse cx="30" cy="78" rx="8" ry="13" fill="#E67E22" stroke="#C05A00" strokeWidth="1" />
        <ellipse cx="30" cy="90" rx="7" ry="11" fill="#D4700A" stroke="#B05000" strokeWidth="0.8" />
        <ellipse cx="28" cy="99" rx="8" ry="5" fill="#F5CBA7" stroke="#D4A373" strokeWidth="0.5" />
      </g>

      <g className="mc-part mc-arm" style={{ animation: partAnim('rarm', action, walkDur, runDur) }}>
        <ellipse cx="90" cy="78" rx="8" ry="13" fill="#E67E22" stroke="#C05A00" strokeWidth="1" />
        <ellipse cx="90" cy="90" rx="7" ry="11" fill="#D4700A" stroke="#B05000" strokeWidth="0.8" />
        <ellipse cx="92" cy="99" rx="8" ry="5" fill="#F5CBA7" stroke="#D4A373" strokeWidth="0.5" />
      </g>

      <g className="mc-part mc-head" style={{ animation: partAnim('head', action, walkDur, runDur) }}>
        <ellipse cx="60" cy="45" rx="30" ry="27" fill="#F39C12" />
        <polygon points="33,30 28,5 45,20" fill="#F39C12" />
        <polygon points="35,25 32,12 42,20" fill="#F5B7B1" />
        <polygon points="87,30 92,5 75,20" fill="#F39C12" />
        <polygon points="85,25 88,12 78,20" fill="#F5B7B1" />
        <ellipse cx="60" cy="52" rx="22" ry="17" fill="#FDEBD0" />

        {faceDead ? (
          <>
            <text x="48" y="46" fontSize="14" fill="#2C3E50" textAnchor="middle" fontWeight="bold">×</text>
            <text x="72" y="46" fontSize="14" fill="#2C3E50" textAnchor="middle" fontWeight="bold">×</text>
            <ellipse cx="42" cy="50" rx="2" ry="3" fill="#85C1E9" opacity="0.8" />
            <ellipse cx="78" cy="50" rx="2" ry="3" fill="#85C1E9" opacity="0.8" />
          </>
        ) : (
          <>
            <g style={{ transformBox: 'view-box', transformOrigin: '48px 42px', animation: eyeAnim }}>
              <ellipse cx="48" cy="42" rx={eyeRx} ry={eyeRy} fill="#2C3E50" />
              {!faceHurt && (
                <g style={{
                  transformBox: 'view-box',
                  transformOrigin: '48px 42px',
                  animation: faceLoco ? `pupils-look ${walkDur}s linear infinite` : undefined,
                }}>
                  <circle cx={48 + pupilXOff} cy={pupilY} r={faceLoco ? 2.2 : 2} fill="white" />
                  <circle cx={48 + pupilXOff + 1.2} cy={pupilY - 1} r="0.8" fill="white" opacity="0.7" />
                </g>
              )}
            </g>
            <g style={{ transformBox: 'view-box', transformOrigin: '72px 42px', animation: eyeAnim }}>
              <ellipse cx="72" cy="42" rx={eyeRx} ry={eyeRy} fill="#2C3E50" />
              {!faceHurt && (
                <g style={{
                  transformBox: 'view-box',
                  transformOrigin: '72px 42px',
                  animation: faceLoco ? `pupils-look ${walkDur}s linear infinite` : undefined,
                }}>
                  <circle cx={72 + pupilXOff} cy={pupilY} r={faceLoco ? 2.2 : 2} fill="white" />
                  <circle cx={72 + pupilXOff + 1.2} cy={pupilY - 1} r="0.8" fill="white" opacity="0.7" />
                </g>
              )}
            </g>
          </>
        )}

        {faceHurt && !faceDead && (
          <>
            <line x1="42" y1="36" x2="54" y2="48" stroke="#E74C3C" strokeWidth="1.5" opacity="0.75" />
            <line x1="78" y1="36" x2="66" y2="48" stroke="#E74C3C" strokeWidth="1.5" opacity="0.75" />
          </>
        )}

        <ellipse cx="60" cy="52" rx="3" ry="2" fill="#E74C3C" />

        {faceDead || faceHurt ? (
          <ellipse cx="60" cy="58" rx="5" ry="3.5" fill="#2C3E50" />
        ) : faceAttack ? (
          <path d="M54 57 L66 57 M56 59 L64 59" fill="none" stroke="#2C3E50" strokeWidth="1.4" strokeLinecap="round" />
        ) : showSmile ? (
          <path d="M53 56 Q60 63 67 56" fill="none" stroke="#2C3E50" strokeWidth="1.35" strokeLinecap="round" />
        ) : emotion === 'sad' && !overrideFace ? (
          <path d="M54 58 Q60 54 66 58" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
        ) : (
          <line x1="56" y1="57" x2="64" y2="57" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
        )}

        <line x1="28" y1="50" x2="42" y2="52" stroke="#BDC3C7" strokeWidth="0.7" />
        <line x1="28" y1="54" x2="42" y2="54" stroke="#BDC3C7" strokeWidth="0.7" />
        <line x1="78" y1="52" x2="92" y2="50" stroke="#BDC3C7" strokeWidth="0.7" />
        <line x1="78" y1="54" x2="92" y2="54" stroke="#BDC3C7" strokeWidth="0.7" />

        {(happy || faceLoco) && !overrideFace && (
          <>
            <ellipse cx="38" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity={faceLoco ? 0.35 : 0.5} />
            <ellipse cx="82" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity={faceLoco ? 0.35 : 0.5} />
          </>
        )}

        <path d="M54 30 L56 35 L60 32 L64 35 L66 30" fill="none"
          stroke="#D68910" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />

        {faceHurt && !faceDead && (
          <text x="78" y="22" fontSize="18" fontWeight="bold" fill="#E74C3C" textAnchor="middle">!</text>
        )}
      </g>
    </svg>
  );
}

/* ═══ Helpers ═══ */

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function easeOutQuad(t: number) { return 1 - (1 - t) * (1 - t); }

/** Visible CSS border / outline — required for “empty” containers to be footholds. */
function hasVisibleBorder(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (el.hasAttribute('data-mascot-platform')) return true;
  if (el.getAttribute('data-slot') === 'card') return true;
  const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
  const styles = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
  for (let i = 0; i < 4; i++) {
    if (parseFloat(widths[i]!) > 0 && styles[i] !== 'none') return true;
  }
  if (parseFloat(cs.outlineWidth || '0') > 0 && cs.outlineStyle !== 'none') return true;
  return false;
}

function isTextFoothold(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (!['p', 'h1', 'h2', 'h3', 'h4', 'label', 'span'].includes(tag)) return false;
  // Leaf lines only — skip wrapper spans that wrap whole card sections
  if (el.childElementCount > 0) return false;
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length >= 2 && text.length < 80;
}

function isControlFoothold(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button';
}

function pushLedge(
  cands: Array<Platform & { score: number }>,
  top: number,
  left: number,
  right: number,
  score: number,
) {
  cands.push({ top, left, right, bottom: top + 2, score });
}

/**
 * Stand rules:
 * 1) Visible border → stand on TOP / BOTTOM ledge only (never the empty interior)
 * 2) Else leaf text or buttons/links
 */
function scanPlatforms(groundY: number): Platform[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const headerSkip = 52;

  const nodes = document.querySelectorAll<HTMLElement>(
    '[data-mascot-platform], [data-slot="card"], [data-slot="badge"], ' +
    '[class*="border"], ' +
    'button, a, [role="button"], ' +
    'li > button, tr, ' +
    '.recharts-wrapper, [class*="recharts"], ' +
    'h1, h2, h3, h4, p, label, span',
  );

  type Cand = Platform & { score: number };
  const cands: Cand[] = [];

  for (const el of nodes) {
    if (el.closest('[data-mascot-root]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;

    const bordered = hasVisibleBorder(el, cs);
    const textOk = isTextFoothold(el);
    const controlOk = isControlFoothold(el);
    const cls = typeof el.className === 'string' ? el.className : '';
    const isChart = el.classList.contains('recharts-wrapper') || cls.includes('recharts');
    const isCard = el.getAttribute('data-slot') === 'card' || el.hasAttribute('data-mascot-platform');

    if (!bordered && !textOk && !controlOk && !isChart) continue;
    if (isChart && !bordered && !el.hasAttribute('data-mascot-platform')) continue;

    const r = el.getBoundingClientRect();
    if (r.top >= groundY - 2 || r.bottom <= headerSkip) continue;
    if (r.width >= vw * 0.92 && r.height > vh * 0.5) continue;
    if (r.height > vh * 0.55 && !isChart && !isCard) continue;

    // Tall bordered boxes (settings cards…): ONLY top/bottom ledges — not a solid floor through the void
    const tallBox = bordered && r.height > 88;
    if (tallBox || isCard) {
      if (r.width < 72) continue;
      let score = isCard || el.hasAttribute('data-mascot-platform') ? 70 : 45;
      if (r.width <= 420) score += 10;
      pushLedge(cands, r.top, r.left, r.right, score);
      if (r.bottom < groundY - 4) pushLedge(cands, r.bottom, r.left, r.right, score - 8);
      continue;
    }

    const minW = textOk ? 36 : controlOk ? 56 : 56;
    const minH = textOk ? 11 : controlOk ? 26 : 28;
    if (r.width < minW || r.height < minH) continue;
    if (textOk && r.height > 40) continue;
    if (r.top < headerSkip && r.height < 56) continue;

    let score = 4;
    if (el.hasAttribute('data-mascot-platform')) score += 100;
    if (controlOk) score += 58;
    if (textOk) score += 48;
    if (bordered) score += 42;
    if (isChart) score += 50;
    if (r.width <= 280 && r.height <= 48) score += 22;
    if (r.left > 48 && r.left < vw * 0.9) score += 6;

    pushLedge(cands, r.top, r.left, r.right, score);
  }

  cands.sort((a, b) => b.score - a.score || a.top - b.top);
  const out: Platform[] = [];
  for (const c of cands) {
    const dup = out.some(o =>
      Math.abs(o.top - c.top) < 5
      && !(c.right < o.left + 6 || c.left > o.right - 6),
    );
    if (dup) continue;
    out.push({ top: c.top, left: c.left, right: c.right, bottom: c.bottom });
    if (out.length >= 50) break;
  }
  return out.sort((a, b) => a.top - b.top);
}

function isOnGround(y: number, gY: number) {
  return Math.abs(y - gY) < 10;
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

function isFloating(x: number, y: number, plats: Platform[], gY: number) {
  if (isOnGround(y, gY)) return false;
  return !currentPlatform(plats, x, y + H);
}

/** If floating in empty space, snap feet onto nearest legal surface or ground. */
function snapToSupport(x: number, y: number, platforms: Platform[], gY: number): number {
  const foot = y + H;
  if (currentPlatform(platforms, x, foot)) return y;
  if (Math.abs(y - gY) < 8) return gY;

  const aligned = platforms
    .filter(p => x + W > p.left + 4 && x < p.right - 4)
    .map(p => ({ y: p.top - H, dist: Math.abs(p.top - foot) }))
    .sort((a, b) => a.dist - b.dist);

  if (aligned[0] && aligned[0].dist < 100) return clamp(aligned[0].y, 0, gY);
  return gY;
}

function pickWeighted(weights: ActivityProfile['weights']): keyof ActivityProfile['weights'] {
  const entries = Object.entries(weights) as [keyof ActivityProfile['weights'], number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return 'walk';
}

function fallDuration(distY: number) {
  return clamp(550 + Math.abs(distY) * 4.5, 1200, 2800);
}

/** Duration so N stride-cycles cover the distance at a constant speed. */
function locoPlan(distX: number, cycleDur: number, stride: number) {
  const cycles = Math.max(2, Math.round(Math.abs(distX) / stride));
  const matchedDist = cycles * stride;
  return { cycles, matchedDist, durationMs: cycles * cycleDur * 1000 };
}

/* ═══ Parachute ═══ */

function Parachute({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-10"
      style={{
        top: -52,
        animation: 'chuteOpen 0.28s ease-out both',
      }}
    >
      <svg width="96" height="52" viewBox="0 0 96 52" overflow="visible">
        <path d="M8 22 Q48 2 88 22" fill="#F87171" stroke="#DC2626" strokeWidth="2.2" />
        <path d="M14 22 Q48 8 82 22" fill="#FECACA" stroke="#F87171" strokeWidth="1.2" />
        <path d="M20 22 Q48 12 76 22" fill="#FEE2E2" opacity="0.9" />
        <line x1="22" y1="22" x2="40" y2="36" stroke="#6B7280" strokeWidth="1.3" />
        <line x1="48" y1="20" x2="48" y2="36" stroke="#6B7280" strokeWidth="1.3" />
        <line x1="74" y1="22" x2="56" y2="36" stroke="#6B7280" strokeWidth="1.3" />
      </svg>
    </div>
  );
}

/* ═══ Component ═══ */

export function MascotOverlay() {
  const visible = useMascotStore((s) => s.visible);
  const message = useMascotStore((s) => s.message);
  const emotion = useMascotStore((s) => s.emotion);
  const activity = useMascotStore((s) => s.activity);
  const setActivity = useMascotStore((s) => s.setActivity);
  const profile = PROFILES[activity] ?? PROFILES.medium;

  const groundY = () => window.innerHeight - H - MARGIN;
  const maxX = () => window.innerWidth - W - 5;

  const [pos, setPos] = useState(() => ({ x: rand(30, Math.max(40, window.innerWidth - W - 20)), y: groundY() }));
  const [action, setAction] = useState<CoreAction>('idle');
  const [facingRight, setFacingRight] = useState(true);
  const [chuteOpen, setChuteOpen] = useState(false);
  const [ropeOn, setRopeOn] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const ropeLineRef = useRef<SVGLineElement>(null);
  const ropeHookRef = useRef<SVGGElement>(null);
  const ropeRef = useRef<RopeAnchor | null>(null);
  const posRef = useRef(pos);
  const actionRef = useRef(action);
  const facingRef = useRef(true);
  const motionRef = useRef<Motion | null>(null);
  const rafRef = useRef(0);
  const throwRafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const draggingRef = useRef(false);
  const interactingRef = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });
  const lastClick = useRef(0);
  const tapCombo = useRef(0);
  const scheduleRef = useRef<() => void>(() => {});
  const reactSupportRef = useRef<(plats: Platform[], gY: number) => void>(() => {});
  const doFallRef = useRef<(
    toX: number,
    toY: number,
    hard: boolean,
    opts?: { interact?: boolean; vibe?: 'scroll' | 'soft' | 'toss' },
  ) => void>(() => {});
  const [bodyFx, setBodyFx] = useState<'none' | 'land' | 'twirl'>('none');

  posRef.current = pos;
  actionRef.current = action;
  facingRef.current = facingRight;

  const setBusy = (v: boolean) => { busyRef.current = v; };

  const clearRope = useCallback(() => {
    ropeRef.current = null;
    setRopeOn(false);
    if (throwRafRef.current) {
      cancelAnimationFrame(throwRafRef.current);
      throwRafRef.current = 0;
    }
  }, []);

  const paintRope = useCallback((catX: number, catY: number, throwT: number) => {
    const anchor = ropeRef.current;
    const line = ropeLineRef.current;
    const hook = ropeHookRef.current;
    if (!anchor || !line) return;
    // Paw toward facing direction
    const handX = catX + (facingRef.current ? W * 0.62 : W * 0.38);
    const handY = catY + 18;
    const x2 = handX + (anchor.ax - handX) * throwT;
    const y2 = handY + (anchor.ay - handY) * throwT;
    line.setAttribute('x1', String(handX));
    line.setAttribute('y1', String(handY));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    if (hook) {
      // Hang hook so the claw opens downward onto the ledge
      const ang = (Math.atan2(anchor.ay - handY, anchor.ax - handX) * 180) / Math.PI + 90;
      hook.setAttribute('transform', `translate(${x2}, ${y2}) rotate(${ang})`);
    }
  }, []);

  const playLandFx = useCallback(() => {
    setBodyFx('land');
    window.setTimeout(() => setBodyFx('none'), 420);
  }, []);

  const speakLand = useCallback((kind: 'climb' | 'soft' | 'scroll' | 'hop') => {
    const lines: Record<typeof kind, string[]> = {
      climb: ['Tới rồi!', 'Ngồi đây nè!', 'Hihi~', 'Cao ghê!', 'Ổn áp!'],
      soft: ['Êm ru!', 'Đáp!', 'Nhẹ nhàng~', 'Ổn áp!'],
      scroll: ['Ối!', 'Nền chạy mất!', 'Ngã kìa!'],
      hop: ['Nhảy cái!', 'Hehe~', 'Êm!'],
    };
    const pool = lines[kind];
    useMascotStore.getState().speak(pool[Math.floor(Math.random() * pool.length)]!, kind === 'scroll' ? 'warning' : 'happy');
  }, []);

  /** Live position: DOM during motion (no React thrash); sync state when settled. */
  const applyPos = useCallback((x: number, y: number, syncReact = false) => {
    const next = { x, y };
    posRef.current = next;
    const el = containerRef.current;
    if (el) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    if (ropeRef.current) paintRope(x, y, 1);
    if (syncReact) setPos(next);
  }, [paintRope]);

  /** Idle on a legal surface only (border / text / button); drop rope leftovers. */
  const settleIdle = useCallback((x: number, y: number) => {
    clearRope();
    const gY = groundY();
    const plats = scanPlatforms(gY);
    setPlatforms(plats);
    const sy = snapToSupport(x, y, plats, gY);
    applyPos(x, sy, true);
    setAction('idle');
    setBusy(false);
    interactingRef.current = false;
  }, [applyPos, clearRope]);

  const finishMotion = useCallback((m: Motion, x: number, y: number) => {
    motionRef.current = null;
    setChuteOpen(false);
    if (m.onDone) {
      applyPos(x, y, true);
      m.onDone({ x, y, hard: m.hardLand });
    } else {
      settleIdle(x, y);
      scheduleRef.current();
    }
  }, [applyPos, settleIdle]);

  const tick = useCallback((now: number) => {
    const m = motionRef.current;
    if (!m) {
      rafRef.current = 0;
      return;
    }
    const t = clamp((now - m.start) / m.duration, 0, 1);
    let x: number;
    let y: number;

    if (m.kind === 'fall') {
      const deployEnd = 0.18;
      let u: number;
      if (t < deployEnd) {
        u = easeOutQuad(t / deployEnd) * 0.22;
      } else {
        const g = (t - deployEnd) / (1 - deployEnd);
        u = 0.22 + easeOutQuad(g) * 0.78;
      }
      if (t > 0.06 && !m.parachute && !m.noChute) {
        m.parachute = true;
        setChuteOpen(true);
      }
      x = m.fromX + (m.toX - m.fromX) * easeInOutCubic(t);
      y = m.fromY + (m.toY - m.fromY) * u;

      // Scroll can slide a foothold under the cat mid-fall — catch & land early
      if (!m.hardLand) {
        const gY = groundY();
        const catchY = findSurface(scanPlatforms(gY), x, y + H, gY);
        if (catchY >= y - 4 && catchY < m.toY - 6) m.toY = catchY;
        if (y >= m.toY - 3) {
          finishMotion(m, x, m.toY);
          rafRef.current = 0;
          return;
        }
      }
    } else if (m.kind === 'jump') {
      const e = easeInOutCubic(t);
      x = m.fromX + (m.toX - m.fromX) * e;
      const base = m.fromY + (m.toY - m.fromY) * e;
      const arc = -Math.sin(t * Math.PI) * 36;
      y = base + arc;
    } else if (m.kind === 'climb') {
      // Mild ease so climb doesn't feel robotic, limbs still linear-cycled
      const e = easeInOutCubic(t);
      x = m.fromX + (m.toX - m.fromX) * e;
      y = m.fromY + (m.toY - m.fromY) * e;
    } else if (m.kind === 'loco') {
      // Constant horizontal speed (= stride / cycleDur). Vertical bounce is CSS gaitBob.
      x = m.fromX + (m.toX - m.fromX) * t;
      y = m.fromY;
    } else {
      const e = easeInOutCubic(t);
      x = m.fromX + (m.toX - m.fromX) * e;
      y = m.fromY + (m.toY - m.fromY) * e;
    }

    applyPos(x, y);
    if (t >= 1) {
      finishMotion(m, m.toX, m.toY);
      rafRef.current = 0;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyPos, finishMotion]);

  const startMotion = useCallback((partial: Omit<Motion, 'start'> & { start?: number }) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const motion: Motion = { ...partial, start: partial.start ?? performance.now() };
    motionRef.current = motion;
    setBusy(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const doLoco = useCallback((tx: number, mode: 'walk' | 'run') => {
    const from = posRef.current;
    const gY = groundY();
    const plats = scanPlatforms(gY);
    setPlatforms(plats);
    // Never stroll through empty air / card voids
    if (isFloating(from.x, from.y, plats, gY)) {
      let landY = findSurface(plats, from.x, from.y + H, gY);
      if (landY < from.y + 8) landY = gY;
      doFallRef.current(from.x, landY, false, { interact: true, vibe: 'scroll' });
      return;
    }
    const plat = currentPlatform(plats, from.x, from.y + H);
    const range = plat
      ? { lo: plat.left + 5, hi: Math.max(plat.left + 5, plat.right - W - 5) }
      : { lo: 5, hi: maxX() };
    if (plat && range.hi - range.lo < STRIDE.walk) {
      settleIdle(from.x, from.y);
      scheduleRef.current();
      return;
    }
    // Only walk forward: face the travel direction; turn at edges (no moonwalk)
    let dir = Math.sign(tx - from.x) || (facingRef.current ? 1 : -1);
    if (dir > 0 && from.x >= range.hi - 2) dir = -1;
    if (dir < 0 && from.x <= range.lo + 2) dir = 1;
    setFacingRight(dir > 0);
    facingRef.current = dir > 0;
    let toX = clamp(from.x + dir * Math.max(Math.abs(tx - from.x), STRIDE.walk * 2), range.lo, range.hi);
    if (Math.abs(toX - from.x) < STRIDE.walk) {
      toX = clamp(from.x + dir * STRIDE.walk * 2, range.lo, range.hi);
    }
    if (Math.abs(toX - from.x) < 4) {
      settleIdle(from.x, from.y);
      scheduleRef.current();
      return;
    }
    const cycleDur = mode === 'run' ? profile.runDur : profile.walkDur;
    const stride = mode === 'run' ? STRIDE.run : STRIDE.walk;
    const plan = locoPlan(toX - from.x, cycleDur, stride);
    // Snap travel to whole strides so feet "plant" with movement
    toX = clamp(from.x + dir * plan.matchedDist, range.lo, range.hi);
    const plan2 = locoPlan(toX - from.x, cycleDur, stride);
    setAction(mode);
    startMotion({
      kind: 'loco',
      fromX: from.x,
      fromY: from.y,
      toX,
      toY: from.y,
      duration: plan2.durationMs,
      parachute: false,
      hardLand: false,
      locoAction: mode,
      onDone: ({ x, y }) => {
        settleIdle(x, y);
        scheduleRef.current();
      },
    });
  }, [profile, startMotion, settleIdle]);

  const doJump = useCallback((tx?: number, runJump = false) => {
    const from = posRef.current;
    const toX = clamp(tx ?? from.x, 5, maxX());
    const faceR = toX >= from.x;
    setFacingRight(faceR);
    facingRef.current = faceR;
    setAction(runJump ? 'runJump' : 'jump');
    startMotion({
      kind: 'jump',
      fromX: from.x,
      fromY: from.y,
      toX,
      toY: from.y,
      duration: runJump ? 700 : 600,
      parachute: false,
      hardLand: false,
      locoAction: 'walk',
      onDone: ({ x, y }) => {
        playLandFx();
        speakLand('hop');
        setTimeout(() => {
          settleIdle(x, y);
          scheduleRef.current();
        }, 280);
      },
    });
  }, [startMotion, settleIdle, playLandFx, speakLand]);

  /** Throw grappling rope UP only, then climb along it. */
  const doClimb = useCallback((targetY: number, targetX: number) => {
    const from = posRef.current;
    const toY = clamp(targetY, 0, groundY());
    const toX = clamp(targetX, 5, maxX());
    // Never rope downward
    if (toY >= from.y - 12) {
      doJump(toX, false);
      return;
    }
    const faceR = toX >= from.x;
    setFacingRight(faceR);
    facingRef.current = faceR;
    setBusy(true);
    // Latch onto the platform TOP edge (foot line)
    ropeRef.current = { ax: toX + W / 2, ay: toY + H };
    setRopeOn(true);
    setAction('attack');
    paintRope(from.x, from.y, 0);

    const throwStart = performance.now();
    const THROW_MS = 480;
    const throwStep = (now: number) => {
      const t = clamp((now - throwStart) / THROW_MS, 0, 1);
      paintRope(posRef.current.x, posRef.current.y, easeOutQuad(t));
      if (t < 1) {
        throwRafRef.current = requestAnimationFrame(throwStep);
        return;
      }
      throwRafRef.current = 0;
      setAction('climb');
      const dist = Math.hypot(toX - from.x, toY - from.y);
      startMotion({
        kind: 'climb',
        fromX: from.x,
        fromY: from.y,
        toX,
        toY,
        duration: clamp(1100 + dist * 3, 1300, 2600),
        parachute: false,
        hardLand: false,
        locoAction: 'walk',
        onDone: ({ x, y }) => {
          clearRope();
          playLandFx();
          speakLand('climb');
          applyPos(x, y, true);
          setAction('idle');
          setTimeout(() => {
            settleIdle(x, y);
            scheduleRef.current();
          }, 380);
        },
      });
    };
    throwRafRef.current = requestAnimationFrame(throwStep);
  }, [startMotion, doJump, paintRope, settleIdle, clearRope, playLandFx, speakLand, applyPos]);

  /** Drop / hop DOWN — never throw a rope. */
  const doDescend = useCallback((targetY: number, targetX: number) => {
    const from = posRef.current;
    const toY = clamp(targetY, 0, groundY());
    const toX = clamp(targetX, 5, maxX());
    if (toY <= from.y + 8) {
      doJump(toX, false);
      return;
    }
    const faceR = toX >= from.x;
    setFacingRight(faceR);
    facingRef.current = faceR;
    clearRope();
    const drop = toY - from.y;
    // Jump down for short drops; fall (+chute) for tall — never climb/rope
    const tall = drop > 120;
    setAction(tall ? 'fall' : 'jump');
    setBusy(true);
    setChuteOpen(false);
    startMotion({
      kind: tall ? 'fall' : 'jump',
      fromX: from.x,
      fromY: from.y,
      toX,
      toY,
      duration: tall ? fallDuration(drop) * 0.8 : clamp(520 + drop * 1.2, 560, 900),
      parachute: false,
      noChute: !tall,
      hardLand: false,
      locoAction: 'walk',
      onDone: ({ x, y }) => {
        setChuteOpen(false);
        playLandFx();
        speakLand(tall ? 'soft' : 'hop');
        setTimeout(() => {
          settleIdle(x, y);
          scheduleRef.current();
        }, 360);
      },
    });
  }, [startMotion, doJump, clearRope, settleIdle, playLandFx, speakLand]);

  const doCrawl = useCallback(() => {
    const from = posRef.current;
    const gY = groundY();
    const plats = scanPlatforms(gY);
    if (isFloating(from.x, from.y, plats, gY)) {
      let landY = findSurface(plats, from.x, from.y + H, gY);
      if (landY < from.y + 8) landY = gY;
      doFallRef.current(from.x, landY, false, { interact: true, vibe: 'scroll' });
      return;
    }
    const plat = currentPlatform(plats, from.x, from.y + H);
    setAction('crawl');
    setBusy(true);
    // Crawl forward in current facing; turn only at edges
    let dir = facingRef.current ? 1 : -1;
    const rangeProbe = plat
      ? { lo: plat.left + 5, hi: Math.max(plat.left + 5, plat.right - W - 5) }
      : { lo: 5, hi: maxX() };
    if (dir > 0 && from.x >= rangeProbe.hi - 2) dir = -1;
    if (dir < 0 && from.x <= rangeProbe.lo + 2) dir = 1;
    setFacingRight(dir > 0);
    facingRef.current = dir > 0;
    const range = plat
      ? { lo: plat.left + 5, hi: Math.max(plat.left + 5, plat.right - W - 5) }
      : { lo: 5, hi: maxX() };
    // Long slide: prefer near full platform width, or a long ground stretch
    const span = range.hi - range.lo;
    const desired = plat
      ? clamp(span * rand(0.55, 0.95), STRIDE.crawl * 4, span)
      : rand(220, 380);
    const toX = clamp(from.x + dir * desired, range.lo, range.hi);
    const plan = locoPlan(toX - from.x, 0.48, STRIDE.crawl);
    startMotion({
      kind: 'loco',
      fromX: from.x,
      fromY: from.y,
      toX: clamp(from.x + Math.sign(toX - from.x || dir) * plan.matchedDist, range.lo, range.hi),
      toY: from.y,
      duration: Math.max(plan.durationMs, 1400),
      parachute: false,
      hardLand: false,
      locoAction: 'walk',
      onDone: ({ x, y }) => {
        settleIdle(x, y);
        scheduleRef.current();
      },
    });
  }, [startMotion, settleIdle]);

  const doAttack = useCallback(() => {
    setAction('attack');
    setBusy(true);
    setTimeout(() => {
      const p = posRef.current;
      settleIdle(p.x, p.y);
      scheduleRef.current();
    }, 600);
  }, [settleIdle]);

  const doFall = useCallback((
    toX: number,
    toY: number,
    hard: boolean,
    opts?: { interact?: boolean; vibe?: 'scroll' | 'soft' | 'toss' },
  ) => {
    const from = posRef.current;
    clearRope();
    setAction('fall');
    setChuteOpen(false);
    const duration = fallDuration(toY - from.y);
    startMotion({
      kind: 'fall',
      fromX: from.x,
      fromY: from.y,
      toX,
      toY,
      duration,
      parachute: false,
      hardLand: hard,
      locoAction: 'walk',
      onDone: ({ x, y, hard: h }) => {
        playLandFx();
        if (h) {
          applyPos(x, y, true);
          setAction('dead');
          setChuteOpen(false);
          useMascotStore.getState().speak(
            ['Hu hu…', 'Mèo xỉu!', 'Ơ… đau quá!', 'Chết giả thôi!'][Math.floor(Math.random() * 4)]!,
            'sad',
          );
          setTimeout(() => {
            settleIdle(x, y);
            scheduleRef.current();
          }, 1400);
        } else if (opts?.interact) {
          applyPos(x, y, true);
          const vibe = opts.vibe ?? 'soft';
          if (vibe === 'scroll') {
            setAction('hurt');
            speakLand('scroll');
          } else {
            setAction('idle');
            speakLand('soft');
          }
          setTimeout(() => {
            settleIdle(x, y);
            scheduleRef.current();
          }, vibe === 'scroll' ? 480 : 400);
        } else {
          speakLand('soft');
          settleIdle(x, y);
          scheduleRef.current();
        }
      },
    });
  }, [applyPos, startMotion, settleIdle, clearRope, playLandFx, speakLand]);

  doFallRef.current = doFall;

  /** Scroll/resize moved UI out from under the feet → fall onto whatever is below. */
  const reactToLostSupport = useCallback((plats: Platform[], gY: number) => {
    if (draggingRef.current) return;
    if (actionRef.current === 'dead') return;

    const motion = motionRef.current;
    // Don't yank a deliberate hop mid-air into a scroll-fall
    if (motion?.kind === 'jump') return;

    const cur = posRef.current;
    if (Math.abs(cur.y - gY) < 10) return;

    const foot = cur.y + H;
    if (currentPlatform(plats, cur.x, foot)) return;

    let landY = findSurface(plats, cur.x, foot, gY);
    if (landY < cur.y - 2) landY = gY;
    const drop = landY - cur.y;
    if (drop < 10) {
      if (drop > 1) applyPos(cur.x, landY, true);
      return;
    }

    if (motion?.kind === 'fall') {
      if (landY < motion.toY - 6) motion.toY = landY;
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    motionRef.current = null;
    clearRope();
    setChuteOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    doFall(cur.x, landY, false, { interact: true, vibe: 'scroll' });
  }, [applyPos, clearRope, doFall]);

  reactSupportRef.current = reactToLostSupport;

  // Stable listeners — never cancel mascot RAF on re-render (that broke throw/fall).
  useEffect(() => {
    let scheduled = 0;
    const refresh = () => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        const gY = groundY();
        const plats = scanPlatforms(gY);
        setPlatforms(plats);
        reactSupportRef.current(plats, gY);
      });
    };
    refresh();
    const id = setInterval(refresh, 2500);
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      if (scheduled) cancelAnimationFrame(scheduled);
      clearInterval(id);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (throwRafRef.current) cancelAnimationFrame(throwRafRef.current);
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleRef.current = schedule;
    timerRef.current = setTimeout(() => {
      if (busyRef.current || draggingRef.current || motionRef.current) {
        schedule();
        return;
      }
      const gY = groundY();
      const plats = scanPlatforms(gY);
      setPlatforms(plats);
      const cur = posRef.current;
      // Floating in a card void / empty air → fall onto a ledge or the ground (never walk)
      if (isFloating(cur.x, cur.y, plats, gY)) {
        clearRope();
        let landY = findSurface(plats, cur.x, cur.y + H, gY);
        if (landY < cur.y + 8) landY = gY;
        doFall(cur.x, landY, false, { interact: true, vibe: 'scroll' });
        return;
      }
      const footY = cur.y + H;
      const onPlat = currentPlatform(plats, cur.x, footY);
      const surfY = onPlat ? onPlat.top : gY;
      const pick = pickWeighted(profile.weights);
      const platX = (p: Platform) => clamp(p.left + (p.right - p.left) / 2 - W / 2, 5, maxX());
      const platRange = (p: Platform | null) => p
        ? { lo: p.left + 5, hi: Math.max(p.left + 5, p.right - W - 5) }
        : { lo: 5, hi: maxX() };
      // Grapple only onto wide ledges (card edges) — not tiny text labels
      const climbOk = (p: Platform) => p.right - p.left >= 96;

      // Near the top of the viewport → strongly prefer dropping onto cards below
      const nearTop = cur.y < 120;
      const wantVertical = nearTop || pick === 'climb' || pick === 'runJump' || Math.random() < 0.32;
      if (wantVertical) {
        const near = plats.filter(p => p.left < cur.x + 220 && p.right > cur.x - 220);
        const above = near.filter(p => p.top < surfY - 48 && climbOk(p));
        const below = near.filter(p => p.top > surfY + 36 && p.top < gY - 8);
        const belowWide = plats.filter(p => p.top > surfY + 28 && p.top < cur.y + 280 && p.top < gY - 8);
        type Vert = { y: number; x: number; up: boolean };
        const choices: Vert[] = [
          ...above.map(p => ({ y: p.top - H, x: platX(p), up: true })),
          ...below.map(p => ({ y: p.top - H, x: platX(p), up: false })),
          ...belowWide.map(p => ({ y: p.top - H, x: platX(p), up: false })),
        ];
        if (onPlat) choices.push({ y: gY, x: clamp(cur.x + (facingRef.current ? 80 : -80), 5, maxX()), up: false });
        if (choices.length) {
          const ups = choices.filter(c => c.up);
          const downs = choices.filter(c => !c.up);
          let pool = choices;
          if (nearTop && downs.length) pool = downs;
          else if (ups.length && downs.length) pool = Math.random() < 0.4 ? ups : downs;
          const c = pool[Math.floor(Math.random() * pool.length)]!;
          if (c.up) doClimb(c.y, c.x);
          else doDescend(c.y, c.x);
          return;
        }
      }

      // Side hop onto another ledge at similar height
      if ((pick === 'jump' || Math.random() < 0.2)) {
        const side = plats.filter(p =>
          Math.abs(p.top - surfY) < 36 &&
          (p.right < cur.x - 10 || p.left > cur.x + W + 10) &&
          Math.abs(platX(p) - cur.x) < 220,
        );
        if (side.length && Math.random() < 0.55) {
          const t = side[Math.floor(Math.random() * side.length)]!;
          doJump(platX(t), pick === 'runJump');
          return;
        }
      }

      if (pick === 'jump' || pick === 'runJump') {
        const range = platRange(onPlat);
        if (onPlat && Math.random() < 0.35) {
          doDescend(gY, clamp(cur.x + rand(-140, 140), 5, maxX()));
          return;
        }
        doJump(clamp(cur.x + rand(-100, 100), range.lo, range.hi), pick === 'runJump');
        return;
      }
      if (pick === 'crawl') { doCrawl(); return; }
      if (pick === 'attack') { doAttack(); return; }
      if (pick === 'run') {
        const range = platRange(onPlat);
        const span = onPlat
          ? Math.max(STRIDE.run * 2, (range.hi - range.lo) * rand(0.4, 0.9))
          : rand(140, 320);
        const dir = facingRef.current ? 1 : -1;
        doLoco(clamp(cur.x + dir * span, range.lo, range.hi), 'run');
        return;
      }
      {
        const range = platRange(onPlat);
        const span = onPlat
          ? Math.max(STRIDE.walk * 2, (range.hi - range.lo) * rand(0.35, 0.85))
          : rand(160, 300);
        const dir = facingRef.current ? 1 : -1;
        doLoco(clamp(cur.x + dir * span, range.lo, range.hi), 'walk');
      }
    }, rand(profile.delay[0], profile.delay[1]));
  }, [profile, doClimb, doDescend, doJump, doCrawl, doAttack, doLoco, doFall, clearRope]);

  useEffect(() => {
    scheduleRef.current = schedule;
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [schedule]);

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
    const tickIdle = () => {
      if (interactingRef.current || busyRef.current) {
        idleTimer = setTimeout(tickIdle, 5000);
        return;
      }
      if (Date.now() - lastSpeak > 20000) {
        useMascotStore.getState().speak(phrases[Math.floor(Math.random() * phrases.length)]!, 'idle');
        lastSpeak = Date.now();
      }
      idleTimer = setTimeout(tickIdle, 5000);
    };
    idleTimer = setTimeout(tickIdle, 15000);
    return () => clearTimeout(idleTimer);
  }, []);

  const cycleActivity = () => {
    const now = Date.now();
    if (now - lastClick.current < 400) {
      const next: Record<MascotActivity, MascotActivity> = { low: 'medium', medium: 'high', high: 'low' };
      setActivity(next[activity]);
      useMascotStore.getState().speak(
        next[activity] === 'high' ? 'Full năng lượng!' : next[activity] === 'low' ? 'Mèo lười một chút…' : 'Vừa vừa thôi!',
        'celebrate',
      );
    }
    lastClick.current = now;
  };

  /** Varied poke reactions — not always the same flinch. */
  const playTapReaction = useCallback(() => {
    const now = Date.now();
    tapCombo.current = now - lastClick.current < 550 ? tapCombo.current + 1 : 1;
    cycleActivity();
    const combo = tapCombo.current;
    type Tap = {
      action: CoreAction;
      emotion: 'happy' | 'sad' | 'warning' | 'celebrate' | 'thinking';
      phrases: string[];
      ms: number;
      hop?: boolean;
      twirl?: boolean;
    };
    const pool: Tap[] = [
      { action: 'hurt', emotion: 'warning', phrases: ['Á!', 'Ui!', 'Hức!', 'Chọc mèo à?'], ms: 420 },
      { action: 'jump', emotion: 'happy', phrases: ['Nyaa~!', 'Bay nào!', 'Nhảy cái!'], ms: 700, hop: true },
      { action: 'attack', emotion: 'warning', phrases: ['Gào!', 'Cào cái!', 'Đừng đụng!'], ms: 560 },
      { action: 'crawl', emotion: 'thinking', phrases: ['Úp mặt…', 'Trốn tí!', 'Ngại quá…'], ms: 900 },
      { action: 'attack', emotion: 'celebrate', phrases: ['Xoay nào!', 'Whee~', 'Chóng mặt!'], ms: 850, twirl: true },
      { action: 'dead', emotion: 'sad', phrases: ['Chết giả!', 'Đừng chọc nữa~', 'Hu hu…'], ms: 1100 },
    ];
    const tap = combo >= 4
      ? pool[5]!
      : pool[Math.floor(Math.random() * (pool.length - 1))]!;
    setAction(tap.action);
    if (tap.twirl) setBodyFx('twirl');
    useMascotStore.getState().speak(
      tap.phrases[Math.floor(Math.random() * tap.phrases.length)]!,
      tap.emotion,
    );
    if (tap.hop) {
      const p = posRef.current;
      startMotion({
        kind: 'jump',
        fromX: p.x,
        fromY: p.y,
        toX: clamp(p.x + rand(-36, 36), 5, maxX()),
        toY: p.y,
        duration: 560,
        parachute: false,
        hardLand: false,
        locoAction: 'walk',
        onDone: ({ x, y }) => {
          playLandFx();
          settleIdle(x, y);
          scheduleRef.current();
        },
      });
      return;
    }
    setTimeout(() => {
      const p = posRef.current;
      if (tap.twirl) setBodyFx('none');
      if (tap.action === 'dead' || tap.action === 'hurt') playLandFx();
      settleIdle(p.x, p.y);
      scheduleRef.current();
    }, tap.ms);
  }, [activity, setActivity, settleIdle, startMotion, playLandFx]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    if (motionRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      motionRef.current = null;
      setChuteOpen(false);
    }
    clearRope();
    interactingRef.current = true;
    draggingRef.current = true;
    setBusy(true);
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: posRef.current.x, cy: posRef.current.y };
    setAction('hurt');

    const move = (ev: Event) => {
      const p = ev as PointerEvent;
      applyPos(
        clamp(dragStart.current.cx + p.clientX - dragStart.current.mx, 5, maxX()),
        clamp(dragStart.current.cy + p.clientY - dragStart.current.my, 0, groundY()),
        true,
      );
    };

    const up = (ev: Event) => {
      const p = ev as PointerEvent;
      try { el.releasePointerCapture(p.pointerId); } catch { /* already released */ }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      draggingRef.current = false;
      setIsDragging(false);
      const dx = p.clientX - dragStart.current.mx;
      const dy = p.clientY - dragStart.current.my;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        playTapReaction();
        return;
      }
      const gY = groundY();
      const plats = scanPlatforms(gY);
      setPlatforms(plats);
      const tossX = clamp(dragStart.current.cx + dx * 1.35, 5, maxX());
      // Aim landing below the release point so a toss always falls somewhere
      const aimFoot = Math.max(posRef.current.y + H + 24, dragStart.current.cy + dy * 1.2 + H);
      let landY = clamp(findSurface(plats, tossX, aimFoot, gY), 0, gY);
      if (landY < posRef.current.y + 12) landY = gY;
      const hard = dist >= HARD_TOSS;
      doFall(tossX, landY, hard, { interact: !hard, vibe: hard ? 'toss' : 'soft' });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [applyPos, doFall, clearRope, playTapReaction]);

  return (
    <>
      {/* Grapple rope UP only: solid cord + claw hook latching onto ledge */}
      {ropeOn && (
        <svg className="pointer-events-none fixed inset-0 z-[90]" width="100%" height="100%" aria-hidden>
          <line
            ref={ropeLineRef}
            x1={0} y1={0} x2={0} y2={0}
            stroke="#57534e"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <g ref={ropeHookRef} transform="translate(0,0)">
            {/* Ring */}
            <circle cx="0" cy="-1" r="3.5" fill="#d6d3d1" stroke="#292524" strokeWidth="1.5" />
            {/* Shank */}
            <rect x="-1.6" y="1" width="3.2" height="9" rx="1.2" fill="#78716c" stroke="#44403c" strokeWidth="0.8" />
            {/* Claw — opens down to catch the ledge */}
            <path
              d="M0 10 L0 15 Q0 22 9 22 Q15 22 15 14 L15 12"
              fill="none"
              stroke="#292524"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 12 L19 14.5"
              fill="none"
              stroke="#57534e"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </svg>
      )}

      <div
        ref={containerRef}
        data-mascot-root
        className="fixed z-[100] select-none touch-none"
        style={{
          left: pos.x,
          top: pos.y,
          width: W,
          height: H,
          cursor: isDragging ? 'grabbing' : 'grab',
          willChange: 'left, top',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        title="🐱 Kéo để ném · Gõ để chọc · Click đúp đổi mức hoạt động"
      >
        {message && (
          <div
            className={[
              'pointer-events-none absolute left-1/2 -translate-x-1/2 z-[110] max-w-[200px] rounded-xl bg-white px-2.5 py-1.5',
              'text-xs text-gray-800 shadow-lg border border-gray-200 animate-mcSlideUp whitespace-nowrap',
              // Near top of viewport: show bubble under the cat so headers don't cover it
              pos.y < 88 ? 'top-full mt-2' : 'bottom-full mb-2',
            ].join(' ')}
          >
            {message}
            <div
              className={[
                'absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-gray-200',
                pos.y < 88
                  ? '-top-[5px] border-l border-t rotate-45'
                  : '-bottom-[5px] border-r border-b rotate-45',
              ].join(' ')}
            />
          </div>
        )}

        <Parachute open={chuteOpen && action === 'fall'} />

        <div
          className="origin-bottom"
          style={{
            animation:
              bodyFx === 'land' ? 'landSquash 0.38s cubic-bezier(0.22,0.8,0.36,1) both' :
              bodyFx === 'twirl' ? 'tapTwirl 0.75s ease-out both' :
              action === 'dead' ? 'deadLie 0.45s cubic-bezier(0.22,0.8,0.36,1) forwards' :
              action === 'fall' ? 'fallSway 0.55s ease-in-out infinite' :
              action === 'walk' ? `gaitBob ${profile.walkDur}s linear infinite` :
              action === 'run' ? `gaitBobRun ${profile.runDur}s linear infinite` :
              action === 'crawl' ? 'gaitBobCrawl 0.45s linear infinite' :
              undefined,
            transform: action === 'climb' && bodyFx === 'none' ? 'rotate(-6deg)' : undefined,
          }}
        >
          {/* No scaleX flip while dead — flip+90° made the cat look upside-down */}
          <span style={{
            display: 'inline-block',
            transform: action === 'dead' ? 'none' : `scaleX(${facingRight ? 1 : -1})`,
          }}>
            <CatBody
              emotion={visible ? emotion : 'idle'}
              action={action}
              walkDur={profile.walkDur}
              runDur={profile.runDur}
            />
          </span>
        </div>

        <style>{`
          .animate-mcSlideUp{animation:catSlideUp .3s ease-out}
          @keyframes catSlideUp{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
          @keyframes chuteOpen{from{transform:scale(0.2) translateY(12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
          @keyframes fallSway{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
          @keyframes gaitBob{0%,100%{transform:translateY(0) rotate(-3deg)}25%{transform:translateY(-4px) rotate(-1deg)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px) rotate(0deg)}}
          @keyframes gaitBobRun{0%,100%{transform:translateY(0) rotate(-6deg)}25%{transform:translateY(-6px) rotate(-3deg)}50%{transform:translateY(0) rotate(3deg)}75%{transform:translateY(-6px) rotate(-2deg)}}
          @keyframes gaitBobCrawl{0%,100%{transform:translateY(2px) scaleY(0.92)}50%{transform:translateY(0) scaleY(0.88)}}
          /* Tip over onto the right side, resting on the ground line */
          @keyframes deadLie{
            0%{transform:rotate(0deg) translate(0,0)}
            70%{transform:rotate(78deg) translate(2px,0)}
            100%{transform:rotate(90deg) translate(4px,0)}
          }
          @keyframes landSquash{
            0%{transform:scale(1,1) translateY(-6px)}
            28%{transform:scale(1.28,0.62) translateY(5px)}
            55%{transform:scale(0.88,1.14) translateY(-3px)}
            78%{transform:scale(1.06,0.94) translateY(1px)}
            100%{transform:scale(1,1) translateY(0)}
          }
          @keyframes tapTwirl{
            0%{transform:rotate(0deg) scale(1)}
            40%{transform:rotate(200deg) scale(1.08)}
            100%{transform:rotate(360deg) scale(1)}
          }
        `}</style>
      </div>
    </>
  );
}
