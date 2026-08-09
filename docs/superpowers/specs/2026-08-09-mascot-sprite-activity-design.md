# Mascot SVG Puppet + Pixel-Inspired Action Set

Date: 2026-08-09  
Status: approved for planning  
Visual: keep / refine existing orange SVG `CatBody` (independent head, arms, legs, tail, face)  
Motion reference: `/Users/tranquoc/Downloads/FREE_Cat 2D Pixel Art` (action vocabulary + timing only — **not** rendered in UI)  
Also: walk-cycle principles from `mascot.rtf` (velocity matching, inertia, state machine)

## Goal

Keep full control of **facial expression** and **limb animation**, while upgrading behavior to match a richer action set inspired by the pixel pack: idle, walk, run, jump, run-jump, hurt, attack, climb, crawl, fall, dead. Make **low / medium / high** activity levels drive delay, speed, locomotion type, and action mix — not only idle wait.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Rendering | SVG puppet (`CatBody`), not pixel PNGs on screen |
| Pixel pack role | Reference for states, timing, and pose intent only |
| Face / limbs | Per-part CSS keyframes + emotion-driven face (eyes, mouth, brows/blush) |
| Physics | RAF or timed moves with acceleration / friction; velocity matched to walk/run cycle |
| Activity | Profiles for low / medium / high |
| Keep | Platform scan, drag/toss, speech bubble, double-click activity, `mascotStore` |
| Out of scope | Shipping pixel assets in `public/`, grey chibi pack, Settings redesign |

## Why not sprites on screen

Pixel strips bake face and limbs into each frame — cannot independently tune expression or arm/leg control. SVG already supports that; we **convert** pixel actions into puppet keyframes instead of importing PNGs.

## Action conversion map (pixel → SVG)

| Pixel strip / tip | SVG state | Body / limbs | Face |
|-------------------|-----------|--------------|------|
| IDLE | `idle` | Soft breath (body Y), slow tail, occasional weight shift | Blink; emotion from store (happy/sad/neutral) |
| WALK | `walk` | Opposite-phase legs + arms; body bob; duration ↔ speed | Slight head sway; neutral/happy |
| RUN | `run` | Larger limb arcs, faster cycle, stronger bob | Focused eyes (smaller lids), slight lean |
| JUMP | `jump` | Squash → stretch → land squash; legs tuck/extend | Anticipation eyes wide |
| RUNNING JUMP | `runJump` | Jump from run pose; more forward lean | Same as jump, more intense |
| HURT | `hurt` | Recoil, arms up/in | Squint / X flash optional, open mouth |
| ATTACK 1 | `attack` | One-arm swipe + body twist (replaces old spin) | Determined / small grit mouth |
| Climb (walk + rotate tip) | `climb` | Alternating arms/legs; body slight tilt; move on Y | Look upward |
| Crawl (run + scale tip) | `crawl` | Flattened body (`scaleY`), small limb amplitude, low Y | Cheek close to ground vibe (eyes half) |
| Fall (hurt + spin tip) | `fall` | Whole-character rotate while falling | Flinch face |
| Dead → hurt | `dead` | Brief sprawl / limp limbs | X-eyes or closed + tear optional; auto-recover |

Climb/crawl/fall are **composed behaviors** on the puppet (transforms + part anims), same ideas as the CSS tips, without using pixel bitmaps.

## Runtime architecture

```
mascotStore.activity ──► activityProfile (delay, speeds, weights)
mascotStore.emotion  ──► face layer (eyes/mouth/blush)
                              │
schedule / intent ──► state machine
  idle|walk|run|jump|runJump|hurt|attack|climb|crawl|fall|dead
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     CatBody(action, emotion)          RAF / CSS position
     part keyframes per action         accel, friction, facing
```

### Character

- Keep layered SVG groups: tail, legs, body, arms, head (face inside head).
- `partAnim(part, action)` expanded for **all** states above (no silent fallback to idle for primary locomotion).
- Whole-body wrappers for: `fall` rotate, `crawl` scaleY/scaleX, `climb` slight tilt (not full −90° if it looks wrong on a biped chibi — prefer upright climb with arm-over-arm; optional −15° lean).
- Facing via `scaleX(-1)` on body wrapper; bubble outside flip.

### Face controls (refine beyond current)

