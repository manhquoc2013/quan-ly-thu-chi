/**
 * MascotOverlay — SVG puppet with pixel-inspired actions.
 * RAF owns position (anti-teleport); limbs/face animate per action.
 * Motion vocabulary referenced from FREE_Cat 2D Pixel Art (not rendered).
 */
import { useMascotStore } from '@/store/mascotStore';
import { useMotionStore } from '@/store/motionStore';
import type { MascotActivity } from '@/store/mascotStore';
import {
  HARD_LAND_LINES,
  IDLE_LINES,
  FOCUS_LINES,
  LAND_LINES,
  TAP_LINES,
  pickLine,
  type LandVibe,
} from '@/services/mascotLines';
import { LucyControlDeck } from './LucyControlDeck';
import { lucyAudio } from '@/services/lucyAudio';
import { NamCatPuppet } from './NamCatPuppet';
import { MascotLadder, type LadderState } from './MascotLadder';
import { useState, useEffect, useLayoutEffect, useRef, useCallback, type CSSProperties } from 'react';

/* ═══ Types ═══ */

type CoreAction =
  | 'idle' | 'walk' | 'run' | 'jump' | 'runJump'
  | 'climb' | 'crawl' | 'attack' | 'hurt' | 'fall' | 'dead'
  | 'trip' | 'peek' | 'celebrate';

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

type MotionKind = 'loco' | 'climb' | 'fall' | 'jump' | 'ballistic';

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
  /** Ballistic (toss / knockback): velocities in px/ms */
  vx?: number;
  vy?: number;
  gravity?: number;
  spin?: number;
  angle?: number;
  lastT?: number;
  bounces?: number;
  /** Cached platforms while airborne — avoid rescanning / hitching every frame. */
  platCache?: Platform[];
  platCacheT?: number;
  onDone?: (landed: { x: number; y: number; hard: boolean }) => void;
}

/* ═══ Constants ═══ */

const W = 63, H = 64;
const MARGIN = 10;
const HARD_TOSS = 140;
/** Parachute only for drops taller than this (px). Short hops stay chute-free. */
const CHUTE_MIN_DROP = 160;
/** Pointer release faster than this (px/ms) counts as a real fling. */
const FLING_SPEED = 0.42;
/** Gravity & drag for ballistic toss / knockback (px/ms², unitless). */
const PHYS = {
  g: 0.00185,
  drag: 0.00045,
  maxVx: 1.15,
  maxVy: 1.55,
  bounce: 0.28,
} as const;

/** Pixels traveled per full limb cycle — keeps gait from looking like a slide. */
const STRIDE = { walk: 30, run: 42, crawl: 24 } as const;

const PROFILES: Record<MascotActivity, ActivityProfile> = {
  low: {
    delay: [6000, 14000],
    maxSpeed: 2.0,
    walkDur: 0.92,
    runDur: 0.65,
    weights: { walk: 0.7, run: 0.04, jump: 0.06, climb: 0.06, crawl: 0.08, attack: 0.03, runJump: 0.01 },
  },
  medium: {
    delay: [2500, 6000],
    maxSpeed: 4.2,
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

const _LEGACY_STYLES = `


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
@keyframes mc-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,1.015)}}
@keyframes mc-ear-l{0%,88%,100%{transform:rotate(0deg)}92%{transform:rotate(-7deg)}96%{transform:rotate(3deg)}}
@keyframes mc-ear-r{0%,90%,100%{transform:rotate(0deg)}94%{transform:rotate(7deg)}97%{transform:rotate(-3deg)}}
@keyframes focusHaloPulse{0%,100%{transform:scale(1) translateY(0);opacity:0.85}50%{transform:scale(1.08) translateY(-2px);opacity:1}}
@keyframes head-talking{0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-1.2px) rotate(-1deg)}50%{transform:translateY(0.4px) rotate(1deg)}75%{transform:translateY(-0.6px) rotate(-0.5deg)}}
@keyframes purrFloat{0%{opacity:1;transform:translateY(0) scale(0.8)}50%{transform:translateY(-18px) scale(1.1)}100%{opacity:0;transform:translateY(-36px) scale(1)}}
@keyframes eyes-dizzy{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes lleg-held{0%,100%{transform:rotate(-6deg) translateY(2px)}50%{transform:rotate(10deg) translateY(4px)}}
@keyframes rleg-held{0%,100%{transform:rotate(8deg) translateY(2px)}50%{transform:rotate(-8deg) translateY(4px)}}
@keyframes larm-held{0%,100%{transform:rotate(-16deg) translateY(1px)}50%{transform:rotate(12deg) translateY(3px)}}
@keyframes rarm-held{0%,100%{transform:rotate(16deg) translateY(1px)}50%{transform:rotate(-12deg) translateY(3px)}}
@keyframes tail-held{0%,100%{transform:rotate(-28deg) translateY(2px)}50%{transform:rotate(-14deg)}}
@keyframes tail-pulled{0%,100%{transform:rotate(-55deg) scaleX(1.2) translateY(4px)}}
@keyframes cheek-pinch-l{0%,100%{transform:translate(0,0)}50%{transform:translate(-6px,1px) scale(1.15,0.9)}}
@keyframes cheek-pinch-r{0%,100%{transform:translate(0,0)}50%{transform:translate(6px,1px) scale(1.15,0.9)}}
`;

export function normalizeAction(action: Action): CoreAction {
  if (action === 'flinch') return 'hurt';
  if (action === 'tossed') return 'fall';
  if (action === 'spin') return 'attack';
  if (action === 'grapple') return 'climb';
  return action;
}



export const CatBody = NamCatPuppet;

/* ═══ Helpers ═══ */

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function easeOutQuad(t: number) { return 1 - (1 - t) * (1 - t); }
/** Wrap degrees into (-180, 180] for shortest-path easing. */
function wrapDeg(deg: number) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

/** Parse CSS color alpha (0–1). Transparent / invisible borders are not footholds. */
function cssAlpha(color: string): number {
  const c = color.trim().toLowerCase();
  if (!c || c === 'transparent') return 0;
  // Modern: oklch(… / 0.4), rgb(… / 0), color(… / 50%)
  const slash = c.match(/\/\s*([\d.]+%?)\s*\)/);
  if (slash) {
    const raw = slash[1]!;
    return clamp(raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw), 0, 1);
  }
  if (c.startsWith('rgba') || c.startsWith('hsla')) {
    const parts = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',');
    return parts.length >= 4 ? clamp(parseFloat(parts[3]!), 0, 1) : 1;
  }
  return 1;
}

/** Visible CSS border / outline — skip transparent / zero-alpha borders (not shadows). */
function hasVisibleBorder(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (el.hasAttribute('data-mascot-platform')) return true;
  if (el.getAttribute('data-slot') === 'card') return true;
  const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
  const styles = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
  const colors = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
  for (let i = 0; i < 4; i++) {
    if (parseFloat(widths[i]!) > 0 && styles[i] !== 'none' && cssAlpha(colors[i]!) > 0.12) return true;
  }
  if (
    parseFloat(cs.outlineWidth || '0') > 0
    && cs.outlineStyle !== 'none'
    && cssAlpha(cs.outlineColor || '') > 0.12
  ) return true;
  return false;
}

function isTextFoothold(el: HTMLElement): boolean {
  const slot = el.getAttribute('data-slot');
  // shadcn title/description are often <div> — still real text ledges
  if (slot === 'card-title' || slot === 'card-description' || slot === 'label') {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length >= 2 && text.length < 120;
  }
  const tag = el.tagName.toLowerCase();
  if (!['p', 'h1', 'h2', 'h3', 'h4', 'label', 'span'].includes(tag)) return false;
  // Leaf lines only — skip wrapper spans that wrap whole card sections
  if (el.childElementCount > 0) return false;
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length >= 2 && text.length < 80;
}

/**
 * Glyph line boxes via Range — NOT the stretched flex/block box.
 * Labels are often 100% wide while "Mật khẩu *" is only ~70px of ink.
 */
function textInkRects(el: HTMLElement): DOMRect[] {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0.5 && r.height > 0.5,
    );
    range.detach?.();
    return rects;
  } catch {
    return [];
  }
}

/** Feet must sit on real glyphs, not empty padding of a full-width label. */
function pointOnTextInk(el: HTMLElement, cx: number, footY: number): boolean {
  const rects = textInkRects(el);
  if (!rects.length) return false;
  for (const r of rects) {
    if (cx >= r.left - 4 && cx <= r.right + 4 && footY >= r.top - 6 && footY <= r.bottom + 10) {
      return true;
    }
  }
  return false;
}

