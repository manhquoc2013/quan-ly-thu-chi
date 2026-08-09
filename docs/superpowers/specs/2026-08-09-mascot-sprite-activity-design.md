# Mascot Pixel Cat + Activity Levels (CSS-composed actions)

Date: 2026-08-09  
Status: approved for planning  
Source assets: `/Users/tranquoc/Downloads/FREE_Cat 2D Pixel Art`  
References:
- Walk-cycle guide (`mascot.rtf`) — CSS `steps()` + JS movement + velocity matching
- CSS composition tips — climb/crawl/fall via `transform` on existing sheets

## Goal

Replace the SVG puppet (`CatBody`) with the free **pixel art cat** (separate strip per action). Drive **low / medium / high** activity with distinct profiles. Where the pack lacks a dedicated strip (climb, crawl/slide, fall, dead), **compose** the effect with CSS transforms on Walk/Run/Hurt/Jump sheets — no new drawn frames.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Visual source | `FREE_Cat 2D Pixel Art` (orange pixel cat), not grey chibi `png/cat` |
| Sheet layout | **One PNG strip per state** (already provided); not a single mega-grid |
| Frame size | **80×64** source (`JUMP`/`RUNNING JUMP` force `fw=80`; height `64`) |
| Display size | Scale up with `image-rendering: pixelated` (e.g. display ~64–80px box) |
| Missing actions | Compose: climb / crawl / fall / dead from existing strips |
| Dead | Reuse **hurt** strip (hold last / play once + pause) |
| Activity levels | Delay + speed + walk/run mix + climb/crawl/attack weights |
| Keep | Platform scan, drag/toss, speech bubble, double-click activity, `mascotStore` persist |
| Out of scope | Grey chibi pack, dog pack, emotion-bubble redesign, Settings redesign |

## Asset pipeline

### Source strips (copy into repo)

From `Sprites/`:

| File | Frames (@80×64) | Native state |
|------|-----------------|--------------|
| `IDLE.png` | 8 | idle |
| `WALK.png` | 12 | walk (+ climb composition) |
| `RUN.png` | 8 | run (+ crawl composition) |
| `JUMP.png` | 3 | jump |
| `RUNNING JUMP.png` | 3 | run-jump / fall alt |
| `HURT.png` | 4 | hurt + dead |
| `ATTACK 1.png` | 8 | attack (high / poke flourish) |

License: usable in personal/commercial projects; do not redistribute as a standalone asset pack. Credit appreciated, not required.

### Repo output

- Copy (optionally key black → transparent): `public/mascot/cat/{idle,walk,run,jump,running-jump,hurt,attack}.png`
- Optional one-shot: `scripts/prepare-mascot-pixel.mjs` — rename, strip black, write `meta.json`
- `public/mascot/cat/meta.json`:
  - `frameWidth: 80`, `frameHeight: 64`
  - `displayWidth` / `displayHeight`
  - per-state `{ file, frames, duration, loop }`

No mega `spritesheet.png` required.

## Runtime architecture

```
mascotStore.activity ──► activityProfile
                              │
schedule / intent ──► state machine
  idle|walk|run|jump|runJump|hurt|dead|climb|crawl|fall|attack
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     CSS state class                   RAF / physics
     (.state-walk, .cat-climb…)        x/y, vx, facing
     background-image + steps()        accel / friction
```

### Character CSS (pattern)

