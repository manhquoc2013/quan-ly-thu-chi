/**
 * NamCatPuppet — 3D Pixar/Disney style interactive Mascot Puppet: Mèo Nấm.
 *
 * Implements CHARACTER_SPEC: MASCOT_CAT_ASSISTANT.md
 * - Female Anthropomorphic Silver-Gray Tabby Cat (Chibi 3-4 heads)
 * - Pixar soft 3D lighting: multi-layer gradients, rim lighting, specular catchlights
 * - Core Visual Identity:
 *   • Forehead: Distinct dark charcoal "M" tabby marking
 *   • Cheeks: Dark gray horizontal tabby stripes & blushing pink cheeks
 *   • Eyes: Expressive emerald green Disney-style eyes with curved feminine eyelashes
 *   • Signature Accessory: Large pastel pink ribbon bow on the right ear
 *   • Tail: Fluffy silver-gray tail with dark gray ring stripes
 * - 5 Modular Outfits & Accessories (Three-VRM socket/mesh attachment inspired):
 *   1. financial: Navy business blazer, white shirt, pink bowtie, pencil skirt, ID badge, gold glasses, chart clipboard & pink piggy bank
 *   2. support: Pastel polo with paw print, over-ear headset with boom mic, sneakers, waving paw
 *   3. tech: Heather gray hoodie, blue-light glasses, ultra-thin metallic laptop open with glowing screen
 *   4. marketing: Red-white varsity bomber jacket, pleated skirt, handheld megaphone, "SALE" / "OFFER" board
 *   5. system: Cozy oversized pastel pajama, steaming coffee mug, floating Zzz / "?" bubbles
 * - Interaction Matrix (page-mascot inspired):
 *   • walk, run, jump, climb, crawl, fall
 *   • trip (té ngã lộn nhào, sao xoay quanh đầu)
 *   • peek (nấp sau thẻ hoặc dòng chữ, chỉ ló mắt xanh và nơ hồng quan sát)
 *   • transformation magic burst (khói poof & sao lấp lánh khi đổi đồ)
 */

import React from 'react';
import type { VisemeShape } from '@/services/speechService';
import type { Action } from './MascotOverlay';
import type { MascotOutfit } from '@/store/mascotStore';

export const W = 63, H = 64;