function isControlFoothold(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea'
    || el.getAttribute('role') === 'button'
    || el.getAttribute('data-slot') === 'input'
    || el.getAttribute('data-slot') === 'button';
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

function isTextishLeaf(node: HTMLElement): boolean {
  const tag = node.tagName.toLowerCase();
  const slot = node.getAttribute('data-slot');
  if (tag === 'label' || slot === 'label') return true;
  if (slot === 'card-title' || slot === 'card-description') return true;
  if (['p', 'h1', 'h2', 'h3', 'h4'].includes(tag)) return true;
  if (tag === 'span' && node.childElementCount === 0) {
    const t = (node.textContent || '').trim();
    return t.length >= 2 && t.length < 80;
  }
  return false;
}

/** True when feet sit on a real widget/text, not empty card chrome. */
function hasLeafSupportAt(x: number, footY: number): boolean {
  const cx = x + W / 2;
  const ih = window.innerHeight;
  const iw = window.innerWidth;
  if (cx < 0 || cx >= iw || footY < 0 || footY > ih) return false;
  // Probe INTO the surface (footY+1), not above it — above often hits the page background
  const probes = [
    ...document.elementsFromPoint(cx, clamp(footY + 1, 0, ih - 1)),
    ...document.elementsFromPoint(cx, clamp(footY, 0, ih - 1)),
  ];
  const seen = new Set<Element>();
  for (const node of probes) {
    if (!(node instanceof HTMLElement) || seen.has(node)) continue;
    seen.add(node);
    if (node.closest('[data-mascot-root]')) continue;
    const tag = node.tagName.toLowerCase();
    const slot = node.getAttribute('data-slot');
    if (slot === 'card' || slot === 'card-header' || slot === 'card-content' || slot === 'card-footer') {
      continue; // card fill through the void — use isCardLipAt for lips
    }
    if (tag === 'input' || tag === 'button' || tag === 'textarea' || tag === 'select' || tag === 'a') return true;
    if (slot === 'button' || slot === 'input') return true;
    if (isTextishLeaf(node)) {
      // Full-width labels/titles: only the ink counts — walk past the last glyph → fall
      if (!pointOnTextInk(node, cx, footY)) continue;
      return true;
    }
    if (node.hasAttribute('data-mascot-platform') && slot !== 'card') {
      const br = node.getBoundingClientRect();
      if (Math.abs(br.top - footY) < 12 || Math.abs(br.bottom - footY) < 12) return true;
    }
  }
  return false;
}

/** Feet deep inside a card, not on the outer lip → empty padding/void. */
function isInsideCardVoid(x: number, footY: number): boolean {
  const cx = x + W / 2;
  for (const el of document.querySelectorAll<HTMLElement>('[data-slot="card"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 100 || r.height < 96) continue;
    if (cx < r.left + 8 || cx > r.right - 8) continue;
    // Outer lips (top/bottom border) remain standable
    if (footY <= r.top + 12 || footY >= r.bottom - 12) continue;
    if (footY > r.top + 12 && footY < r.bottom - 12) {
      return !hasLeafSupportAt(x, footY);
    }
  }
  return false;
}

/** Grapple only onto a real lip (card edge / wide control / title) — never empty air. */
function isLatchableLedge(p: Platform): boolean {
  if (p.right - p.left < 96) return false;
  const cx = clamp((p.left + p.right) / 2, 0, window.innerWidth - 1);
  const cy = clamp(p.top + 1, 0, window.innerHeight - 1);
  const hits = document.elementsFromPoint(cx, cy);
  for (const node of hits) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest('[data-mascot-root]')) continue;
    const slot = node.getAttribute('data-slot');
    const tag = node.tagName.toLowerCase();
    const br = node.getBoundingClientRect();
    const onTop = Math.abs(br.top - p.top) < 10;
    const onBottom = Math.abs(br.bottom - p.top) < 10;
    if (slot === 'card' && (onTop || onBottom)) return true;
    if ((tag === 'input' || tag === 'button' || slot === 'input' || slot === 'button') && onTop) return true;
    if ((slot === 'card-title' || tag === 'h1' || tag === 'h2') && onTop && br.width >= 96) return true;
    if (node.hasAttribute('data-mascot-platform') && slot !== 'card' && onTop && br.width >= 96) return true;
  }
  return false;
}

/**
 * Stand rules:
 * 1) Card / tall box → ONLY outer TOP / BOTTOM lip (never the empty interior)
 * 2) Leaf text, labels, inputs, buttons
 * 3) Visible borders on compact widgets
 */