```css
:root {
  --fw: 80px;
  --fh: 64px;
}

.cat {
  width: var(--fw);
  height: var(--fh);
  background-repeat: no-repeat;
  background-position: 0 0;
  image-rendering: pixelated;
  transition: transform 0.1s ease;
}

.state-idle { background-image: url(/mascot/cat/idle.png);
  animation: play-idle 0.8s steps(8) infinite; }
.state-walk { background-image: url(/mascot/cat/walk.png);
  animation: play-walk 0.7s steps(12) infinite; }
.state-run  { background-image: url(/mascot/cat/run.png);
  animation: play-run 0.45s steps(8) infinite; }
/* … per-state steps(N) and to: calc(-1 * var(--fw) * N) */

/* Composed */
.cat-climb {
  background-image: url(/mascot/cat/walk.png); /* or run */
  transform: rotate(-90deg); /* +90 for climb down */
  animation: play-walk 0.6s steps(12) infinite;
}
.cat-crawl {
  background-image: url(/mascot/cat/run.png);
  transform: scaleY(0.6) scaleX(1.2);
  animation: play-run 0.4s steps(8) infinite;
}
.cat-fall {
  background-image: url(/mascot/cat/hurt.png); /* or running-jump */
  animation: falling-spin 1s linear infinite, play-hurt 0.5s steps(4) infinite;
}
@keyframes falling-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

**Facing:** nest flip on an inner wrapper so climb `rotate(-90deg)` and left/right `scaleX(-1)` compose cleanly; speech bubble stays on an unflipped outer layer.

**Pixel crispness:** always `image-rendering: pixelated` (and `crisp-edges` fallback if needed).

### Remove

- `CatBody` SVG and per-limb keyframes from `MascotOverlay.tsx`.

## State machine

| State | Strip | Transform / notes | Loop | Enter → Exit |
|-------|-------|-------------------|------|--------------|
| idle | idle | none | infinite | default |
| walk | walk | facing flip | infinite | move (low/med) → friction stop |
| run | run | facing flip | infinite | move (high) → stop |
| jump | jump | none | once | hop / short air → land idle |
| runJump | running-jump | none | once | high-energy leap |
| hurt | hurt | none | once | grab / poke → idle or drag |
| dead | hurt | hold / slow once + slight squash | once ~1.2–1.8s | hard toss land → idle + quip |
| climb | walk or run | `rotate(-90deg)` + move Y | infinite while climbing | platform target → idle on top |
| crawl | run | `scaleY(0.6) scaleX(1.2)` | infinite | replaces old slide/spin → idle |
| fall | hurt or running-jump | continuous `rotate(360deg)` while falling | until land | soft/hard toss air → land |
| attack | attack | none | once | high scheduler / poke flourish → idle |

### Toss severity

| Release | Sequence |
|---------|----------|
| Click / tiny drag | hurt → idle (double-click still cycles activity) |
| Soft toss | fall (spin) + optional parachute → land idle |
| Hard toss | fall → land **dead** (hurt pose) → recover idle + gag line |

### Climb / grapple

Keep platform targeting from current overlay. While moving mostly on **Y**, use `.cat-climb` (walk cycle + −90°). Grapple pull-up can be climb or short jump + Y tween.

## Activity profiles

| Profile | Delay | Locomotion | Climb / crawl / attack | Max speed | Cycle duration |
|---------|-------|------------|------------------------|-----------|----------------|
| low | 4–9s | idle + slow walk | rare | ~2–3 px/f | walk ~0.9–1.1s |
| medium | 2–5s | walk | moderate climb/crawl | ~4–5 | walk ~0.7–0.85s |
| high | 0.8–2s | run + walk | frequent climb/crawl/attack/runJump | ~6–8 | run ~0.4–0.55s |

**Velocity matching:** sync `--dur` / `steps(N)` with horizontal speed.  
**Inertia:** accelerate into walk/run; friction to idle.

## Interaction

- Drag → hurt; soft release → fall; hard release → fall then dead (hurt).
- Scheduler may pick crawl (composed) instead of old SVG spin; attack on high.
- Double-click activity cycle unchanged.
- Bubbles / idle chatter unchanged; face baked into pixels.

## Files

| Path | Change |
|------|--------|
| `public/mascot/cat/*.png` | New — prepared strips |
| `public/mascot/cat/meta.json` | New |
| `scripts/prepare-mascot-pixel.mjs` | Optional — key + copy + meta |
| `src/ui/components/MascotOverlay.tsx` | Major — pixel `.cat` states + composed classes + physics |
| `src/store/mascotStore.ts` | Keep API |
| Settings / Layout | No required change |

## Acceptance criteria

1. Orange pixel cat renders (no orange SVG `CatBody`).
2. Native strips play with discrete `steps(N)`: idle, walk, run, jump, running-jump, hurt, attack.
3. Composed states work: climb (rotate walk/run), crawl (scale run), fall (spin hurt/running-jump), dead (hurt).
4. Low / medium / high visibly differ.
5. Walk/run velocity matches cycle (no ice-skate); crawl is intentionally squashed.
6. Soft vs hard toss paths work; platforms + bubble OK.
7. Activity persists; assets served from `public/` (few strip files, not 74 chibi PNGs).
8. Pixel art stays sharp (`image-rendering: pixelated`).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Wrong frame width (64 vs 80) | Lock `fw=80` from JUMP width; verify in browser once |
| Black box behind sprites | Key black→transparent in prepare script |
| Climb rotate looks odd with facing | Inner/outer transform wrappers |
| Fall spin + steps fights transforms | Separate spin on wrapper, steps on inner `.cat` |
| Attack too aggressive for ledger UI | Low weight; mostly high activity / rare poke |

## Non-goals

- Grey chibi pack / generating new pixel frames
- User-uploaded sprites
- Keyboard platformer controls
- Redistributing the free pack standalone