export const NAM_PART_STYLES = `
.mc-part { transform-box: fill-box; transform-origin: center center; }
.mc-leg { transform-box: fill-box; transform-origin: 50% 18%; }
.mc-arm { transform-box: fill-box; transform-origin: 50% 14%; }
.mc-tail { transform-box: view-box; transform-origin: 30px 80px; }
.mc-body { transform-box: fill-box; transform-origin: 50% 55%; }
.mc-head { transform-box: view-box; transform-origin: 60px 55px; }

/* ── Tail dynamic sway (SpringBone inspired) ── */
@keyframes tail-idle { 0%, 100% { transform: rotate(10deg); } 50% { transform: rotate(-12deg); } }
@keyframes tail-walk {
  0% { transform: rotate(28deg) scale(1,1); }
  25% { transform: rotate(4deg) scale(1.04,0.96); }
  50% { transform: rotate(-30deg) scale(1,1); }
  75% { transform: rotate(-6deg) scale(1.04,0.96); }
  100% { transform: rotate(28deg) scale(1,1); }
}
@keyframes tail-run {
  0% { transform: rotate(38deg) scale(1,0.95); }
  25% { transform: rotate(6deg) scale(1.06,0.92); }
  50% { transform: rotate(-36deg) scale(1,0.95); }
  75% { transform: rotate(-8deg) scale(1.06,0.92); }
  100% { transform: rotate(38deg) scale(1,0.95); }
}
@keyframes tail-jump { 0% { transform: rotate(-8deg); } 40% { transform: rotate(-32deg); } 100% { transform: rotate(-12deg); } }
@keyframes tail-climb { 0%, 100% { transform: rotate(14deg); } 50% { transform: rotate(-14deg); } }
@keyframes tail-crawl { 0%, 100% { transform: rotate(32deg); } 50% { transform: rotate(8deg); } }
@keyframes tail-attack { 0% { transform: rotate(5deg); } 50% { transform: rotate(-28deg); } 100% { transform: rotate(5deg); } }
@keyframes tail-hurt { 0%, 100% { transform: rotate(-22deg); } 50% { transform: rotate(-34deg); } }
@keyframes tail-fall { 0%, 100% { transform: rotate(-18deg); } 50% { transform: rotate(-32deg); } }
@keyframes tail-trip { 0% { transform: rotate(20deg); } 50% { transform: rotate(-45deg); } 100% { transform: rotate(-25deg); } }
@keyframes tail-peek { 0%, 100% { transform: rotate(6deg); } 50% { transform: rotate(-8deg); } }
@keyframes tail-dead { 0%, 100% { transform: rotate(-40deg); } }
@keyframes tail-held { 0%, 100% { transform: rotate(-28deg) translateY(2px); } 50% { transform: rotate(-14deg); } }
@keyframes tail-pulled { 0%, 100% { transform: rotate(-55deg) scaleX(1.2) translateY(4px); } }

/* ── Legs walk/run/jump cycles ── */
@keyframes lleg-idle { 0%, 100% { transform: rotate(0); } }
@keyframes lleg-walk {
  0% { transform: rotate(-32deg) translateY(0); }
  25% { transform: rotate(-8deg) translateY(3px); }
  50% { transform: rotate(32deg) translateY(0); }
  75% { transform: rotate(10deg) translateY(-5px); }
  100% { transform: rotate(-32deg) translateY(0); }
}
@keyframes lleg-run {
  0% { transform: rotate(-42deg) translateY(0); }
  25% { transform: rotate(-12deg) translateY(4px); }
  50% { transform: rotate(42deg) translateY(0); }
  75% { transform: rotate(14deg) translateY(-7px); }
  100% { transform: rotate(-42deg) translateY(0); }
}
@keyframes lleg-jump { 0% { transform: rotate(-20deg); } 40% { transform: rotate(8deg); } 100% { transform: rotate(-5deg); } }
@keyframes lleg-runJump { 0% { transform: rotate(-25deg); } 40% { transform: rotate(12deg); } 100% { transform: rotate(-8deg); } }
@keyframes lleg-climb { 0% { transform: rotate(-18deg) translateY(2px); } 35% { transform: rotate(20deg) translateY(-4px); } 70% { transform: rotate(-10deg); } 100% { transform: rotate(-18deg); } }
@keyframes lleg-crawl { 0% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } 100% { transform: rotate(-14deg); } }
@keyframes lleg-attack { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(10deg); } }
@keyframes lleg-hurt { 0% { transform: rotate(-8deg); } 50% { transform: rotate(-20deg); } 100% { transform: rotate(-8deg); } }
@keyframes lleg-trip { 0% { transform: rotate(-10deg); } 40% { transform: rotate(35deg) translateY(-4px); } 100% { transform: rotate(50deg) translateY(3px); } }
@keyframes lleg-held { 0%, 100% { transform: rotate(-6deg) translateY(2px); } 50% { transform: rotate(10deg) translateY(4px); } }

@keyframes rleg-idle { 0%, 100% { transform: rotate(0); } }
@keyframes rleg-walk {
  0% { transform: rotate(32deg) translateY(0); }
  25% { transform: rotate(10deg) translateY(-5px); }
  50% { transform: rotate(-32deg) translateY(0); }
  75% { transform: rotate(-8deg) translateY(3px); }
  100% { transform: rotate(32deg) translateY(0); }
}
@keyframes rleg-run {
  0% { transform: rotate(42deg) translateY(0); }
  25% { transform: rotate(14deg) translateY(-7px); }
  50% { transform: rotate(-42deg) translateY(0); }
  75% { transform: rotate(-12deg) translateY(4px); }
  100% { transform: rotate(42deg) translateY(0); }
}
@keyframes rleg-jump { 0% { transform: rotate(20deg); } 40% { transform: rotate(-8deg); } 100% { transform: rotate(5deg); } }
@keyframes rleg-runJump { 0% { transform: rotate(25deg); } 40% { transform: rotate(-12deg); } 100% { transform: rotate(8deg); } }
@keyframes rleg-climb { 0% { transform: rotate(18deg) translateY(2px); } 35% { transform: rotate(-20deg) translateY(-4px); } 70% { transform: rotate(10deg); } 100% { transform: rotate(18deg); } }
@keyframes rleg-crawl { 0% { transform: rotate(14deg); } 50% { transform: rotate(-14deg); } 100% { transform: rotate(14deg); } }
@keyframes rleg-attack { 0%, 100% { transform: rotate(5deg); } 50% { transform: rotate(-10deg); } }
@keyframes rleg-hurt { 0% { transform: rotate(8deg); } 50% { transform: rotate(20deg); } 100% { transform: rotate(8deg); } }
@keyframes rleg-trip { 0% { transform: rotate(10deg); } 40% { transform: rotate(-35deg) translateY(-4px); } 100% { transform: rotate(-45deg) translateY(4px); } }
@keyframes rleg-held { 0%, 100% { transform: rotate(8deg) translateY(2px); } 50% { transform: rotate(-8deg) translateY(4px); } }

/* ── Arms cycles ── */
@keyframes larm-idle { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(4deg); } }
@keyframes larm-walk { 0% { transform: rotate(28deg); } 50% { transform: rotate(-30deg); } 100% { transform: rotate(28deg); } }
@keyframes larm-run { 0% { transform: rotate(38deg); } 50% { transform: rotate(-40deg); } 100% { transform: rotate(38deg); } }
@keyframes larm-jump { 0% { transform: rotate(-30deg); } 50% { transform: rotate(-15deg); } 100% { transform: rotate(-25deg); } }
@keyframes larm-climb { 0% { transform: rotate(-48deg); } 40% { transform: rotate(8deg); } 100% { transform: rotate(-48deg); } }
@keyframes larm-crawl { 0% { transform: rotate(-8deg); } 50% { transform: rotate(16deg); } 100% { transform: rotate(-8deg); } }
@keyframes larm-attack { 0% { transform: rotate(10deg); } 40% { transform: rotate(-55deg); } 100% { transform: rotate(10deg); } }
@keyframes larm-trip { 0% { transform: rotate(0); } 50% { transform: rotate(-65deg); } 100% { transform: rotate(-45deg); } }
@keyframes larm-held { 0%, 100% { transform: rotate(-16deg) translateY(1px); } 50% { transform: rotate(12deg) translateY(3px); } }

@keyframes rarm-idle { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-4deg); } }
@keyframes rarm-walk { 0% { transform: rotate(-28deg); } 50% { transform: rotate(30deg); } 100% { transform: rotate(-28deg); } }
@keyframes rarm-run { 0% { transform: rotate(-38deg); } 50% { transform: rotate(40deg); } 100% { transform: rotate(-38deg); } }
@keyframes rarm-jump { 0% { transform: rotate(30deg); } 50% { transform: rotate(15deg); } 100% { transform: rotate(25deg); } }
@keyframes rarm-climb { 0% { transform: rotate(48deg); } 40% { transform: rotate(-8deg); } 100% { transform: rotate(48deg); } }
@keyframes rarm-crawl { 0% { transform: rotate(8deg); } 50% { transform: rotate(-16deg); } 100% { transform: rotate(8deg); } }
@keyframes rarm-attack { 0% { transform: rotate(-5deg); } 40% { transform: rotate(50deg); } 100% { transform: rotate(-5deg); } }
@keyframes rarm-trip { 0% { transform: rotate(0); } 50% { transform: rotate(65deg); } 100% { transform: rotate(45deg); } }
@keyframes rarm-wave { 0%, 100% { transform: rotate(-25deg); } 50% { transform: rotate(-65deg); } }
@keyframes rarm-held { 0%, 100% { transform: rotate(16deg) translateY(1px); } 50% { transform: rotate(-12deg) translateY(3px); } }

/* ── Body posture & Organic breathing ── */
@keyframes body-idle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes body-walk { 0%, 50%, 100% { transform: translateY(0) rotate(-2deg); } 25%, 75% { transform: translateY(-4px) rotate(-2deg); } }
@keyframes body-run { 0%, 50%, 100% { transform: translateY(0) rotate(-5deg); } 25%, 75% { transform: translateY(-6px) rotate(-5deg); } }
@keyframes body-jump { 0% { transform: translateY(0) scaleY(0.9); } 35% { transform: translateY(-3px) scaleY(1.08); } 70% { transform: translateY(2px) scaleY(0.92); } 100% { transform: scaleY(1); } }
@keyframes body-climb { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-4px) rotate(-4deg); } }
@keyframes body-crawl { 0%, 100% { transform: translateY(6px) scaleY(0.7) scaleX(1.15); } 50% { transform: translateY(5px) scaleY(0.68) scaleX(1.18); } }
@keyframes body-trip {
  0% { transform: translateY(0) rotate(0); }
  30% { transform: translateY(-6px) rotate(35deg); }
  60% { transform: translateY(8px) rotate(80deg) scale(1.1,0.8); }
  100% { transform: translateY(7px) rotate(82deg) scale(1.08,0.85); }
}
@keyframes body-peek {
  0%, 100% { transform: translateY(22px); }
  50% { transform: translateY(16px); }
}

/* ── Head, ears & eyes ── */
@keyframes head-idle { 0% { transform: rotate(0); } 30% { transform: rotate(2deg); } 70% { transform: rotate(-1deg); } 100% { transform: rotate(0); } }
@keyframes head-walk {
  0%, 100% { transform: rotate(-5deg) translate(2px,-1px); }
  25% { transform: rotate(1deg) translate(1px,2px); }
  50% { transform: rotate(4deg) translate(2px,-1px); }
  75% { transform: rotate(-2deg) translate(1px,2px); }
}
@keyframes head-run {
  0%, 100% { transform: rotate(-8deg) translate(3px,0); }
  25% { transform: rotate(0deg) translate(2px,2px); }
  50% { transform: rotate(5deg) translate(3px,0); }
  75% { transform: rotate(-3deg) translate(2px,2px); }
}
@keyframes head-trip {
  0% { transform: rotate(0); }
  50% { transform: rotate(-25deg) translate(-2px,4px); }
  100% { transform: rotate(-18deg) translate(-1px,5px); }
}
@keyframes head-talking {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-1.2px) rotate(-1deg); }
  50% { transform: translateY(0.4px) rotate(1deg); }
  75% { transform: translateY(-0.6px) rotate(-0.5deg); }
}

@keyframes eyes-blink { 0%, 88% { transform: scaleY(1); } 94% { transform: scaleY(0.08); } 100% { transform: scaleY(1); } }
@keyframes eyes-hurt { 0% { transform: scaleY(1); } 25% { transform: scaleY(0.12); } 70% { transform: scaleY(0.12); } 100% { transform: scaleY(1); } }
@keyframes eyes-half { 0%, 100% { transform: scaleY(0.45); } }
@keyframes eyes-dizzy { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes pupils-look { 0%, 100% { transform: translate(1.5px, 0); } 50% { transform: translate(2.5px, 0.5px); } }

/* Ear micro-twitching (Secondary animation) */
@keyframes nam-ear-l { 0%, 88%, 100% { transform: rotate(0deg); } 92% { transform: rotate(-8deg); } 96% { transform: rotate(3deg); } }
@keyframes nam-ear-r { 0%, 90%, 100% { transform: rotate(0deg); } 94% { transform: rotate(8deg); } 97% { transform: rotate(-3deg); } }

/* Signature pink ribbon bow spring */
@keyframes nam-bow-spring {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(5deg) scale(1.04, 0.98); }
  70% { transform: rotate(-4deg) scale(0.98, 1.02); }
}

/* Transformation magical effect */
@keyframes magic-poof-burst {
  0% { transform: scale(0.2) rotate(0deg); opacity: 0; }
  30% { transform: scale(1.15) rotate(15deg); opacity: 0.95; }
  70% { transform: scale(1.3) rotate(35deg); opacity: 0.8; }
  100% { transform: scale(1.5) rotate(50deg); opacity: 0; }
}

@keyframes magic-sparkle-float {
  0% { transform: translateY(0) scale(0.5); opacity: 0; }
  50% { transform: translateY(-16px) scale(1.2); opacity: 1; }
  100% { transform: translateY(-30px) scale(0.4); opacity: 0; }
}

@keyframes coffee-steam-rise {
  0% { opacity: 0; transform: translateY(0) scale(0.7); }
  50% { opacity: 0.8; transform: translateY(-8px) scale(1.1) translateX(1px); }
  100% { opacity: 0; transform: translateY(-18px) scale(1.3) translateX(-1px); }
}

@keyframes gold-coin-hover {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes dizzy-stars-orbit {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes mc-breathe { 0%, 100% { transform: scale(1,1); } 50% { transform: scale(1.02,1.015); } }
@keyframes focusHaloPulse { 0%, 100% { transform: scale(1) translateY(0); opacity: 0.85; } 50% { transform: scale(1.08) translateY(-2px); opacity: 1; } }
`;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const PART_KEYS: Record<string, Set<string>> = {
  tail: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
  lleg: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
  rleg: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
  larm: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
  rarm: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
  body: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
  head: new Set(['idle', 'walk', 'run', 'jump', 'runJump', 'climb', 'crawl', 'attack', 'hurt', 'fall', 'dead', 'trip', 'peek']),
};