function scanPlatforms(groundY: number): Platform[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const headerSkip = 52;

  const nodes = document.querySelectorAll<HTMLElement>(
    '[data-mascot-platform], [data-slot="card"], [data-slot="card-title"], [data-slot="card-description"], ' +
    '[data-slot="badge"], [data-slot="input"], [data-slot="button"], [data-slot="label"], ' +
    'button, a, [role="button"], input, textarea, ' +
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
    // Only real cards are "shell" platforms — NOT every data-mascot-platform widget
    const isCard = el.getAttribute('data-slot') === 'card';
    const marked = el.hasAttribute('data-mascot-platform');

    if (!bordered && !textOk && !controlOk && !isChart && !marked) continue;
    if (isChart && !bordered && !marked) continue;

    const r = el.getBoundingClientRect();
    if (r.top >= groundY - 2 || r.bottom <= headerSkip) continue;
    if (r.width >= vw * 0.92 && r.height > vh * 0.5) continue;
    if (r.height > vh * 0.55 && !isChart && !isCard) continue;

    // Card / tall chrome: ONLY outer lips — never a floor through padding void
    const tallBox = bordered && r.height > 88 && !controlOk && !textOk;
    if (isCard || (tallBox && !marked)) {
      if (r.width < 72) continue;
      let score = isCard ? 70 : 45;
      if (r.width <= 420) score += 10;
      pushLedge(cands, r.top, r.left, r.right, score);
      if (r.bottom < groundY - 4) pushLedge(cands, r.bottom, r.left, r.right, score - 8);
      continue;
    }

    const minW = textOk ? 28 : controlOk ? 40 : 56;
    const minH = textOk ? 10 : controlOk ? 18 : 28;
    if (r.width < minW || r.height < minH) {
      // Text may still have ink even when the flex box is weirdly measured
      if (!textOk) continue;
    }
    if (textOk && r.height > 56) continue;
    if (r.top < headerSkip && r.height < 56) continue;

    let score = 4;
    if (marked) score += 100;
    if (controlOk) score += 58;
    if (textOk) score += 48;
    if (bordered) score += 42;
    if (isChart) score += 50;
    if (r.width <= 280 && r.height <= 48) score += 22;
    if (r.left > 48 && r.left < vw * 0.9) score += 6;

    // Text ledges follow glyph lines — not the empty stretch of a 100%-wide label
    if (textOk) {
      const inks = textInkRects(el);
      if (inks.length) {
        const pad = 4;
        for (const ink of inks) {
          if (ink.width < 20) continue;
          pushLedge(cands, ink.top, ink.left - pad, ink.right + pad, score);
        }
        continue;
      }
    }

    // Compact widgets: stand on TOP edge only (inputs/buttons)
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

/** Card top/bottom border under the feet. */
function isCardLipAt(x: number, footY: number): boolean {
  const cx = x + W / 2;
  for (const el of document.querySelectorAll<HTMLElement>('[data-slot="card"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 80) continue;
    if (cx < r.left + 6 || cx > r.right - 6) continue;
    if (Math.abs(r.top - footY) < 12 || Math.abs(r.bottom - footY) < 12) return true;
  }
  return false;
}

/** Real place to finish a toss — ground, card lip, or solid control (not empty air). */
function isSolidLanding(x: number, y: number, gY: number): boolean {
  if (isOnGround(y, gY)) return true;
  const foot = y + H;
  if (foot < 0 || foot > window.innerHeight) return false;
  if (isInsideCardVoid(x, foot)) return false;
  if (isCardLipAt(x, foot)) return true;
  return hasLeafSupportAt(x, foot);
}

function findSurface(platforms: Platform[], x: number, footY: number, groundY: number): number {
  const candidates = platforms
    .filter(p => x + W > p.left + 5 && x < p.right - 5)
    .sort((a, b) => a.top - b.top);
  for (const p of candidates) {
    if (footY <= p.top + 15) {
      if (isInsideCardVoid(x, p.top)) continue;
      const landY = p.top - H;
      // Skip ghost ledges mid-air (no real widget / card lip under feet)
      if (landY < groundY - 8 && !isSolidLanding(x, landY, groundY)) continue;
      return landY;
    }
  }
  return groundY;
}

function currentPlatform(platforms: Platform[], x: number, footY: number): Platform | null {
  if (isInsideCardVoid(x, footY)) return null;
  return platforms.find(p => Math.abs(p.top - footY) < 6 && x + W > p.left + 5 && x < p.right - 5) ?? null;
}

function isFloating(x: number, y: number, _plats: Platform[], gY: number) {
  if (isOnGround(y, gY)) return false;
  // DOM-verified support only — ghost scan ledges don't count
  return !isSolidLanding(x, y, gY);
}

/** If floating in empty space, snap feet onto nearest legal surface or ground. */
function snapToSupport(x: number, y: number, platforms: Platform[], gY: number): number {
  const foot = y + H;
  if (currentPlatform(platforms, x, foot)) return y;
  if (Math.abs(y - gY) < 8) return gY;

  const aligned = platforms
    .filter(p => x + W > p.left + 4 && x < p.right - 4)
    .filter(p => !isInsideCardVoid(x, p.top))
    .map(p => ({ y: p.top - H, dist: Math.abs(p.top - foot) }))
    .sort((a, b) => a.dist - b.dist);

  // Only nudge onto a nearby real ledge — never teleport across a card void
  if (aligned[0] && aligned[0].dist < 36) return clamp(aligned[0].y, 0, gY);
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

/** Duration so N stride-cycles cover the distance at a constant speed. */
function locoPlan(distX: number, cycleDur: number, stride: number) {
  const cycles = Math.max(2, Math.round(Math.abs(distX) / stride));
  const matchedDist = cycles * stride;
  return { cycles, matchedDist, durationMs: cycles * cycleDur * 1000 };
}

/* ═══ Speech bubble side ═══ */

type BubbleSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * CatBody viewBox 145×125 → display 63×64.
 * Tip of the bubble should kiss the crown — not bury into the face.
 */
const HEAD = {
  cx: (60 / 145) * W,
  cy: (48 / 125) * H,
  left: (30 / 145) * W,
  right: (90 / 145) * W,
  /** Top of head ellipse (between ears) — where the tail tip lands. */
  crown: (18 / 125) * H,
  chin: (72 / 125) * H,
};

const BUBBLE_FILL = 'rgba(255, 252, 248, 0.97)';
const BUBBLE_STROKE = '#B45309';
/** Visible tip length outside the bubble body (base tucks under fill). */
const TAIL_OUT = 6;

function pickBubbleSide(x: number, y: number): BubbleSide {
  const room = {
    top: y + HEAD.crown,
    bottom: window.innerHeight - (y + HEAD.chin),
    left: x + HEAD.left,
    right: window.innerWidth - (x + HEAD.right),
  };
  if (room.top >= 48) return 'top';
  return (Object.entries(room) as [BubbleSide, number][])
    .sort((a, b) => b[1] - a[1])[0]![0];
}

/** Outline chat bubble — tip kisses crown; pops from head outward. */
function SpeechBubble({ text, side }: { text: string; side: BubbleSide }) {
  const wrap: CSSProperties =
    side === 'top' ? {
      left: HEAD.cx,
      top: HEAD.crown - TAIL_OUT,
      transform: 'translate(-50%, -100%)',
    } :
    side === 'bottom' ? {
      left: HEAD.cx,
      top: HEAD.chin + TAIL_OUT,
      transform: 'translateX(-50%)',
    } :
    side === 'left' ? {
      left: HEAD.left - TAIL_OUT,
      top: HEAD.cy,
      transform: 'translate(-100%, -50%)',
    } : {
      left: HEAD.right + TAIL_OUT,
      top: HEAD.cy,
      transform: 'translateY(-50%)',
    };

  const origin =
    side === 'top' ? '50% 100%' :
    side === 'bottom' ? '50% 0%' :
    side === 'left' ? '100% 50%' :
    '0% 50%';

  // Tail extends TAIL_OUT outside; base sits well under the fill (no base stroke → no dash)
  const tailLen = TAIL_OUT + 5;
  const tailStyle: CSSProperties =
    side === 'top' ? {
      left: '50%',
      bottom: -TAIL_OUT,
      width: 16,
      height: tailLen,
      transform: 'translateX(-50%)',
    } :
    side === 'bottom' ? {
      left: '50%',
      top: -TAIL_OUT,
      width: 16,
      height: tailLen,
      transform: 'translateX(-50%) rotate(180deg)',
    } :
    side === 'left' ? {
      right: -TAIL_OUT,
      top: '50%',
      width: 16,
      height: tailLen,
      transform: 'translateY(-50%) rotate(-90deg)',
    } : {
      left: -TAIL_OUT,
      top: '50%',
      width: 16,
      height: tailLen,
      transform: 'translateY(-50%) rotate(90deg)',
    };

  // Covers the bubble's own border across the join (children paint over parent border)
  const seamStyle: CSSProperties =
    side === 'top' ? { left: '50%', bottom: -2, width: 14, height: 6, transform: 'translateX(-50%)' } :
    side === 'bottom' ? { left: '50%', top: -2, width: 14, height: 6, transform: 'translateX(-50%)' } :
    side === 'left' ? { right: -2, top: '50%', width: 6, height: 14, transform: 'translateY(-50%)' } :
    { left: -2, top: '50%', width: 6, height: 14, transform: 'translateY(-50%)' };

  return (
    <div className="pointer-events-none absolute z-[40]" style={wrap}>
      <div className="animate-bubblePop" style={{ transformOrigin: origin }}>
        <div
          className="relative inline-block w-max max-w-[min(240px,70vw)] px-3 py-2 rounded-2xl border-[2px]"
          style={{ background: BUBBLE_FILL, borderColor: BUBBLE_STROKE }}
        >
          <svg className="pointer-events-none absolute -left-[1px] -top-[1px] w-5 h-5 overflow-visible" viewBox="0 0 20 20" aria-hidden>
            <path d="M3 14 Q2 3 14 3" fill="none" stroke={BUBBLE_STROKE} strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <svg className="pointer-events-none absolute -right-[1px] -bottom-[1px] w-5 h-5 overflow-visible" viewBox="0 0 20 20" aria-hidden>
            <path d="M17 6 Q18 17 6 17" fill="none" stroke={BUBBLE_STROKE} strokeWidth="1.7" strokeLinecap="round" />
          </svg>

          <p
            className="relative z-[2] m-0 text-xs font-medium text-[#5C3A1E] text-center leading-snug break-words whitespace-normal"
            style={{ fontFamily: 'Figtree, "Be Vietnam Pro", system-ui, sans-serif' }}
          >
            {text}
          </p>

          {/* Open V path: fill closes implicitly, stroke skips base — one tip, no double-cap dots */}
          <svg
            className="absolute z-0 overflow-visible"
            style={tailStyle}
            viewBox="0 0 16 14"
            aria-hidden
          >
            <path
              d="M1 1 L8 13 L15 1"
              fill={BUBBLE_FILL}
              stroke={BUBBLE_STROKE}
              strokeWidth="1.7"
              strokeLinejoin="round"
              strokeLinecap="butt"
            />
          </svg>
          <span
            className="absolute z-[3] pointer-events-none rounded-sm"
            style={{ ...seamStyle, background: BUBBLE_FILL }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

/* ═══ Parachute ═══ */

function Parachute({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-10"
      style={{
        top: -52,
        animation: 'chuteOpen 0.45s cubic-bezier(0.22, 0.8, 0.36, 1) both',
      }}
    >
      <svg width="96" height="52" viewBox="0 0 96 52" overflow="visible" className="origin-bottom animate-[chuteSway_2.4s_ease-in-out_infinite]">
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
  const enabled = useMascotStore((s) => s.enabled);
  const visible = useMascotStore((s) => s.visible);
  const message = useMascotStore((s) => s.message);
  const emotion = useMascotStore((s) => s.emotion);
  const activity = useMascotStore((s) => s.activity);
  const isTalking = useMascotStore((s) => s.isTalking);
  const viseme = useMascotStore((s) => s.viseme);
  const focusMode = useMascotStore((s) => s.focusMode);
  const focusSecondsLeft = useMascotStore((s) => s.focusSecondsLeft);
  const tickFocus = useMascotStore((s) => s.tickFocus);
  const isDocked = useMascotStore((s) => s.isDocked);
  const menuOpen = useMascotStore((s) => s.menuOpen);
  const setMenuOpen = useMascotStore((s) => s.setMenuOpen);
  const petCount = useMascotStore((s) => s.petCount);
  const petCat = useMascotStore((s) => s.petCat);
  const outfit = useMascotStore((s) => s.outfit);
  const isTransforming = useMascotStore((s) => s.isTransforming);
  const requestedAction = useMascotStore((s) => s.requestedAction);
  const clearRequestedAction = useMascotStore((s) => s.clearRequestedAction);
  const soundEnabled = useMascotStore((s) => s.soundEnabled);
  const speak = useMascotStore((s) => s.speak);
  const motionLevel = useMotionStore((s) => s.motionLevel);
  const mascotAnimations = useMotionStore((s) => s.mascotAnimations);

  const profile = PROFILES[activity] ?? PROFILES.medium;

  const [lookAt, setLookAt] = useState<{ x: number; y: number } | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; char: string }>>([]);

  /** Floor above the status bar so the cat isn't clipped / sitting on pagination. */
  const groundY = () => {
    const statusBar = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--dimens-statusBarHeight'),
    ) || 32;
    return window.innerHeight - H - MARGIN - statusBar;
  };
  const maxX = () => window.innerWidth - W - 5;

  const [pos, setPos] = useState(() => ({ x: rand(30, Math.max(40, window.innerWidth - W - 20)), y: groundY() }));
  const [action, setAction] = useState<CoreAction>('idle');
  const [facingRight, setFacingRight] = useState(true);
  const [chuteOpen, setChuteOpen] = useState(false);
  const [ladderInfo, setLadderInfo] = useState<{
    x: number;
    bottomY: number;
    topY: number;
    state: LadderState;
    progress: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDizzy, setIsDizzy] = useState(false);
  const [isBellyTickle, setIsBellyTickle] = useState(false);
  const [isTailPulled, setIsTailPulled] = useState(false);
  const [isCheekPinched, setIsCheekPinched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const ladderTimerRef = useRef(0);
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
  const shakeCount = useRef(0);
  const lastShakeTime = useRef(0);
  const lastMoveX = useRef(0);
  const lastDirX = useRef(0);
  const dizzyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeZoneRef = useRef<'tail' | 'ear' | 'head' | 'cheek' | 'belly' | 'body' | null>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const reactSupportRef = useRef<(plats: Platform[], gY: number) => void>(() => {});
  const doFallRef = useRef<(
    toX: number,
    toY: number,
    hard: boolean,
    opts?: { interact?: boolean; vibe?: 'scroll' | 'soft' | 'toss' | 'chute' | 'hop'; silent?: boolean },
  ) => void>(() => {});
  const doBallisticRef = useRef<(
    vx: number,
    vy: number,
    hard: boolean,
    opts?: {
      interact?: boolean;
      vibe?: 'scroll' | 'soft' | 'toss' | 'chute' | 'hop';
      noChute?: boolean;
      silent?: boolean;
    },
  ) => void>(() => {});
  const [bodyFx, setBodyFx] = useState<'none' | 'land' | 'tumble'>('none');
  const bodyAngleRef = useRef(0);
  const spinEaseRaf = useRef(0);
  const dragVel = useRef({ vx: 0, vy: 0, t: 0, x: 0, y: 0 });
  const bodyPivotRef = useRef<HTMLDivElement>(null);

  posRef.current = pos;
  actionRef.current = action;
  facingRef.current = facingRight;

  const setBusy = (v: boolean) => { busyRef.current = v; };

  const clearLadder = useCallback(() => {
    setLadderInfo(null);
    if (ladderTimerRef.current) {
      cancelAnimationFrame(ladderTimerRef.current);
      ladderTimerRef.current = 0;
    }
  }, []);

  const playLandFx = useCallback(() => {
    setBodyFx('land');
    window.setTimeout(() => setBodyFx('none'), 420);
  }, []);

  const speakLand = useCallback((kind: LandVibe) => {
    const emotion = kind === 'scroll' ? 'warning' : kind === 'toss' ? 'celebrate' : 'happy';
    useMascotStore.getState().speak(pickLine(LAND_LINES[kind]), emotion);
  }, []);

  /**
   * Position is ALWAYS written to the DOM.
   * React `pos` is UI-only (speech bubble) — never drive left/top from it during flight,
   * or setAction/setChuteOpen re-renders will teleport the cat back to a stale coordinate.
   */
  const uiPosSyncT = useRef(0);
  const applyPos = useCallback((x: number, y: number, syncReact = false) => {
    const next = { x, y };
    posRef.current = next;
    const el = containerRef.current;
    if (el) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    if (syncReact) {
      setPos(next);
      uiPosSyncT.current = performance.now();
    } else {
      // Throttle bubble Y updates — never write left/top via React
      const now = performance.now();
      if (now - uiPosSyncT.current > 120) {
        uiPosSyncT.current = now;
        setPos(next);
      }
    }
  }, []);

  // Mount: place via DOM once (style left/top are not React-controlled afterward)
  useLayoutEffect(() => {
    applyPos(posRef.current.x, posRef.current.y, true);
  }, [applyPos]);

  // 1-second interval for Focus Mode countdown
  useEffect(() => {
    if (!focusMode) return;
    const timer = setInterval(() => {
      tickFocus();
    }, 1000);
    return () => clearInterval(timer);
  }, [focusMode, tickFocus]);

  // Pointer tracking for Rive & Live2D lookAt eyes
  useEffect(() => {
    if (motionLevel === 'off' || !mascotAnimations) {
      setLookAt(null);
      return;
    }
    let resetTimer: number = 0;
    const onMouseMove = (e: MouseEvent) => {
      const cur = posRef.current;
      const catCenterX = cur.x + W / 2;
      const catCenterY = cur.y + H / 2;
      const dx = (e.clientX - catCenterX) / Math.max(window.innerWidth * 0.35, 180);
      const dy = (e.clientY - catCenterY) / Math.max(window.innerHeight * 0.35, 180);
      setLookAt({
        x: clamp(dx, -1, 1),
        y: clamp(dy, -1, 1),
      });
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => setLookAt(null), 2500);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.clearTimeout(resetTimer);
    };
  }, [motionLevel, mascotAnimations]);

  // Spawn floating purr heart particles on petting or celebrate
  const lastPetCount = useRef(petCount);
  useEffect(() => {
    if (petCount > lastPetCount.current) {
      lastPetCount.current = petCount;
      const chars = ['💖', '✨', '🐾', '⭐'];
      const newBatch = Array.from({ length: 3 }, (_, i) => ({
        id: Date.now() + i,
        x: rand(10, 45),
        y: rand(-10, 15),
        char: chars[Math.floor(Math.random() * chars.length)]!,
      }));
      setParticles((prev) => [...prev, ...newBatch]);
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newBatch.some((nb) => nb.id === p.id)));
      }, 1200);
    }
  }, [petCount]);

  // Settle quietly in corner if docked mode is enabled
  useEffect(() => {
    if (isDocked) {
      const targetX = Math.max(20, window.innerWidth - W - 28);
      const targetY = groundY();
      applyPos(targetX, targetY, true);
      setAction('idle');
      clearLadder();
    }
  }, [isDocked, applyPos, clearLadder]);

  /** Physics lean lives on outer pivot — never fight land/gait CSS on the inner layer. */
  const setSpinAngle = useCallback((deg: number) => {
    bodyAngleRef.current = deg;
    const pivot = bodyPivotRef.current;
    if (pivot) pivot.style.transform = `rotate(${deg}deg)`;
  }, []);

  const easeSpinTo = useCallback((target: number, ms = 380) => {
    if (spinEaseRaf.current) cancelAnimationFrame(spinEaseRaf.current);
    const from = wrapDeg(bodyAngleRef.current);
    const to = wrapDeg(target);
    const delta = wrapDeg(to - from);
    const t0 = performance.now();
    const step = (now: number) => {
      const u = clamp((now - t0) / ms, 0, 1);
      const e = 1 - (1 - u) ** 3;
      setSpinAngle(from + delta * e);
      if (u < 1) {
        spinEaseRaf.current = requestAnimationFrame(step);
      } else {
        spinEaseRaf.current = 0;
        setSpinAngle(to);
      }
    };
    spinEaseRaf.current = requestAnimationFrame(step);
  }, [setSpinAngle]);

  /** Idle on a legal surface only — never hard-teleport across the screen. */
  const settleIdle = useCallback((x: number, y: number) => {
    clearLadder();
    setChuteOpen(false);
    const gY = groundY();
    const plats = scanPlatforms(gY);
    let sy = y;
    if (currentPlatform(plats, x, y + H) || isOnGround(y, gY)) {
      sy = isOnGround(y, gY) ? gY : y;
    } else {
      const snapped = snapToSupport(x, y, plats, gY);
      // Only nudge onto a nearby ledge — large jumps look like teleports
      if (Math.abs(snapped - y) <= 36) sy = snapped;
      else sy = y;
    }
    applyPos(x, sy, true);
    if (spinEaseRaf.current) cancelAnimationFrame(spinEaseRaf.current);
    easeSpinTo(0, 320);
    setBodyFx('none');
    setAction('idle');
    setBusy(false);
    interactingRef.current = false;
    // Still floating → short hop down, or chute only if the drop is tall
    if (isFloating(x, sy, plats, gY) && !isOnGround(sy, gY)) {
      const landY = findSurface(plats, x, sy + H, gY);
      const drop = Math.max(0, (landY < sy + 4 ? gY : landY) - sy);
      window.setTimeout(() => {
        if (draggingRef.current || motionRef.current) return;
        const tall = drop >= CHUTE_MIN_DROP;
        doBallisticRef.current(0, tall ? 0.16 : 0.12, false, {
          interact: true,
          vibe: tall ? 'chute' : 'hop',
          noChute: !tall,
          silent: true,
        });
      }, 40);
    }
  }, [applyPos, clearLadder, easeSpinTo]);

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

    // ── Ballistic toss / knockback (velocity + gravity) ──
    if (m.kind === 'ballistic') {
      const last = m.lastT ?? m.start;
      const dt = clamp(now - last, 4, 24);
      m.lastT = now;
      let vx = m.vx ?? 0;
      let vy = m.vy ?? 0;
      const g = m.gravity ?? PHYS.g;

      // Open chute once after a tall drop (single soften — no per-frame *0.9)
      const fallenProbe = posRef.current.y - m.fromY;
      if (
        !m.parachute && !m.noChute && !m.hardLand
        && vy > 0.2 && fallenProbe >= CHUTE_MIN_DROP && (now - m.start) > 280
      ) {
        m.parachute = true;
        setChuteOpen(true);
        m.spin = 0;
        if (vy > 0.55) vy = 0.55;
      }

      if (m.parachute) {
        // Smooth ease toward terminal velocity (frame-rate independent)
        const terminalVy = 0.34;
        const ease = 1 - Math.exp(-0.0048 * dt);
        vy += (terminalVy - vy) * ease;
        vx *= Math.exp(-0.0028 * dt);
      } else {
        const spd = Math.hypot(vx, vy);
        if (spd > 0.01) {
          const drag = PHYS.drag * spd;
          vx -= (vx / spd) * drag * dt;
          vy -= (vy / spd) * drag * dt;
        }
        vy += g * dt;
      }

      vx = clamp(vx, -PHYS.maxVx, PHYS.maxVx);
      vy = clamp(vy, -PHYS.maxVy, PHYS.maxVy);
      m.vx = vx;
      m.vy = vy;

      let x = posRef.current.x + vx * dt;
      let y = posRef.current.y + vy * dt;
      if (m.parachute) {
        x += Math.sin((now - m.start) * 0.0035) * 0.012 * dt;
      }
      const max = maxX();
      if (x < 5) {
        x = 5;
        const rebound = Math.abs(m.vx ?? 0);
        m.vx = rebound * 0.55;
        if (rebound > 0.22) {
          lucyAudio.thud();
          m.spin = 0.35;
        }
      } else if (x > max) {
        x = max;
        const rebound = Math.abs(m.vx ?? 0);
        m.vx = -rebound * 0.55;
        if (rebound > 0.22) {
          lucyAudio.thud();
          m.spin = -0.35;
        }
      }

      // Ceiling bounce
      if (y < 8 && vy < -0.12) {
        y = 8;
        m.vy = Math.abs(vy) * 0.45;
        lucyAudio.thud();
      }

      if (m.parachute || !m.hardLand) {
        const ang = m.angle ?? 0;
        m.angle = ang * Math.exp(-0.006 * dt);
        m.spin = 0;
        if (Math.abs(m.angle) > 0.4) setSpinAngle(m.angle);
        else if (ang !== 0) setSpinAngle(0);
      } else {
        const spin = m.spin ?? 0;
        m.angle = (m.angle ?? 0) + spin * dt;
        m.spin = spin * Math.exp(-0.002 * dt);
        setSpinAngle(m.angle);
      }

      const gY = groundY();
      if (!m.platCache || now - (m.platCacheT ?? 0) > 160) {
        m.platCache = scanPlatforms(gY);
        m.platCacheT = now;
      }
      const plats = m.platCache;
      const foot = y + H;
      let landY = gY;
      if (vy > 0) {
        const hit = findSurface(plats, x, foot - 2, gY);
        if (hit <= gY && hit >= y - 2) landY = hit;
      }

      if (y >= landY - 0.5 && vy > 0) {
        if (landY < gY - 6 && !isSolidLanding(x, landY, gY)) {
          landY = gY;
          if (y < landY - 0.5) {
            applyPos(x, y);
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
        }
        y = landY;
        const impact = vy;
        const bounces = m.bounces ?? 0;
        const solid = isSolidLanding(x, y, gY) || isOnGround(y, gY);
        // Soft chute: stick the landing — no bounce
        if (solid && m.hardLand && !m.parachute && bounces < 1 && impact > 0.55) {
          m.bounces = bounces + 1;
          m.vy = -impact * PHYS.bounce;
          m.vx = (m.vx ?? 0) * 0.65;
          m.spin = (m.spin ?? 0) * 0.45;
          lucyAudio.thud();
          applyPos(x, y);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (!solid) {
          m.vy = Math.max(0.2, Math.min(impact, 0.4));
          m.hardLand = false;
          applyPos(x, y);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        m.hardLand = m.hardLand && solid && !m.parachute;
        finishMotion(m, x, y);
        rafRef.current = 0;
        return;
      }

      if (y < 0) {
        y = 0;
        m.vy = Math.abs(m.vy ?? 0) * 0.2;
      }

      applyPos(x, y);
      if (now - m.start > m.duration) {
        m.hardLand = false;
        m.noChute = false;
        m.duration = (now - m.start) + 4000;
        m.vy = Math.max(0.28, m.vy ?? 0);
        m.vx = (m.vx ?? 0) * 0.4;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const t = clamp((now - m.start) / m.duration, 0, 1);
    let x: number;
    let y: number;

    if (m.kind === 'fall') {
      // Ease-in gravity feel (accelerate downward)
      const u = t * t;
      const dropH = Math.abs(m.toY - m.fromY);
      if (t > 0.12 && !m.parachute && !m.noChute && dropH >= CHUTE_MIN_DROP) {
        m.parachute = true;
        setChuteOpen(true);
      }
      const chuteU = m.parachute ? 0.15 + easeOutQuad(t) * 0.85 : u;
      x = m.fromX + (m.toX - m.fromX) * easeInOutCubic(t);
      y = m.fromY + (m.toY - m.fromY) * (m.parachute ? chuteU : u);
      // Mild tumble while falling
      setSpinAngle(Math.sin(t * Math.PI * 2) * (m.hardLand ? 28 : 12));

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
      const arc = -Math.sin(t * Math.PI) * 42;
      y = base + arc;
      setSpinAngle(Math.sin(t * Math.PI) * -8);
    } else if (m.kind === 'climb') {
      const e = easeInOutCubic(t);
      x = m.fromX + (m.toX - m.fromX) * e;
      y = m.fromY + (m.toY - m.fromY) * e;
      setSpinAngle(-6 + Math.sin(t * Math.PI * 4) * 3);
    } else if (m.kind === 'loco') {
      x = m.fromX + (m.toX - m.fromX) * t;
      y = m.fromY;
      setSpinAngle(0);
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
  }, [applyPos, finishMotion, setSpinAngle]);

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

  /** Deploy folding ladder from backpack, climb up, and pack away. */
  const doClimb = useCallback((targetY: number, targetX: number, ledge?: Platform) => {
    const from = posRef.current;
    const toY = clamp(targetY, 0, groundY());
    const toX = clamp(targetX, 5, maxX());
    if (toY >= from.y - 12) {
      doJump(toX, false);
      return;
    }
    const latchTop = toY + H;
    const probe: Platform = ledge ?? {
      top: latchTop,
      left: toX,
      right: toX + W,
      bottom: latchTop + 2,
    };
    if (!isLatchableLedge(probe)) {
      doJump(toX, false);
      return;
    }
    const faceR = toX >= from.x;
    setFacingRight(faceR);
    facingRef.current = faceR;
    setBusy(true);

    const ladderX = clamp((probe.left + probe.right) / 2, probe.left + 12, probe.right - 12);
    const ladderBottomY = from.y + H;
    const ladderTopY = probe.top;

    setAction('climb');
    setLadderInfo({
      x: ladderX,
      bottomY: ladderBottomY,
      topY: ladderTopY,
      state: 'deploying',
      progress: 0,
    });

    const deployStart = performance.now();
    const DEPLOY_MS = 360;
    const deployStep = (now: number) => {
      const t = clamp((now - deployStart) / DEPLOY_MS, 0, 1);
      setLadderInfo((prev) => (prev ? { ...prev, progress: easeOutQuad(t), state: t >= 1 ? 'ready' : 'deploying' } : null));

      if (t < 1) {
        ladderTimerRef.current = requestAnimationFrame(deployStep);
        return;
      }
      ladderTimerRef.current = 0;

      const dist = Math.hypot(toX - from.x, toY - from.y);
      startMotion({
        kind: 'climb',
        fromX: from.x,
        fromY: from.y,
        toX,
        toY,
        duration: clamp(1000 + dist * 2.8, 1200, 2400),
        parachute: false,
        hardLand: false,
        locoAction: 'walk',
        onDone: ({ x, y }) => {
          setLadderInfo((prev) => (prev ? { ...prev, state: 'packing', progress: 0 } : null));
          const packStart = performance.now();
          const PACK_MS = 280;
          const packStep = (packNow: number) => {
            const pt = clamp((packNow - packStart) / PACK_MS, 0, 1);
            setLadderInfo((prev) => (prev ? { ...prev, progress: pt } : null));
            if (pt < 1) {
              ladderTimerRef.current = requestAnimationFrame(packStep);
              return;
            }
            ladderTimerRef.current = 0;
            clearLadder();
            playLandFx();
            speakLand('climb');
            applyPos(x, y, true);
            setAction('idle');
            setTimeout(() => {
              settleIdle(x, y);
              scheduleRef.current();
            }, 320);
          };
          ladderTimerRef.current = requestAnimationFrame(packStep);
        },
      });
    };
    ladderTimerRef.current = requestAnimationFrame(deployStep);
  }, [startMotion, doJump, settleIdle, clearLadder, playLandFx, speakLand, applyPos]);

  /** Drop / descend DOWN — ladder for < 250px, parachute glide for >= 250px */
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
    clearLadder();

    const drop = toY - from.y;
    // High drop (>= 250px): deploy parachute glide down
    if (drop >= 250) {
      doBallisticRef.current(
        clamp((toX - from.x) / 600, -0.35, 0.35),
        0.2,
        false,
        { interact: true, vibe: 'chute', noChute: false },
      );
      return;
    }

    // Small drop (< 250px): deploy folding ladder downwards and climb down
    const ladderX = clamp((from.x + toX) / 2, 15, window.innerWidth - 15);
    const ladderTopY = from.y + H;
    const ladderBottomY = toY + H;

    setBusy(true);
    setAction('climb');
    setLadderInfo({
      x: ladderX,
      bottomY: ladderBottomY,
      topY: ladderTopY,
      state: 'deploying',
      progress: 0,
    });

    const deployStart = performance.now();
    const DEPLOY_MS = 320;
    const deployStep = (now: number) => {
      const t = clamp((now - deployStart) / DEPLOY_MS, 0, 1);
      setLadderInfo((prev) => (prev ? { ...prev, progress: easeOutQuad(t), state: t >= 1 ? 'ready' : 'deploying' } : null));

      if (t < 1) {
        ladderTimerRef.current = requestAnimationFrame(deployStep);
        return;
      }
      ladderTimerRef.current = 0;

      startMotion({
        kind: 'climb',
        fromX: from.x,
        fromY: from.y,
        toX,
        toY,
        duration: clamp(800 + drop * 2.2, 900, 1800),
        parachute: false,
        noChute: true,
        hardLand: false,
        locoAction: 'walk',
        onDone: ({ x, y }) => {
          setLadderInfo((prev) => (prev ? { ...prev, state: 'packing', progress: 0 } : null));
          const packStart = performance.now();
          const PACK_MS = 240;
          const packStep = (packNow: number) => {
            const pt = clamp((packNow - packStart) / PACK_MS, 0, 1);
            setLadderInfo((prev) => (prev ? { ...prev, progress: pt } : null));
            if (pt < 1) {
              ladderTimerRef.current = requestAnimationFrame(packStep);
              return;
            }
            ladderTimerRef.current = 0;
            clearLadder();
            playLandFx();
            speakLand('hop');
            setTimeout(() => {
              settleIdle(x, y);
              scheduleRef.current();
            }, 300);
          };
          ladderTimerRef.current = requestAnimationFrame(packStep);
        },
      });
    };
    ladderTimerRef.current = requestAnimationFrame(deployStep);
  }, [startMotion, doJump, clearLadder, settleIdle, playLandFx, speakLand]);

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

  /** Physics fling / chute drop: initial velocity → gravity → land. */
  const doBallistic = useCallback((
    vx: number,
    vy: number,
    hard: boolean,
    opts?: {
      interact?: boolean;
      vibe?: 'scroll' | 'soft' | 'toss' | 'chute' | 'hop';
      noChute?: boolean;
      silent?: boolean;
    },
  ) => {
    const from = posRef.current;
    if (spinEaseRaf.current) cancelAnimationFrame(spinEaseRaf.current);
    clearLadder();
    setChuteOpen(false);
    setFacingRight(vx >= 0);
    facingRef.current = vx >= 0;
    const vibe = opts?.vibe ?? (hard ? 'toss' : 'chute');
    const useChute = !hard && vibe !== 'toss' && vibe !== 'hop' && !(opts?.noChute);
    setAction('fall');
    // Hard toss tumbles; chute / soft drop stays upright
    setBodyFx(hard ? 'tumble' : 'none');
    const spin = hard
      ? clamp(vx * 0.18 + (vy < 0 ? -0.06 : 0.035), -0.72, 0.72)
      : 0;
    if (!opts?.silent && vibe === 'toss') speakLand('toss');
    startMotion({
      kind: 'ballistic',
      fromX: from.x,
      fromY: from.y,
      toX: from.x,
      toY: from.y,
      duration: 6000,
      parachute: false,
      noChute: opts?.noChute ?? (hard || vibe === 'hop' || !useChute),
      hardLand: hard,
      locoAction: 'walk',
      vx: clamp(vx, -PHYS.maxVx, PHYS.maxVx),
      vy: clamp(vy, -PHYS.maxVy, PHYS.maxVy),
      gravity: PHYS.g,
      spin,
      angle: 0,
      lastT: performance.now(),
      bounces: 0,
      onDone: ({ x, y, hard: h }) => {
        setChuteOpen(false);
        const gY = groundY();
        // Never freeze / KO in empty sky — resume falling
        if (!isSolidLanding(x, y, gY) && !isOnGround(y, gY)) {
          applyPos(x, y, true);
          doBallisticRef.current(0, 0.3, false, {
            interact: true,
            vibe: 'chute',
            noChute: false,
            silent: true,
          });
          return;
        }
        if (h) {
          applyPos(x, y, true);
          setAction('dead');
          setBodyFx('tumble');
          easeSpinTo(facingRef.current ? 78 : -78, 520);
          lucyAudio.thud();
          if (!opts?.silent) {
            useMascotStore.getState().speak(pickLine(HARD_LAND_LINES), 'sad');
          }
          setTimeout(() => {
            settleIdle(x, y);
            scheduleRef.current();
          }, 1600);
        } else {
          applyPos(x, y, true);
          easeSpinTo(0, 280);
          playLandFx();
          lucyAudio.pop();
          setAction('idle');
          if (!opts?.silent) {
            if (vibe === 'scroll') speakLand('scroll');
            else if (vibe === 'chute') speakLand('chute');
            else if (vibe === 'hop') speakLand('hop');
            else speakLand('soft');
          }
          setTimeout(() => {
            settleIdle(x, y);
            scheduleRef.current();
          }, vibe === 'scroll' ? 480 : 360);
        }
      },
    });
  }, [applyPos, startMotion, settleIdle, clearLadder, playLandFx, speakLand, easeSpinTo]);

  const doFall = useCallback((
    toX: number,
    toY: number,
    hard: boolean,
    opts?: { interact?: boolean; vibe?: 'scroll' | 'soft' | 'toss' | 'chute' | 'hop'; silent?: boolean },
  ) => {
    const from = posRef.current;
    const dx = toX - from.x;
    const dy = Math.max(0, toY - from.y);
    // User toss / hard → ballistic tumble; otherwise soft chute drop
    if (opts?.vibe === 'toss' || hard || Math.abs(dx) > 40) {
      const vx = clamp(dx / 420, -PHYS.maxVx, PHYS.maxVx);
      const vy = clamp(-0.15 + dy / 800, -0.55, PHYS.maxVy);
      doBallistic(vx, Math.max(vy, 0.2), hard, { ...opts, noChute: hard });
      return;
    }
    doBallistic(
      clamp(dx / 800, -0.2, 0.2),
      Math.max(0.16, dy / 900),
      false,
      { ...opts, vibe: opts?.vibe ?? 'chute', noChute: false },
    );
  }, [doBallistic]);

  doFallRef.current = doFall;
  doBallisticRef.current = doBallistic;

  /** Scroll/resize lost footing — only when settled, never interrupt climb/jump/fall. */
  const reactToLostSupport = useCallback((plats: Platform[], gY: number) => {
    if (draggingRef.current) return;
    if (actionRef.current === 'dead') return;
    // Critical: do not cancel climb / jump / loco / fall mid-action (looked like a random toss)
    if (motionRef.current) return;
    if (busyRef.current) return;

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

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const tall = drop >= CHUTE_MIN_DROP;
    doBallistic(facingRef.current ? 0.04 : -0.04, tall ? 0.14 : 0.12, false, {
      interact: true,
      vibe: tall ? 'scroll' : 'hop',
      noChute: !tall,
      silent: !tall,
    });
  }, [applyPos, doBallistic]);

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
    if (spinEaseRaf.current) cancelAnimationFrame(spinEaseRaf.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (throwRafRef.current) cancelAnimationFrame(throwRafRef.current);
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleRef.current = schedule;
    timerRef.current = setTimeout(() => {
      if (busyRef.current || draggingRef.current || motionRef.current || useMascotStore.getState().isDocked || useMotionStore.getState().motionLevel === 'off' || !useMotionStore.getState().mascotAnimations) {
        schedule();
        return;
      }
      const gY = groundY();
      const plats = scanPlatforms(gY);
      const cur = posRef.current;
      // Floating in void → hop down; chute only if tall
      if (isFloating(cur.x, cur.y, plats, gY)) {
        clearLadder();
        const landY = findSurface(plats, cur.x, cur.y + H, gY);
        const drop = Math.max(0, (landY < cur.y + 4 ? gY : landY) - cur.y);
        const tall = drop >= CHUTE_MIN_DROP;
        doBallistic(facingRef.current ? 0.04 : -0.04, tall ? 0.16 : 0.12, false, {
          interact: true,
          vibe: tall ? 'chute' : 'hop',
          noChute: !tall,
          silent: !tall,
        });
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

      // Near the top of the viewport → strongly prefer dropping onto cards below
      const nearTop = cur.y < 120;
      const wantVertical = nearTop || pick === 'climb' || pick === 'runJump' || Math.random() < 0.32;
      if (wantVertical) {
        const near = plats.filter(p => p.left < cur.x + 220 && p.right > cur.x - 220);
        const above = near.filter(p => p.top < surfY - 48 && isLatchableLedge(p));
        const below = near.filter(p => p.top > surfY + 36 && p.top < gY - 8);
        const belowWide = plats.filter(p => p.top > surfY + 28 && p.top < cur.y + 280 && p.top < gY - 8);
        type Vert = { y: number; x: number; up: boolean; ledge?: Platform };
        const choices: Vert[] = [
          ...above.map(p => ({ y: p.top - H, x: platX(p), up: true, ledge: p })),
          ...below.map(p => ({ y: p.top - H, x: platX(p), up: false, ledge: p })),
          ...belowWide.map(p => ({ y: p.top - H, x: platX(p), up: false, ledge: p })),
        ];
        if (onPlat) choices.push({ y: gY, x: clamp(cur.x + (facingRef.current ? 80 : -80), 5, maxX()), up: false });
        if (choices.length) {
          const ups = choices.filter(c => c.up);
          const downs = choices.filter(c => !c.up);
          let pool = choices;
          if (nearTop && downs.length) pool = downs;
          else if (ups.length && downs.length) pool = Math.random() < 0.4 ? ups : downs;
          const c = pool[Math.floor(Math.random() * pool.length)]!;
          if (c.up) doClimb(c.y, c.x, c.ledge);
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
  }, [profile, doClimb, doDescend, doJump, doCrawl, doAttack, doLoco, doBallistic, clearLadder]);

  useEffect(() => {
    scheduleRef.current = schedule;
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [schedule]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    let lastSpeak = Date.now();
    const tickIdle = () => {
      if (interactingRef.current || busyRef.current) {
        idleTimer = setTimeout(tickIdle, 5000);
        return;
      }
      if (Date.now() - lastSpeak > 20000) {
        const isFoc = useMascotStore.getState().focusMode;
        const line = isFoc ? pickLine(FOCUS_LINES) : pickLine(IDLE_LINES);
        useMascotStore.getState().speak(line, isFoc ? 'focus' : 'idle');
        lastSpeak = Date.now();
      }
      idleTimer = setTimeout(tickIdle, 5000);
    };
    idleTimer = setTimeout(tickIdle, 15000);
    return () => {
      clearTimeout(idleTimer);
      if (dizzyTimerRef.current) clearTimeout(dizzyTimerRef.current);
    };
  }, []);

  /* ═══ Custom Interactive Action Triggers (Wardrobe & Action Playground) ═══ */
  useEffect(() => {
    if (!requestedAction) return;
    const act = requestedAction;
    clearRequestedAction();

    if (act === 'trip') {
      setAction('trip');
      if (soundEnabled) lucyAudio.trip();
      speak('Úi cha... Nấm trượt chân một cái! Meow~ 💫', 'sad');
      const t = setTimeout(() => {
        setAction('idle');
      }, 1600);
      return () => clearTimeout(t);
    }
    if (act === 'peek') {
      setAction('peek');
      if (soundEnabled) lucyAudio.sneak();
      speak('Em Nấm đang nấp nè, anh/chị có thấy em không? 👀', 'happy');
      const t = setTimeout(() => {
        setAction('idle');
      }, 2600);
      return () => clearTimeout(t);
    }
    if (act === 'celebrate') {
      setAction('attack');
      if (soundEnabled) lucyAudio.coin();
      speak('Yeahh! Bão đơn về ngập tràn, doanh thu tăng trưởng rực rỡ nha! 🎉✨', 'celebrate');
      const t = setTimeout(() => {
        setAction('idle');
      }, 2000);
      return () => clearTimeout(t);
    }
    if (act === 'walk' || act === 'run') {
      const cur = posRef.current;
      const dir = facingRef.current ? 1 : -1;
      const targetX = clamp(cur.x + dir * (act === 'run' ? 220 : 140), 10, maxX());
      doLoco(targetX, act as 'walk' | 'run');
      return;
    }
    if (act === 'jump') {
      const cur = posRef.current;
      doJump(clamp(cur.x + (facingRef.current ? 80 : -80), 10, maxX()), true);
      return;
    }
    if (act === 'climb') {
      const cur = posRef.current;
      doClimb(cur.y - 60, cur.x);
      return;
    }
    if (act === 'crawl') {
      doCrawl();
      return;
    }
  }, [requestedAction, clearRequestedAction, soundEnabled, speak, doLoco, doJump, doClimb, doCrawl]);

  /** Poke / knock — physical hops & flinches, not CSS spin loops. */
  const playTapReaction = useCallback(() => {
    const now = Date.now();
    tapCombo.current = now - lastClick.current < 550 ? tapCombo.current + 1 : 1;
    lastClick.current = now;
    const combo = tapCombo.current;

    type Tap = {
      emotion: 'happy' | 'sad' | 'warning' | 'celebrate' | 'thinking';
      phrases: readonly string[];
      kind: 'flinch' | 'hop' | 'knock' | 'playDead';
    };
    const pool: Tap[] = [
      { emotion: 'warning', phrases: TAP_LINES.flinch, kind: 'flinch' },
      { emotion: 'happy', phrases: TAP_LINES.hop, kind: 'hop' },
      { emotion: 'warning', phrases: TAP_LINES.knock, kind: 'knock' },
      { emotion: 'thinking', phrases: TAP_LINES.shy, kind: 'flinch' },
      { emotion: 'celebrate', phrases: TAP_LINES.cheer, kind: 'hop' },
      { emotion: 'sad', phrases: TAP_LINES.playDead, kind: 'playDead' },
    ];
    const tap = combo >= 4 ? pool[5]! : pool[Math.floor(Math.random() * (pool.length - 1))]!;
    useMascotStore.getState().speak(pickLine(tap.phrases), tap.emotion);

    const dir = facingRef.current ? 1 : -1;
    if (tap.kind === 'playDead') {
      doBallistic(dir * 0.25, -0.55, true, { interact: true, vibe: 'toss', noChute: true, silent: true });
      return;
    }
    if (tap.kind === 'hop') {
      doBallistic(dir * rand(0.15, 0.35), -rand(0.55, 0.85), false, {
        interact: true, vibe: 'hop', noChute: true, silent: true,
      });
      return;
    }
    if (tap.kind === 'knock') {
      doBallistic(-dir * rand(0.35, 0.55), -rand(0.25, 0.45), false, {
        interact: true, vibe: 'hop', noChute: true, silent: true,
      });
      return;
    }
    // Flinch: short stagger hop
    setAction('hurt');
    doBallistic(dir * rand(0.08, 0.18), -rand(0.2, 0.35), false, {
      interact: true, vibe: 'hop', noChute: true, silent: true,
    });
  }, [doBallistic]);

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
    if (spinEaseRaf.current) cancelAnimationFrame(spinEaseRaf.current);
    clearLadder();
    interactingRef.current = true;
    draggingRef.current = true;
    setBusy(true);
    setIsDragging(true);
    setSpinAngle(0);
    dragStart.current = { mx: e.clientX, my: e.clientY, cx: posRef.current.x, cy: posRef.current.y };
    dragVel.current = { vx: 0, vy: 0, t: performance.now(), x: e.clientX, y: e.clientY };
    setAction('hurt');

    // Anatomical hit detection
    const rect = el.getBoundingClientRect();
    const relX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const localX = facingRef.current ? relX : 1 - relX;
    const localY = relY;

    let zone: 'tail' | 'ear' | 'head' | 'cheek' | 'belly' | 'body' = 'body';
    if (localX < 0.28 && localY > 0.45) {
      zone = 'tail';
    } else if (localY < 0.35 && (localX < 0.38 || localX > 0.62)) {
      zone = 'ear';
    } else if (localY < 0.42 && localX >= 0.35 && localX <= 0.65) {
      zone = 'head';
    } else if (localY >= 0.35 && localY <= 0.65 && (localX < 0.32 || localX > 0.68)) {
      zone = 'cheek';
    } else if (localY >= 0.52 && localY <= 0.85 && localX >= 0.32 && localX <= 0.68) {
      zone = 'belly';
    }
    activeZoneRef.current = zone;

    // Reset shake tracker
    shakeCount.current = 0;
    lastShakeTime.current = performance.now();
    lastMoveX.current = e.clientX;
    lastDirX.current = 0;

    // Immediate physical feedback per anatomical zone
    if (zone === 'tail') {
      setIsTailPulled(true);
      lucyAudio.startled();
      useMascotStore.getState().speak('Á! Đừng kéo đuôi Nấm mà! >_<', 'warning');
    } else if (zone === 'ear') {
      lucyAudio.pop();
    } else if (zone === 'head') {
      petCat();
      useMascotStore.getState().speak('Gừ... gừ... xoa đầu thích ghê á! May mắn ngập tràn nè! ✨', 'happy');
    } else if (zone === 'belly') {
      setIsBellyTickle(true);
      lucyAudio.giggle();
      useMascotStore.getState().speak('Hihi nhột quá! Nấm chịu hổng nổi đâu nha~ :3', 'happy');
    } else if (zone === 'cheek') {
      setIsCheekPinched(true);
    }

    const move = (ev: Event) => {
      const p = ev as PointerEvent;
      const now = performance.now();
      const dt = Math.max(8, now - dragVel.current.t);
      // EMA velocity — ignore single-frame spikes that warp the fling
      const ivx = (p.clientX - dragVel.current.x) / dt;
      const ivy = (p.clientY - dragVel.current.y) / dt;
      dragVel.current = {
        vx: dragVel.current.vx * 0.55 + ivx * 0.45,
        vy: dragVel.current.vy * 0.55 + ivy * 0.45,
        t: now,
        x: p.clientX,
        y: p.clientY,
      };

      // Rapid mouse shake tracking (left-right oscillation)
      const dxMove = p.clientX - lastMoveX.current;
      if (Math.abs(dxMove) > 12) {
        const curDir = Math.sign(dxMove);
        if (curDir !== 0 && curDir !== lastDirX.current) {
          lastDirX.current = curDir;
          if (now - lastShakeTime.current < 450) {
            shakeCount.current += 1;
          } else {
            shakeCount.current = 1;
          }
          lastShakeTime.current = now;
        }
        lastMoveX.current = p.clientX;
      }

      // DOM-only while dragging — syncReact would re-render and fight the next move
      applyPos(
        clamp(dragStart.current.cx + p.clientX - dragStart.current.mx, 5, maxX()),
        clamp(dragStart.current.cy + p.clientY - dragStart.current.my, 0, groundY()),
        false,
      );

      // Live squash & stretch along pointer motion with volume preservation
      const spd = Math.hypot(dragVel.current.vx, dragVel.current.vy);
      const stretchY = clamp(1 + spd * 0.28, 1, 1.35);
      const stretchX = 1 / Math.sqrt(stretchY);
      const dragAngle = clamp((p.clientX - dragStart.current.mx) * 0.04, -22, 22);
      if (bodyPivotRef.current) {
        bodyPivotRef.current.style.transform = `rotate(${dragAngle}deg) scale(${stretchX}, ${stretchY})`;
      }
    };

    const up = (ev: Event) => {
      const p = ev as PointerEvent;
      try { el.releasePointerCapture(p.pointerId); } catch { /* already released */ }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      draggingRef.current = false;
      setIsDragging(false);

      if (bodyPivotRef.current) {
        bodyPivotRef.current.style.transform = '';
      }
      setIsTailPulled(false);
      setIsBellyTickle(false);

      // Cheek release spring bounce
      if (activeZoneRef.current === 'cheek') {
        setIsCheekPinched(false);
        lucyAudio.boing();
        useMascotStore.getState().speak('Bẹo má Nấm đau nha! Nhưng mà cũng thích... :3', 'happy');
      }

      // Rapid shake dizziness trigger
      if (shakeCount.current >= 5) {
        setIsDizzy(true);
        lucyAudio.startled();
        useMascotStore.getState().speak('Chóng mặt quá... sao trăng bay vòng vòng thế này... @_@', 'warning');
        if (dizzyTimerRef.current) clearTimeout(dizzyTimerRef.current);
        dizzyTimerRef.current = setTimeout(() => {
          setIsDizzy(false);
        }, 3500);
      }

      const dx = p.clientX - dragStart.current.mx;
      const dy = p.clientY - dragStart.current.my;
      const dist = Math.hypot(dx, dy);
      const speed = Math.hypot(dragVel.current.vx, dragVel.current.vy);
      // Sync React pos once at release (DOM already correct)
      applyPos(posRef.current.x, posRef.current.y, true);
      if (dist < 12) {
        if (activeZoneRef.current === 'ear') {
          useMascotStore.getState().speak('Nhột tai Nấm quá à! :3', 'happy');
        } else if (activeZoneRef.current !== 'head' && activeZoneRef.current !== 'belly' && activeZoneRef.current !== 'tail') {
          playTapReaction();
        }
        return;
      }

      // Real fling = fast flick or long fast drag — NOT merely lifting then releasing
      const isFling = speed >= FLING_SPEED || (dist >= 100 && speed >= 0.28);
      if (!isFling) {
        // Place / lift-and-drop: settle or short fall, never "Whee!" toss
        const gY = groundY();
        const plats = scanPlatforms(gY);
        const cur = posRef.current;
        let landY = findSurface(plats, cur.x, cur.y + H, gY);
        if (landY < cur.y + 4) landY = gY;
        const drop = landY - cur.y;
        setSpinAngle(0);
        if (drop < 18) {
          settleIdle(cur.x, cur.y);
          scheduleRef.current();
          return;
        }
        const tall = drop >= CHUTE_MIN_DROP;
        doBallistic(0, 0.14, false, {
          interact: true,
          vibe: tall ? 'chute' : 'hop',
          noChute: !tall,
          silent: false,
        });
        return;
      }

      // Fling: blend recent pointer velocity with throw vector
      let vx = dragVel.current.vx * 0.9 + dx / 320;
      let vy = dragVel.current.vy * 0.9 + dy / 340;
      if (Math.abs(vx) > 0.1 && vy > -0.05) vy = Math.min(vy, -0.22);
      vx = clamp(vx, -PHYS.maxVx, PHYS.maxVx);
      vy = clamp(vy, -PHYS.maxVy, PHYS.maxVy);
      const hard = dist >= HARD_TOSS || speed > 0.95;
      doBallistic(vx, vy, hard, { interact: true, vibe: 'toss', noChute: hard, silent: false });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [applyPos, doBallistic, clearLadder, petCat, playTapReaction, setSpinAngle, settleIdle]);

  if (!enabled) return null;

  return (
    <>
      {/* Folding ladder deployed from backpack */}
      {ladderInfo && (
        <MascotLadder
          x={ladderInfo.x}
          bottomY={ladderInfo.bottomY}
          topY={ladderInfo.topY}
          state={ladderInfo.state}
          progress={ladderInfo.progress}
        />
      )}

      <div
        ref={containerRef}
        data-mascot-root
        className="fixed z-[100] select-none touch-none group"
        style={{
          // Read live ref on re-render (not stale React pos) so setAction/chute never teleports
          left: posRef.current.x,
          top: posRef.current.y,
          width: W,
          height: H,
          cursor: isDragging ? 'grabbing' : 'grab',
          willChange: 'left, top',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        title="🐱 Kéo để ném · Gõ để chọc · Click đúp đổi hoạt động · Click chuột phải/nút ⚙️ mở Trợ lý Nấm"
      >
        {/* Floating Focus Badge when focusMode is active */}
        {focusMode && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(true);
            }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono font-bold text-[10px] shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform animate-bounce z-[60]"
            title="Chế độ tập trung đang bật - Click mở bảng điều khiển"
          >
            <span>🎯</span>
            <span>
              {Math.floor(focusSecondsLeft / 60)}:{String(focusSecondsLeft % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Hover mini-action pill */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto flex items-center gap-1 bg-surface/90 backdrop-blur-sm border border-border shadow-sm rounded-full px-1.5 py-0.5 text-[10px] z-[60]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(true);
            }}
            className="hover:scale-110 transition-transform text-amber-500"
            title="Bảng điều khiển Mèo Nấm"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              petCat();
            }}
            className="hover:scale-110 transition-transform text-rose-500"
            title="Xoa đầu mèo lấy hên"
          >
            💖
          </button>
        </div>

        {/* Floating Purr / Sparkle Particles */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute pointer-events-none text-xs z-[70]"
            style={{
              left: p.x,
              top: p.y,
              animation: 'purrFloat 1.2s ease-out forwards',
            }}
          >
            {p.char}
          </span>
        ))}

        {message && (
          <SpeechBubble key={message} text={message} side={pickBubbleSide(pos.x, pos.y)} />
        )}

        <Parachute open={chuteOpen && (action === 'fall' || bodyFx === 'tumble')} />

        {/* Outer: physics spin · Inner: land squash / gait bob (no transform fights) */}
        <div ref={bodyPivotRef} className="relative z-[50] origin-bottom will-change-transform">
          <div
            style={{
              animation:
                bodyFx === 'land' ? 'landSquash 0.42s cubic-bezier(0.22,0.8,0.36,1) both' :
                action === 'walk' && bodyFx === 'none' ? `gaitBob ${profile.walkDur}s linear infinite` :
                action === 'run' && bodyFx === 'none' ? `gaitBobRun ${profile.runDur}s linear infinite` :
                action === 'crawl' && bodyFx === 'none' ? 'gaitBobCrawl 0.45s linear infinite' :
                undefined,
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: action === 'dead' ? 'none' : `scaleX(${facingRight ? 1 : -1})`,
            }}>
              <NamCatPuppet
                emotion={visible ? emotion : focusMode ? 'focus' : 'idle'}
                action={action}
                outfit={outfit}
                isTransforming={isTransforming}
                walkDur={profile.walkDur}
                runDur={profile.runDur}
                lookAt={lookAt}
                isTalking={isTalking}
                viseme={viseme}
                isHeld={isDragging}
                isDizzy={isDizzy}
                isBellyTickle={isBellyTickle}
                isTailPulled={isTailPulled}
                isCheekPinched={isCheekPinched}
              />
            </span>
          </div>
        </div>

        <style>{`
          .animate-bubblePop{animation:bubblePop .4s cubic-bezier(0.2,1.15,0.32,1) both}
          @keyframes bubblePop{
            0%{opacity:0;transform:scale(0.08) translateY(10px)}
            68%{opacity:1;transform:scale(1.04) translateY(-1px)}
            100%{opacity:1;transform:scale(1) translateY(0)}
          }
          @keyframes chuteOpen{from{transform:scale(0.35) translateY(8px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
          @keyframes chuteSway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
          @keyframes gaitBob{0%,100%{transform:translateY(0) rotate(-3deg)}25%{transform:translateY(-4px) rotate(-1deg)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px) rotate(0deg)}}
          @keyframes gaitBobRun{0%,100%{transform:translateY(0) rotate(-6deg)}25%{transform:translateY(-6px) rotate(-3deg)}50%{transform:translateY(0) rotate(3deg)}75%{transform:translateY(-6px) rotate(-2deg)}}
          @keyframes gaitBobCrawl{0%,100%{transform:translateY(2px) scaleY(0.92)}50%{transform:translateY(0) scaleY(0.88)}}
          @keyframes landSquash{
            0%{transform:scale(1,1) translateY(-8px)}
            30%{transform:scale(1.32,0.58) translateY(6px)}
            55%{transform:scale(0.86,1.16) translateY(-4px)}
            78%{transform:scale(1.06,0.94) translateY(1px)}
            100%{transform:scale(1,1) translateY(0)}
          }
        `}</style>
      </div>

      {menuOpen && <LucyControlDeck onClose={() => setMenuOpen(false)} />}
    </>
  );
}