| Emotion / state | Eyes | Mouth | Extra |
|-----------------|------|-------|-------|
| idle / neutral | Blink loop | Flat / small smile | — |
| happy / celebrate | Happy arcs | Smile curve | Blush |
| sad | Droop | Frown | — |
| hurt / fall | Squint or flinch | Open oval | Optional “!” |
| dead | X or shut | Wail short | Auto clear after recover |
| attack | Narrow | Grit | — |
| climb | Look up (pupil/offset) | Neutral | — |
| crawl | Half-lid | Neutral | — |

Store `emotion` still drives baseline; action can override face while `hurt|fall|dead|attack` is active.

### Limb controls (per action)

- **Walk / run:** classic opposite phase; run = larger degrees + shorter duration.
- **Jump / runJump:** legs sync tuck; arms up.
- **Climb:** arms alternate reach-up; legs alternate push (staggered keyframes).
- **Crawl:** reduced rotation range; body `scaleY(0.65–0.75)`.
- **Attack:** dominant arm large arc; other arm brace; short one-shot.
- **Hurt / dead:** asymmetric flinch; dead holds limp ~1.2–1.8s then idle.
- **Fall:** disable conflicting limb loops or keep subtle flail; outer rotate 360° until land.

## State machine

| State | Enter | Exit |
|-------|-------|------|
| idle | default | scheduler |
| walk | low/med move | friction → idle |
| run | high move | friction → idle |
| jump | hop / short air | land → idle |
| runJump | high leap | land → idle |
| climb | platform above (grapple/climb intents) | arrive → idle |
| crawl | scheduler (replaces spin) | end → idle |
| attack | scheduler high / rare poke | one-shot → idle |
| hurt | mousedown / poke | short → idle or drag |
| fall | toss in air | land → idle or dead |
| dead | hard toss land | recover → idle + quip |

### Toss severity

| Release | Sequence |
|---------|----------|
| Click / tiny | hurt → idle (double-click cycles activity) |
| Soft toss | fall → land idle |
| Hard toss | fall → dead → recover idle |

## Activity profiles

| Profile | Delay | Locomotion | Special weights | Max speed | Cycle dur |
|---------|-------|------------|-----------------|-----------|-----------|
| low | 4–9s | idle + slow walk | climb/crawl/attack rare | ~2–3 px/f | walk ~0.9–1.1s |
| medium | 2–5s | walk | moderate jump/climb/crawl | ~4–5 | walk ~0.7–0.85s |
| high | 0.8–2s | run + walk | frequent jump/climb/crawl/attack/runJump | ~6–8 | run ~0.4–0.55s |

**Velocity matching:** walk/run CSS duration ↔ horizontal speed.  
**Inertia:** accelerate into move; friction to stop before idle.

## Files

| Path | Change |
|------|--------|
| `src/ui/components/MascotOverlay.tsx` | Expand actions, part keyframes, face overrides, physics/profiles; remove spin or map to attack/crawl |
| `src/store/mascotStore.ts` | Keep API; emotion/activity unchanged unless new emotion tokens needed |
| `public/mascot/**` | **Not required** (no pixel ship) |
| Settings / Layout | No required change |

Optional: keep a short comment in code pointing at pixel pack as motion reference (no binary assets).

## Acceptance criteria

1. Mascot remains SVG orange cat with independently animating head/arms/legs/tail.
2. Face reacts to emotion **and** overrides during hurt/fall/dead/attack/climb/crawl.
3. States exist and look distinct: idle, walk, run, jump, runJump, climb, crawl, attack, hurt, fall, dead.
4. Low / medium / high differ in frequency, walk vs run, and special actions.
5. Walk/run do not ice-skate; stop uses short deceleration; facing flips.
6. Soft vs hard toss paths work; platforms + bubble OK; activity persists.
7. No pixel PNGs required at runtime.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Too many keyframes in one file | Group `PART_STYLES` by action; keep naming `part-action` |
| Climb with −90° looks broken on biped | Prefer upright arm-over-arm climb; mild tilt only |
| Face + action fight | Action face wins while one-shot states active |
| Performance | One overlay; CSS animations; avoid per-frame React style churn |

## Non-goals

- Rendering FREE_Cat pixel sheets in the app
- Grey chibi pack integration
- User-uploaded mascot skins
- Keyboard platformer controls