function partAnim(part: string, action: string, walkDur = 0.75, runDur = 0.5): string {
  const safe = PART_KEYS[part]?.has(action) ? action : 'idle';
  const key = `${part}-${safe}`;
  const once = action === 'hurt' || action === 'attack' || action === 'dead' || action === 'jump' || action === 'runJump' || action === 'trip';
  const loco = action === 'walk' || action === 'run' || action === 'crawl' || action === 'climb';
  const dur =
    action === 'trip' ? '1.4s' :
    action === 'hurt' ? '0.28s' :
    action === 'attack' ? '0.55s' :
    action === 'dead' ? '1.4s' :
    action === 'jump' || action === 'runJump' ? '0.55s' :
    action === 'climb' ? '0.55s' :
    action === 'crawl' ? '0.45s' :
    action === 'fall' ? '0.45s' :
    action === 'peek' ? '2.5s' :
    action === 'run' ? `${runDur}s` :
    action === 'walk' ? `${walkDur}s` :
    '2.4s';
  const ease = once ? 'ease-out' : loco ? 'linear' : 'ease-in-out';
  const iter = once ? '1 forwards' : 'infinite';
  return `${key} ${dur} ${ease} ${iter}`;
}

export interface NamCatPuppetProps {
  emotion: string;
  action: Action;
  outfit?: MascotOutfit;
  isTransforming?: boolean;
  walkDur?: number;
  runDur?: number;
  lookAt?: { x: number; y: number } | null;
  isTalking?: boolean;
  viseme?: VisemeShape;
  isHeld?: boolean;
  isDizzy?: boolean;
  isBellyTickle?: boolean;
  isTailPulled?: boolean;
  isCheekPinched?: boolean;
}

export function NamCatPuppet({
  emotion,
  action,
  outfit = 'financial',
  isTransforming = false,
  walkDur = 0.75,
  runDur = 0.5,
  lookAt,
  isTalking = false,
  viseme = 'closed',
  isHeld = false,
  isDizzy = false,
  isBellyTickle = false,
  isTailPulled = false,
  isCheekPinched = false,
}: NamCatPuppetProps) {
  const isTrip = action === 'trip';
  const isPeek = action === 'peek';
  const happy = emotion === 'happy' || emotion === 'celebrate';
  const faceHurt = action === 'hurt' || action === 'fall';
  const faceDead = action === 'dead';
  const faceAttack = action === 'attack';
  const faceClimb = action === 'climb';
  const faceCrawl = action === 'crawl';
  const faceLoco = action === 'walk' || action === 'run' || action === 'runJump';
  const overrideFace = faceHurt || faceDead || faceAttack || faceClimb || faceCrawl || isDizzy || isBellyTickle || isTailPulled || isTrip;

  // LookAt calculation (tracking mouse target)
  const lookX = lookAt && !overrideFace ? clamp(lookAt.x * 3.5, -3.5, 3.5) : 0;
  const lookY = lookAt && !overrideFace ? clamp(lookAt.y * 2.5, -2.5, 2.5) : 0;
  const headLookDeg = isDizzy || isTrip ? 6 : lookAt && !overrideFace ? clamp(lookAt.x * 7, -7, 7) : 0;

  let eyeRx = happy && !overrideFace ? '3.5' : '5.2';
  let eyeRy = happy && !overrideFace ? '2.4' : '5.2';
  if (faceLoco) { eyeRx = '5.0'; eyeRy = '4.6'; }
  if (faceAttack) { eyeRx = '4.2'; eyeRy = '3.2'; }
  if (faceCrawl) { eyeRx = '4.8'; eyeRy = '2.5'; }
  if (faceClimb) { eyeRx = '4.8'; eyeRy = '4.8'; }
  if (isPeek) { eyeRx = '5.4'; eyeRy = '5.0'; }

  const eyeAnim = faceHurt || faceDead
    ? 'eyes-hurt 0.35s ease-out'
    : faceCrawl
      ? 'eyes-half 1s ease-in-out infinite'
      : faceLoco
        ? 'eyes-blink 4.2s ease-in-out infinite'
        : 'eyes-blink 3.5s ease-in-out infinite';

  const pupilY = (faceClimb ? 38 : faceCrawl ? 43 : faceLoco ? 40.5 : 40) + lookY;
  const pupilXOff = (faceAttack ? 0 : faceLoco ? 3.2 : 2) + lookX;
  const showSmile = (happy || faceLoco || isPeek) && !overrideFace && emotion !== 'sad';

  return (
    <svg
      data-puppet-action={action}
      width={W}
      height={H}
      viewBox="0 0 145 125"
      overflow="visible"
      className="drop-shadow-xl select-none"
    >
      <defs>
        {/* ── Silver-gray tabby 3D fur lighting gradients (Pixar style) ── */}
        <linearGradient id="nam-fur" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="30%" stopColor="#CBD5E1" />
          <stop offset="70%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        <radialGradient id="nam-head-sphere" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="85%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>

        {/* Soft warm silver-white muzzle & underbelly */}
        <radialGradient id="nam-belly-white" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </radialGradient>

        {/* Inner ear soft pink petal glow */}
        <linearGradient id="nam-ear-pink" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="60%" stopColor="#FBCFE8" />
          <stop offset="100%" stopColor="#FDF2F8" />
        </linearGradient>

        {/* Emerald green Disney 3D eyes */}
        <radialGradient id="nam-emerald-iris" cx="42%" cy="40%" r="58%">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="35%" stopColor="#10B981" />
          <stop offset="75%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064E3B" />
        </radialGradient>

        {/* Signature pastel pink satin ribbon bow */}
        <linearGradient id="nam-pink-bow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDF2F8" />
          <stop offset="30%" stopColor="#FBCFE8" />
          <stop offset="70%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#DB2777" />
        </linearGradient>

        {/* Rosy blushing pink cheeks */}
        <radialGradient id="nam-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F472B6" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FBCFE8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FBCFE8" stopOpacity="0" />
        </radialGradient>

        {/* ── Outfit Gradients ── */}
        {/* Navy business blazer */}
        <linearGradient id="nam-navy-suit" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="35%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* CSKH Polo shirt */}
        <linearGradient id="nam-polo-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>

        {/* Tech Hoodie */}
        <linearGradient id="nam-tech-hoodie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="50%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Marketing Varsity Red */}
        <linearGradient id="nam-varsity-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="50%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>

        {/* Sleep Pajama Pastel */}
        <linearGradient id="nam-pajama-violet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>

        {/* Shiny gold coins & badge */}
        <linearGradient id="nam-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="40%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Cute pink piggy bank */}
        <radialGradient id="nam-piggy" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FDF2F8" />
          <stop offset="50%" stopColor="#FBCFE8" />
          <stop offset="100%" stopColor="#F472B6" />
        </radialGradient>
      </defs>

      <style>{NAM_PART_STYLES}</style>

      {/* Focus halo glowing above head (Pomodoro mode) */}
      {emotion === 'focus' && (
        <g style={{ transformBox: 'view-box', transformOrigin: '60px 14px' }}>
          <ellipse
            cx="60"
            cy="14"
            rx="22"
            ry="5.5"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.4"
            filter="drop-shadow(0 0 6px #F59E0B)"
            style={{ animation: 'focusHaloPulse 2s ease-in-out infinite' }}
          />
        </g>
      )}

      {/* ── Fluffy silver-gray tabby tail with distinct dark ring stripes ── */}
      <g
        className="mc-part mc-tail"
        style={{
          animation: isTailPulled
            ? 'tail-pulled 0.25s ease-out infinite'
            : isHeld
              ? 'tail-held 0.8s ease-in-out infinite'
              : isTrip
                ? 'tail-trip 1.4s ease-out'
                : isPeek
                  ? 'tail-peek 2.5s ease-in-out infinite'
                  : partAnim('tail', action, walkDur, runDur),
        }}
      >
        {/* Tail base path */}
        <path
          d="M30 80 C16 66 -4 64 -14 76 C-19 85 -10 97 5 95 C16 94 25 88 30 80 Z"
          fill="url(#nam-fur)"
          stroke="#475569"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Dark gray ring stripes on tail */}
        <path d="M18 73 C12 70 8 74 10 82 C13 86 19 86 21 82 Z" fill="#334155" opacity="0.85" />
        <path d="M6 72 C0 69 -4 74 -2 83 C1 87 7 88 9 84 Z" fill="#334155" opacity="0.85" />
        <path d="M-6 73 C-11 72 -14 77 -12 84 C-9 89 -4 89 -2 85 Z" fill="#334155" opacity="0.85" />
        {/* Fluffy tail tip */}
        <ellipse cx="-10" cy="80" rx="5.5" ry="5" fill="#E2E8F0" />
      </g>

      {/* ── Left Leg (Back leg) ── */}
      <g
        className="mc-part mc-leg"
        style={{
          animation: isHeld
            ? 'lleg-held 0.6s ease-in-out infinite'
            : isTrip
              ? 'lleg-trip 1.4s ease-out'
              : partAnim('lleg', action, walkDur, runDur),
        }}
      >
        <ellipse cx="45" cy="104" rx="10.5" ry="12" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="0.8" />
        <ellipse cx="45" cy="115" rx="8.5" ry="11" fill="#94A3B8" stroke="#64748B" strokeWidth="0.7" />
        {/* Foot / Shoe */}
        {outfit === 'financial' ? (
          /* Black high heel / pump */
          <g>
            <ellipse cx="44" cy="122" rx="11" ry="5.5" fill="#1E293B" />
            <path d="M37 122 L35 127 L39 127 Z" fill="#0F172A" />
          </g>
        ) : outfit === 'support' || outfit === 'tech' ? (
          /* Modern white sneaker with pink accent */
          <g>
            <ellipse cx="44" cy="122" rx="12" ry="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
            <path d="M36 123 Q44 125 52 123" stroke="#F472B6" strokeWidth="1.6" fill="none" />
          </g>
        ) : outfit === 'marketing' ? (
          /* Red high-top sneaker */
          <g>
            <ellipse cx="44" cy="122" rx="12" ry="6" fill="#E11D48" stroke="#9F1239" strokeWidth="0.8" />
            <ellipse cx="48" cy="122" rx="4" ry="4" fill="#FFFFFF" />
          </g>
        ) : (
          /* Soft cat paw with pink pads */
          <g>
            <ellipse cx="45" cy="122" rx="12" ry="6" fill="#CBD5E1" />
            <ellipse cx="45" cy="121" rx="8" ry="3.8" fill="#FBCFE8" />
          </g>
        )}
      </g>

      {/* ── Right Leg (Front leg) ── */}
      <g
        className="mc-part mc-leg"
        style={{
          animation: isHeld
            ? 'rleg-held 0.6s ease-in-out infinite'
            : isTrip
              ? 'rleg-trip 1.4s ease-out'
              : partAnim('rleg', action, walkDur, runDur),
        }}
      >
        <ellipse cx="75" cy="104" rx="10.5" ry="12" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="0.8" />
        <ellipse cx="75" cy="115" rx="8.5" ry="11" fill="#94A3B8" stroke="#64748B" strokeWidth="0.7" />
        {/* Foot / Shoe */}
        {outfit === 'financial' ? (
          <g>
            <ellipse cx="76" cy="122" rx="11" ry="5.5" fill="#1E293B" />
            <path d="M81 122 L83 127 L79 127 Z" fill="#0F172A" />
          </g>
        ) : outfit === 'support' || outfit === 'tech' ? (
          <g>
            <ellipse cx="76" cy="122" rx="12" ry="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
            <path d="M68 123 Q76 125 84 123" stroke="#F472B6" strokeWidth="1.6" fill="none" />
          </g>
        ) : outfit === 'marketing' ? (
          <g>
            <ellipse cx="76" cy="122" rx="12" ry="6" fill="#E11D48" stroke="#9F1239" strokeWidth="0.8" />
            <ellipse cx="72" cy="122" rx="4" ry="4" fill="#FFFFFF" />
          </g>
        ) : (
          <g>
            <ellipse cx="75" cy="122" rx="12" ry="6" fill="#CBD5E1" />
            <ellipse cx="75" cy="121" rx="8" ry="3.8" fill="#FBCFE8" />
          </g>
        )}
      </g>

      {/* ── Body (Torso with Outfit Layer) ── */}
      <g
        className="mc-part mc-body"
        style={{
          animation: isHeld
            ? undefined
            : isTrip
              ? 'body-trip 1.4s ease-out'
              : isPeek
                ? 'body-peek 2.5s ease-in-out infinite'
                : action === 'idle'
                  ? `${partAnim('body', action, walkDur, runDur)}, mc-breathe 3.2s ease-in-out infinite`
                  : partAnim('body', action, walkDur, runDur),
        }}
      >
        {/* Base silver-gray body */}
        <ellipse cx="60" cy="80" rx="34" ry="29" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="1" />
        {/* Soft white belly */}
        <ellipse cx="60" cy="88" rx="22" ry="17" fill="url(#nam-belly-white)" />

        {/* ── Costume Layers on Body ── */}
        {outfit === 'financial' && (
          /* Module 1: Navy business blazer + white shirt + pink bowtie + pencil skirt */
          <g className="outfit-financial">
            {/* Navy Pencil Skirt */}
            <path d="M38 95 L82 95 L79 108 L41 108 Z" fill="url(#nam-navy-suit)" stroke="#0F172A" strokeWidth="0.8" />
            {/* White dress shirt V-inset */}
            <polygon points="52,68 68,68 60,86" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
            {/* Navy Blazer */}
            <path d="M35 70 C42 66 50 67 52 68 L58 87 L40 96 C34 88 32 78 35 70 Z" fill="url(#nam-navy-suit)" stroke="#0F172A" strokeWidth="0.8" />
            <path d="M85 70 C78 66 70 67 68 68 L62 87 L80 96 C86 88 88 78 85 70 Z" fill="url(#nam-navy-suit)" stroke="#0F172A" strokeWidth="0.8" />
            {/* Blazer Gold Buttons */}
            <circle cx="60" cy="88" r="1.8" fill="url(#nam-gold)" />
            <circle cx="60" cy="93" r="1.8" fill="url(#nam-gold)" />
            {/* Dainty Pink Bowtie */}
            <polygon points="56,69 52,65 52,73" fill="url(#nam-pink-bow)" />
            <polygon points="64,69 68,65 68,73" fill="url(#nam-pink-bow)" />
            <circle cx="60" cy="69" r="2.2" fill="#DB2777" />
            {/* ID Badge on Lapel */}
            <g transform="translate(68, 77)">
              <rect x="0" y="0" width="13" height="9" rx="1.5" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
              <rect x="1.5" y="1.5" width="4" height="6" rx="0.5" fill="#3B82F6" opacity="0.8" />
              <line x1="7" y1="3" x2="11.5" y2="3" stroke="#475569" strokeWidth="0.8" />
              <line x1="7" y1="5.5" x2="11" y2="5.5" stroke="#94A3B8" strokeWidth="0.6" />
            </g>
          </g>
        )}

        {outfit === 'support' && (
          /* Module 2: Pastel polo shirt with cat paw print */
          <g className="outfit-support">
            <path d="M36 71 C42 67 78 67 84 71 L81 96 L39 96 Z" fill="url(#nam-polo-indigo)" stroke="#3730A3" strokeWidth="0.8" />
            {/* White polo collar */}
            <polygon points="46,67 60,76 56,68" fill="#FFFFFF" stroke="#E0E7FF" strokeWidth="0.6" />
            <polygon points="74,67 60,76 64,68" fill="#FFFFFF" stroke="#E0E7FF" strokeWidth="0.6" />
            {/* Cat paw logo on chest */}
            <circle cx="48" cy="78" r="2" fill="#FFFFFF" opacity="0.9" />
            <circle cx="46.5" cy="74.5" r="0.9" fill="#FFFFFF" opacity="0.9" />
            <circle cx="48.5" cy="74" r="0.9" fill="#FFFFFF" opacity="0.9" />
            <circle cx="50" cy="75" r="0.9" fill="#FFFFFF" opacity="0.9" />
          </g>
        )}

        {outfit === 'tech' && (
          /* Module 3: Heather slate-gray hoodie with drawstrings */
          <g className="outfit-tech">
            <path d="M35 70 C42 66 78 66 85 70 L82 97 L38 97 Z" fill="url(#nam-tech-hoodie)" stroke="#1E293B" strokeWidth="0.8" />
            {/* Kangaroo pocket */}
            <path d="M47 84 L73 84 L70 94 L50 94 Z" fill="#475569" stroke="#334155" strokeWidth="0.6" />
            {/* White drawstrings */}
            <path d="M54 69 Q53 76 52 82" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M66 69 Q67 76 68 82" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {outfit === 'marketing' && (
          /* Module 4: Red & White Varsity jacket + pleated skirt */
          <g className="outfit-marketing">
            {/* Pleated navy skirt */}
            <path d="M38 93 L82 93 L84 105 L36 105 Z" fill="#1E3A8A" stroke="#0F172A" strokeWidth="0.8" />
            {/* Varsity red body */}
            <path d="M38 71 C45 68 75 68 82 71 L80 94 L40 94 Z" fill="url(#nam-varsity-red)" stroke="#881337" strokeWidth="0.8" />
            {/* White chest band & C patch */}
            <path d="M56 69 L64 69 L60 94 Z" fill="#FFFFFF" opacity="0.25" />
            <text x="47" y="82" fontSize="9" fontWeight="900" fill="#FFFFFF" textAnchor="middle">★</text>
          </g>
        )}

        {outfit === 'system' && (
          /* Module 5: Cozy oversized lavender pajama */
          <g className="outfit-system">
            <path d="M34 70 C42 65 78 65 86 70 L83 98 L37 98 Z" fill="url(#nam-pajama-violet)" stroke="#5B21B6" strokeWidth="0.8" />
            {/* Cute moon and star pattern */}
            <text x="48" y="80" fontSize="8" fill="#FDE047" opacity="0.9">🌙</text>
            <text x="70" y="86" fontSize="7" fill="#FDE047" opacity="0.9">✨</text>
            <text x="52" y="93" fontSize="6" fill="#FDE047" opacity="0.8">⭐</text>
          </g>
        )}
      </g>

      {/* ── Left Arm & Props ── */}
      <g
        className="mc-part mc-arm"
        style={{
          animation: isHeld
            ? 'larm-held 0.5s ease-in-out infinite'
            : isTrip
              ? 'larm-trip 1.4s ease-out'
              : partAnim('larm', action, walkDur, runDur),
        }}
      >
        <ellipse cx="30" cy="78" rx="8" ry="13" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="0.8" />
        <ellipse cx="30" cy="90" rx="7" ry="11" fill="#94A3B8" stroke="#64748B" strokeWidth="0.7" />
        {/* Soft pink cat paw pad */}
        <ellipse cx="28" cy="99" rx="8" ry="5.5" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5" />
        <ellipse cx="28" cy="99" rx="4.5" ry="3" fill="#FBCFE8" />

        {/* ── Outfit Props: Left Hand ── */}
        {outfit === 'financial' && (
          /* Pink Piggy Bank in Left Hand */
          <g transform="translate(6, 84)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))">
            {/* Piggy body */}
            <ellipse cx="14" cy="14" rx="13" ry="11" fill="url(#nam-piggy)" stroke="#F472B6" strokeWidth="0.8" />
            {/* Ears */}
            <polygon points="6,6 10,2 11,8" fill="#F472B6" />
            <polygon points="17,6 21,2 20,8" fill="#F472B6" />
            {/* Snout */}
            <ellipse cx="14" cy="16" rx="4.8" ry="3.5" fill="#F472B6" stroke="#DB2777" strokeWidth="0.6" />
            <circle cx="12.5" cy="16" r="0.8" fill="#881337" />
            <circle cx="15.5" cy="16" r="0.8" fill="#881337" />
            {/* Cute eyes */}
            <circle cx="9" cy="12" r="1.1" fill="#1E293B" />
            <circle cx="19" cy="12" r="1.1" fill="#1E293B" />
            {/* Floating Gold Coin hovering over slot */}
            <g style={{ animation: 'gold-coin-hover 2s ease-in-out infinite' }}>
              <ellipse cx="14" cy="-2" rx="4.5" ry="2.2" fill="url(#nam-gold)" stroke="#B45309" strokeWidth="0.6" />
              <text x="14" y="-1" fontSize="3" fontWeight="bold" fill="#78350F" textAnchor="middle">$</text>
            </g>
          </g>
        )}

        {outfit === 'marketing' && (
          /* Handheld "SALE" / "OFFER" board */
          <g transform="translate(4, 82)">
            <rect x="0" y="0" width="22" height="15" rx="2" fill="#DC2626" stroke="#991B1B" strokeWidth="0.8" />
            <rect x="1.5" y="1.5" width="19" height="12" rx="1.2" fill="#FEF2F2" />
            <text x="11" y="10" fontSize="7" fontWeight="900" fill="#DC2626" textAnchor="middle" letterSpacing="0.5">SALE</text>
            {/* Stick */}
            <line x1="18" y1="14" x2="24" y2="22" stroke="#78350F" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        )}

        {outfit === 'system' && (
          /* Steaming Ceramic Coffee Cup */
          <g transform="translate(10, 88)">
            <path d="M4 6 L18 6 L16 18 C16 20 6 20 6 18 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.8" />
            {/* Handle */}
            <path d="M17 9 C21 9 21 15 17 15" stroke="#94A3B8" strokeWidth="1.4" fill="none" />
            {/* Coffee surface */}
            <ellipse cx="11" cy="7" rx="5.5" ry="2" fill="#78350F" />
            {/* Rising Steam */}
            <g style={{ animation: 'coffee-steam-rise 2.2s ease-in-out infinite' }}>
              <path d="M9 4 Q7 1 9 -2 Q11 -4 9 -6" stroke="#94A3B8" strokeWidth="1.2" fill="none" opacity="0.7" strokeLinecap="round" />
              <path d="M13 3 Q11 0 13 -3 Q15 -5 13 -7" stroke="#94A3B8" strokeWidth="1.2" fill="none" opacity="0.7" strokeLinecap="round" />
            </g>
          </g>
        )}
      </g>

      {/* ── Right Arm & Props ── */}
      <g
        className="mc-part mc-arm"
        style={{
          animation: isHeld
            ? 'rarm-held 0.5s ease-in-out infinite'
            : isTrip
              ? 'rarm-trip 1.4s ease-out'
              : outfit === 'support' && action === 'idle'
                ? 'rarm-wave 1.6s ease-in-out infinite'
                : partAnim('rarm', action, walkDur, runDur),
        }}
      >
        <ellipse cx="90" cy="78" rx="8" ry="13" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="0.8" />
        <ellipse cx="90" cy="90" rx="7" ry="11" fill="#94A3B8" stroke="#64748B" strokeWidth="0.7" />
        {/* Soft pink cat paw pad */}
        <ellipse cx="92" cy="99" rx="8" ry="5.5" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5" />
        <ellipse cx="92" cy="99" rx="4.5" ry="3" fill="#FBCFE8" />

        {/* ── Outfit Props: Right Hand ── */}
        {outfit === 'financial' && (
          /* Clipboard with Growth Chart */
          <g transform="translate(86, 75)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.18))">
            {/* Board */}
            <rect x="0" y="0" width="22" height="28" rx="2" fill="#334155" stroke="#1E293B" strokeWidth="0.8" />
            <rect x="2" y="3" width="18" height="23" rx="1.2" fill="#FFFFFF" />
            {/* Metal Clip */}
            <rect x="7" y="-1.5" width="8" height="4" rx="1" fill="#CBD5E1" stroke="#64748B" strokeWidth="0.6" />
            {/* Growth Bar Chart */}
            <rect x="4" y="19" width="3" height="5" fill="#38BDF8" rx="0.5" />
            <rect x="8.5" y="16" width="3" height="8" fill="#38BDF8" rx="0.5" />
            <rect x="13" y="12" width="3" height="12" fill="#10B981" rx="0.5" />
            {/* Upward Growth Trend Arrow */}
            <path d="M4 17 L8 14 L12 11 L16 7" stroke="#059669" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points="16,5 17,9 13,8" fill="#059669" />
          </g>
        )}

        {outfit === 'tech' && (
          /* Ultra-thin Metallic Laptop open in arms */
          <g transform="translate(68, 85)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))">
            {/* Laptop Base */}
            <polygon points="0,15 28,15 25,20 3,20" fill="#CBD5E1" stroke="#64748B" strokeWidth="0.6" />
            {/* Glowing Screen */}
            <polygon points="4,2 24,2 26,15 2,15" fill="#0F172A" stroke="#475569" strokeWidth="0.8" />
            <polygon points="5,3 23,3 25,14 3,14" fill="#0284C7" opacity="0.3" />
            {/* Code lines on screen */}
            <line x1="6" y1="5" x2="16" y2="5" stroke="#38BDF8" strokeWidth="0.8" />
            <line x1="6" y1="8" x2="21" y2="8" stroke="#34D399" strokeWidth="0.8" />
            <line x1="6" y1="11" x2="14" y2="11" stroke="#F472B6" strokeWidth="0.8" />
          </g>
        )}

        {outfit === 'marketing' && (
          /* Handheld Megaphone (Loa cầm tay) */
          <g transform="translate(86, 78)">
            <polygon points="4,10 18,3 18,17 4,14" fill="#E11D48" stroke="#9F1239" strokeWidth="0.8" />
            <ellipse cx="18" cy="10" rx="2.5" ry="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
            <rect x="0" y="9.5" width="5" height="5" rx="1" fill="#475569" />
            <line x1="6" y1="13" x2="4" y2="20" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
            {/* Sound Wave Accent */}
            <path d="M22 6 Q25 10 22 14" stroke="#F59E0B" strokeWidth="1.2" fill="none" opacity="0.8" />
            <path d="M25 4 Q29 10 25 16" stroke="#F59E0B" strokeWidth="1.2" fill="none" opacity="0.8" />
          </g>
        )}
      </g>

      {/* ── Head (Sphere, Ears, M-stripe, Eyes, Nose, Bow) ── */}
      <g
        className="mc-part mc-head"
        style={{
          animation: isTalking
            ? 'head-talking 0.4s ease-in-out infinite'
            : isTrip
              ? 'head-trip 1.4s ease-out'
              : partAnim('head', action, walkDur, runDur),
          transform: headLookDeg !== 0 ? `rotate(${headLookDeg}deg)` : undefined,
        }}
      >
        {/* Head spherical base with 3D gradient */}
        <ellipse cx="60" cy="45" rx="31" ry="27" fill="url(#nam-head-sphere)" stroke="#64748B" strokeWidth="0.8" />

        {/* ── Left Ear (Viewer's left) ── */}
        <g style={{ transformBox: 'view-box', transformOrigin: '36px 25px', animation: 'nam-ear-l 4.8s ease-in-out infinite' }}>
          <polygon points="32,30 25,4 45,19" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="0.8" />
          <polygon points="34,25 29,11 42,20" fill="url(#nam-ear-pink)" />
        </g>

        {/* ── Right Ear (Viewer's right) with twitch ── */}
        <g style={{ transformBox: 'view-box', transformOrigin: '84px 25px', animation: 'nam-ear-r 5.2s ease-in-out infinite' }}>
          <polygon points="88,30 95,4 75,19" fill="url(#nam-fur)" stroke="#64748B" strokeWidth="0.8" />
          <polygon points="86,25 91,11 78,20" fill="url(#nam-ear-pink)" />
        </g>

        {/* ── Signature Pastel Pink Ribbon Bow on Right Ear (Fixed accessory) ── */}
        <g
          className="nam-signature-bow"
          style={{
            transformBox: 'view-box',
            transformOrigin: '82px 21px',
            animation: 'nam-bow-spring 3.6s ease-in-out infinite',
          }}
          filter="drop-shadow(0 2px 3px rgba(0,0,0,0.18))"
        >
          {/* Left Loop of Bow */}
          <ellipse cx="74" cy="20" rx="9" ry="6.5" transform="rotate(-20 74 20)" fill="url(#nam-pink-bow)" stroke="#DB2777" strokeWidth="0.8" />
          <ellipse cx="74" cy="20" rx="4.5" ry="2.8" transform="rotate(-20 74 20)" fill="#F472B6" opacity="0.6" />
          {/* Right Loop of Bow */}
          <ellipse cx="90" cy="22" rx="9" ry="6.5" transform="rotate(20 90 22)" fill="url(#nam-pink-bow)" stroke="#DB2777" strokeWidth="0.8" />
          <ellipse cx="90" cy="22" rx="4.5" ry="2.8" transform="rotate(20 90 22)" fill="#F472B6" opacity="0.6" />
          {/* Ribbon Tails fluttering down */}
          <path d="M80 24 Q78 33 74 38 Q80 34 83 25 Z" fill="url(#nam-pink-bow)" />
          <path d="M84 24 Q86 34 92 37 Q87 33 84 25 Z" fill="url(#nam-pink-bow)" />
          {/* Center Knot Wrap */}
          <ellipse cx="82" cy="21" rx="4.2" ry="4.5" fill="#DB2777" stroke="#9D174D" strokeWidth="0.8" />
          <ellipse cx="82" cy="20.5" rx="2" ry="2" fill="#FDF2F8" opacity="0.8" />
        </g>

        {/* ── Over-ear Headset with boom mic (Customer Support Module 2) ── */}
        {outfit === 'support' && (
          <g className="headset-accessory" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.25))">
            {/* Headband arching over crown */}
            <path d="M30 42 C30 16 90 16 90 42" fill="none" stroke="#1E293B" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M32 40 C32 18 88 18 88 40" fill="none" stroke="#F472B6" strokeWidth="1" strokeLinecap="round" />
            {/* Left Ear Cushion */}
            <rect x="25" y="36" width="6" height="12" rx="3" fill="#1E293B" />
            <ellipse cx="28" cy="42" rx="2" ry="4" fill="#F472B6" />
            {/* Right Ear Cushion */}
            <rect x="89" y="36" width="6" height="12" rx="3" fill="#1E293B" />
            <ellipse cx="92" cy="42" rx="2" ry="4" fill="#F472B6" />
            {/* Flexible Boom Microphone curling to mouth */}
            <path d="M90 45 Q94 58 76 58 Q72 58 68 56" fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
            {/* Mic Tip with glowing indicator LED */}
            <ellipse cx="67" cy="56" rx="2.5" ry="1.8" fill="#1E293B" stroke="#0F172A" strokeWidth="0.6" />
            <circle cx="67" cy="56" r="0.8" fill="#10B981" />
          </g>
        )}

        {/* ── Forehead Distinct Charcoal-Black "M" Tabby Marking ── */}
        <g className="nam-m-stripe">
          {/* Stylized M-chevron mark */}
          <path
            d="M48 24 L54 36 L60 28 L66 36 L72 24"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Subtle center vertical brow stripe */}
          <path d="M60 23 L60 28" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        {/* ── Cheek Dark Gray Tabby Stripes (2 curved stripes per cheek) ── */}
        <g className="nam-cheek-stripes" opacity="0.85">
          {/* Left Cheek */}
          <path d="M31 46 Q38 47 42 45" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M29 51 Q37 52 41 49" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          {/* Right Cheek */}
          <path d="M89 46 Q82 47 78 45" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M91 51 Q83 52 79 49" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>

        {/* Soft Cream Muzzle Base */}
        <ellipse cx="60" cy="53" rx="21" ry="16" fill="url(#nam-belly-white)" />

        {/* ── Rosy Blushing Cheeks ── */}
        <g
          data-cheek-pinched={isCheekPinched ? 'true' : 'false'}
          style={{
            transform: isCheekPinched ? 'scale(1.24, 0.88)' : undefined,
            transformBox: 'view-box',
            transformOrigin: '60px 53px',
            transition: 'transform 0.15s ease-out',
          }}
        >
          <ellipse cx="37" cy="53" rx="7.5" ry="4.5" fill="url(#nam-blush)" />
          <ellipse cx="83" cy="53" rx="7.5" ry="4.5" fill="url(#nam-blush)" />
        </g>

        {/* ── Expressive Eyes & Eyelashes ── */}
        {faceDead ? (
          <>
            <text x="48" y="46" fontSize="14" fill="#1E293B" textAnchor="middle" fontWeight="bold">×</text>
            <text x="72" y="46" fontSize="14" fill="#1E293B" textAnchor="middle" fontWeight="bold">×</text>
          </>
        ) : isDizzy || isTrip ? (
          /* Dizzy rotating spiral eyes @_@ with stars */
          <g>
            <g style={{ transformBox: 'view-box', transformOrigin: '48px 42px', animation: 'eyes-dizzy 1.2s linear infinite' }}>
              <ellipse cx="48" cy="42" rx="5" ry="5" fill="none" stroke="#1E293B" strokeWidth="1.8" />
              <path d="M46 42 Q48 40 50 42 Q48 44 46 42" fill="none" stroke="#1E293B" strokeWidth="1.4" />
            </g>
            <g style={{ transformBox: 'view-box', transformOrigin: '72px 42px', animation: 'eyes-dizzy 1.2s linear infinite' }}>
              <ellipse cx="72" cy="42" rx="5" ry="5" fill="none" stroke="#1E293B" strokeWidth="1.8" />
              <path d="M70 42 Q72 40 74 42 Q72 44 70 42" fill="none" stroke="#1E293B" strokeWidth="1.4" />
            </g>
            {/* Dizzy orbit stars */}
            <g style={{ transformBox: 'view-box', transformOrigin: '60px 22px', animation: 'dizzy-stars-orbit 2s linear infinite' }}>
              <text x="40" y="24" fontSize="12" fill="#F59E0B">💫</text>
              <text x="76" y="24" fontSize="11" fill="#F59E0B">⭐</text>
              <text x="58" y="14" fontSize="9" fill="#F59E0B">✨</text>
            </g>
          </g>
        ) : isBellyTickle ? (
          /* Laughing happy squint eyes >< */
          <>
            <path d="M44 39 L49 43 L44 47" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M76 39 L71 43 L76 47" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : isTailPulled ? (
          /* Wide shocked startled eyes */
          <>
            <circle cx="48" cy="42" r="6" fill="white" stroke="#1E293B" strokeWidth="1.5" />
            <circle cx="48" cy="42" r="2.4" fill="#1E293B" />
            <circle cx="72" cy="42" r="6" fill="white" stroke="#1E293B" strokeWidth="1.5" />
            <circle cx="72" cy="42" r="2.4" fill="#1E293B" />
            <text x="82" y="22" fontSize="20" fontWeight="bold" fill="#E11D48" textAnchor="middle">!</text>
          </>
        ) : (
          /* Normal / Happy Pixar Disney Eyes with long curved feminine eyelashes */
          <>
            {/* Left Eye */}
            <g style={{ transformBox: 'view-box', transformOrigin: '48px 42px', animation: eyeAnim }}>
              {/* White sclera */}
              <ellipse cx="48" cy="42" rx={eyeRx} ry={eyeRy} fill="#FFFFFF" stroke="#334155" strokeWidth="0.6" />
              {/* Emerald iris */}
              <ellipse cx="48" cy="42" rx={Number(eyeRx) * 0.88} ry={Number(eyeRy) * 0.88} fill="url(#nam-emerald-iris)" />
              {/* Deep black pupil with LookAt tracking */}
              {!faceHurt && (
                <g style={{
                  transformBox: 'view-box',
                  transformOrigin: '48px 42px',
                  animation: faceLoco ? `pupils-look ${walkDur}s linear infinite` : undefined,
                }}>
                  <circle cx={48 + pupilXOff} cy={pupilY} r="2.8" fill="#064E3B" />
                  {/* Glossy specular catchlight 1 (large) */}
                  <circle cx={48 + pupilXOff - 1.2} cy={pupilY - 1.2} r="1.4" fill="#FFFFFF" />
                  {/* Glossy specular catchlight 2 (small spark) */}
                  <circle cx={48 + pupilXOff + 1.2} cy={pupilY + 1} r="0.7" fill="#FFFFFF" opacity="0.8" />
                </g>
              )}
              {/* Long curved feminine upper eyelashes */}
              <path d="M43 38 Q48 35 53 38" stroke="#0F172A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M42 38 Q40 35 39 33" stroke="#0F172A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path d="M43 36 Q42 33 42 31" stroke="#0F172A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>

            {/* Right Eye */}
            <g style={{ transformBox: 'view-box', transformOrigin: '72px 42px', animation: eyeAnim }}>
              {/* White sclera */}
              <ellipse cx="72" cy="42" rx={eyeRx} ry={eyeRy} fill="#FFFFFF" stroke="#334155" strokeWidth="0.6" />
              {/* Emerald iris */}
              <ellipse cx="72" cy="42" rx={Number(eyeRx) * 0.88} ry={Number(eyeRy) * 0.88} fill="url(#nam-emerald-iris)" />
              {/* Deep black pupil with LookAt tracking */}
              {!faceHurt && (
                <g style={{
                  transformBox: 'view-box',
                  transformOrigin: '72px 42px',
                  animation: faceLoco ? `pupils-look ${walkDur}s linear infinite` : undefined,
                }}>
                  <circle cx={72 + pupilXOff} cy={pupilY} r="2.8" fill="#064E3B" />
                  <circle cx={72 + pupilXOff - 1.2} cy={pupilY - 1.2} r="1.4" fill="#FFFFFF" />
                  <circle cx={72 + pupilXOff + 1.2} cy={pupilY + 1} r="0.7" fill="#FFFFFF" opacity="0.8" />
                </g>
              )}
              {/* Long curved feminine upper eyelashes */}
              <path d="M67 38 Q72 35 77 38" stroke="#0F172A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M78 38 Q80 35 81 33" stroke="#0F172A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path d="M77 36 Q78 33 78 31" stroke="#0F172A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>
          </>
        )}

        {/* ── Round Golden Wireframe Glasses (Financial Assistant / Thinking) ── */}
        {(outfit === 'financial' || emotion === 'thinking' || emotion === 'focus') && !overrideFace && (
          <g className="nam-glasses" opacity="0.95" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.15))">
            <circle cx="48" cy="42" r="8" fill="rgba(255,255,255,0.15)" stroke="url(#nam-gold)" strokeWidth="1.5" />
            <path d="M43 38 Q47 35 51 35" fill="none" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />
            <circle cx="72" cy="42" r="8" fill="rgba(255,255,255,0.15)" stroke="url(#nam-gold)" strokeWidth="1.5" />
            <path d="M67 38 Q71 35 75 35" fill="none" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />
            {/* Glasses bridge */}
            <path d="M56 42 Q60 40 64 42" fill="none" stroke="url(#nam-gold)" strokeWidth="1.5" />
          </g>
        )}

        {/* ── Modern Blue-light blocking glasses (Tech & Dev) ── */}
        {outfit === 'tech' && !overrideFace && emotion !== 'thinking' && emotion !== 'focus' && (
          <g className="nam-tech-glasses" opacity="0.95">
            <rect x="40" y="35" width="16" height="13" rx="3" fill="rgba(56,189,248,0.15)" stroke="#1E293B" strokeWidth="1.4" />
            <rect x="64" y="35" width="16" height="13" rx="3" fill="rgba(56,189,248,0.15)" stroke="#1E293B" strokeWidth="1.4" />
            <line x1="56" y1="41" x2="64" y2="41" stroke="#1E293B" strokeWidth="1.4" />
            {/* Subtle cyan reflection sheen */}
            <line x1="43" y1="38" x2="49" y2="38" stroke="#38BDF8" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
            <line x1="67" y1="38" x2="73" y2="38" stroke="#38BDF8" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
          </g>
        )}

        {/* ── Tiny Soft Pink Nose ── */}
        <polygon points="57,51 63,51 60,54" fill="#F472B6" stroke="#DB2777" strokeWidth="0.4" />

        {/* ── Animated Cat Mouth & TalkingHead Lip-Sync ── */}
        {faceDead || faceHurt || isTrip ? (
          <ellipse cx="60" cy="58" rx="4.5" ry="3.5" fill="#334155" />
        ) : isBellyTickle ? (
          <g>
            <path d="M52 56 Q60 67 68 56 Z" fill="#991B1B" stroke="#1E293B" strokeWidth="1" />
            <ellipse cx="60" cy="61" rx="4" ry="2.2" fill="#FCA5A5" />
          </g>
        ) : isTailPulled ? (
          <ellipse cx="60" cy="58" rx="4" ry="5.5" fill="#991B1B" stroke="#1E293B" strokeWidth="1.2" />
        ) : isTalking ? (
          viseme === 'open' ? (
            <g>
              <path d="M53 56 Q60 67 67 56 Q60 54 53 56 Z" fill="#881337" stroke="#1E293B" strokeWidth="1" />
              <ellipse cx="60" cy="62" rx="3.5" ry="2" fill="#F43F5E" />
            </g>
          ) : viseme === 'round' ? (
            <g>
              <ellipse cx="60" cy="58" rx="4.5" ry="5.5" fill="#881337" stroke="#1E293B" strokeWidth="1" />
              <ellipse cx="60" cy="60" rx="3" ry="2.2" fill="#F43F5E" />
            </g>
          ) : viseme === 'smile' ? (
            <path d="M52 56 Q60 65 68 56" fill="none" stroke="#1E293B" strokeWidth="1.6" strokeLinecap="round" />
          ) : (
            <path d="M54 57 Q57 59 60 57 Q63 59 66 57" fill="none" stroke="#1E293B" strokeWidth="1.3" strokeLinecap="round" />
          )
        ) : showSmile ? (
          /* Cute feline 'w' smile */
          <path d="M53 56 Q56 61 60 57 Q64 61 67 56" fill="none" stroke="#1E293B" strokeWidth="1.4" strokeLinecap="round" />
        ) : emotion === 'sad' ? (
          <path d="M54 59 Q60 55 66 59" fill="none" stroke="#1E293B" strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <path d="M55 57 Q60 58 65 57" fill="none" stroke="#1E293B" strokeWidth="1.3" strokeLinecap="round" />
        )}

        {/* ── Delicate Whiskers (3 on each side) ── */}
        <line x1="26" y1="50" x2="41" y2="52" stroke="#CBD5E1" strokeWidth="0.8" opacity="0.9" />
        <line x1="25" y1="54" x2="41" y2="54" stroke="#CBD5E1" strokeWidth="0.8" opacity="0.9" />
        <line x1="27" y1="58" x2="41" y2="56" stroke="#CBD5E1" strokeWidth="0.8" opacity="0.9" />

        <line x1="79" y1="52" x2="94" y2="50" stroke="#CBD5E1" strokeWidth="0.8" opacity="0.9" />
        <line x1="79" y1="54" x2="95" y2="54" stroke="#CBD5E1" strokeWidth="0.8" opacity="0.9" />
        <line x1="79" y1="56" x2="93" y2="58" stroke="#CBD5E1" strokeWidth="0.8" opacity="0.9" />
      </g>

      {/* ── Transformation Magic Burst (when changing outfits) ── */}
      {isTransforming && (
        <g className="transformation-burst" style={{ transformBox: 'view-box', transformOrigin: '60px 60px' }}>
          {/* Swirling Poof Clouds */}
          <g style={{ animation: 'magic-poof-burst 0.75s ease-out forwards' }}>
            <circle cx="60" cy="60" r="32" fill="#FDF2F8" opacity="0.85" filter="drop-shadow(0 0 10px #F472B6)" />
            <circle cx="45" cy="50" r="22" fill="#FBCFE8" opacity="0.8" />
            <circle cx="75" cy="52" r="22" fill="#FBCFE8" opacity="0.8" />
            <circle cx="60" cy="72" r="24" fill="#FDF2F8" opacity="0.8" />
          </g>
          {/* Bursting Star Sparkles */}
          <g style={{ animation: 'magic-sparkle-float 0.75s ease-out forwards' }}>
            <text x="35" y="38" fontSize="16" fill="#F59E0B">✨</text>
            <text x="75" y="36" fontSize="18" fill="#F472B6">💖</text>
            <text x="24" y="66" fontSize="14" fill="#38BDF8">⭐</text>
            <text x="86" y="68" fontSize="16" fill="#F59E0B">✨</text>
            <text x="56" y="24" fontSize="15" fill="#EC4899">✦</text>
          </g>
        </g>
      )}
    </svg>
  );
}
