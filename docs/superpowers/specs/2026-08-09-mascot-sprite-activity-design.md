# Mascot Sprite Sheet + Activity Levels

Date: 2026-08-09  
Status: approved for planning  
Source assets: `/Users/tranquoc/Downloads/png/cat`  
Reference: walk-cycle guide (`mascot.rtf`) — sprite sheet + CSS `steps()` + JS movement

## Goal

Replace the SVG puppet (`CatBody`) with a chibi cat **sprite sheet** animation, and make **low / medium / high** activity levels drive distinct motion profiles (not only idle delay). Apply walk-cycle principles: frame stepping, velocity matching, inertia, and a clear state machine.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Visual source | Use pack `png/cat` as the real mascot (grey chibi), not generated SVG frames |
| Technique | Single spritesheet + CSS `steps()` + JS position/physics |
| Activity levels | Change delay, move speed, action mix, and walk vs run |
| Keep | Platform scan, drag/toss, speech bubble, double-click activity cycle, `mascotStore` persist |
| Out of scope | Dog pack, Dead animation, emotion-bubble redesign, Settings UI redesign |

## Asset pipeline

### Source frames (542×474, black background)

| Row / state | Frames | Used for |
|-------------|--------|----------|
| idle | 10 | Standing / breathing |
| walk | 10 | Normal locomotion |
| run | 8 | High-activity locomotion |
| jump | 8 | Jump, climb/grapple substitute |
| fall | 8 | Tossed / free-fall (parachute overlay may remain) |
| hurt | 10 | Flinch on grab |

Slide and Dead are **not** included in v1 (optional later).

### Build output

- Script (one-shot / repeatable): `scripts/build-mascot-sheet.mjs`
- Output: `public/mascot/cat/spritesheet.png`
- Meta: `public/mascot/cat/meta.json` with:
  - `frameWidth`, `frameHeight` (source or trimmed)
  - `displayWidth`, `displayHeight` (~64–72px UI size)
  - `rows`: ordered list of `{ name, frames }`
- Pre-process: remove solid black background (make transparent) before packing so the overlay does not show a black box.
- Packing: one horizontal strip per state; rows stacked vertically. Sheet width = `maxFrames * frameWidth`. Shorter rows leave empty cells on the right; runtime uses per-row `frames` from meta so `steps(frames)` never samples empty cells.

## Runtime architecture

```
mascotStore.activity ──► activityProfile (delay, speeds, weights)
                              │
schedule / intent ──► state machine (idle|walk|run|jump|fall|hurt)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            CSS class on            RAF / transitions
            .character              position x/y, facing
            (steps + row Y)         accel / friction
```

### Character element

- Single `div.character` with `background-image: url(/mascot/cat/spritesheet.png)`.
- CSS variables: `--fw`, `--fh`, `--frames`, `--dur`, `--row-y`.
- Active locomotion class e.g. `.anim-walk` → `animation: spriteCycle var(--dur) steps(var(--frames)) infinite`.
- `@keyframes spriteCycle`: `background-position-x` from `0` to `-fw * frames`.
- Row select: `background-position-y: calc(-1 * rowIndex * fh)`.
- Facing: `transform: scaleX(-1)` when moving left (do not flip the speech bubble separately incorrectly).

### Remove

- `CatBody` SVG and per-limb `@keyframes` in `MascotOverlay.tsx` (or delete export if unused elsewhere).

## State machine

| State | Sprite row | Enter | Exit |
|-------|------------|-------|------|
| idle | idle | default / after action | scheduler picks next |
| walk | walk | medium/low move intent | reach target or friction stop → idle |
| run | run | high move intent | same as walk |
| jump | jump | jump / climb / grapple | land → idle |
| fall | fall | after drag release (toss) | land → idle |
| hurt | hurt | mousedown / grab | short duration → idle or drag follow |

Climb/grapple keep existing platform targeting but **reuse jump** (or fall) frames — no separate climb sheet in v1.

Spin (current SVG twirl) is **dropped** in v1 unless Slide row is added later; replace with short jump or idle stretch in the action weights.

## Activity profiles

| Profile | Delay between actions | Locomotion | Jump / climb weight | Max speed (px/frame @60fps) | Cycle duration |
|---------|----------------------|------------|---------------------|-----------------------------|----------------|
| low | 4000–9000 ms | mostly idle + slow walk | rare | ~2–3 | walk ~0.9–1.1s |
| medium | 2000–5000 ms | walk primary | moderate | ~4–5 | walk ~0.7–0.85s |
| high | 800–2000 ms | run + walk | frequent | ~6–8 | run ~0.45–0.6s, walk ~0.55s |

**Velocity matching:** choose `--dur` so one full walk/run cycle roughly matches distance traveled per cycle (avoid “ice skating”). Tune empirically after sheet is in place.

**Inertia:** on walk/run start, accelerate toward target speed; on stop, apply friction until `|vx| < epsilon` then switch to idle and remove walk/run class.

## Interaction (unchanged behavior, new sprites)

- Drag → `hurt` while holding; release with velocity → `fall` + optional parachute; land on platform/ground → idle.
- Double-click cycles `low → medium → high → low` via existing `setActivity`.
- Speech bubble + idle chatter remain; emotion strings in store still accepted but face is baked into sprites (no SVG mouth swap).

## Files

| Path | Change |
|------|--------|
| `scripts/build-mascot-sheet.mjs` | New — pack + transparency |
| `public/mascot/cat/spritesheet.png` | New — built asset |
| `public/mascot/cat/meta.json` | New — dimensions / row meta |
| `src/ui/components/MascotOverlay.tsx` | Major — sprite + physics + profiles |
| `src/store/mascotStore.ts` | Keep API; no breaking change expected |
| Settings / Layout | No required change if activity API unchanged |

## Acceptance criteria

1. Mascot renders grey chibi from spritesheet (no orange SVG body).
2. Idle / walk / run / jump / fall / hurt each play correct row with discrete frames (`steps`, no smear).
3. Low vs medium vs high are visibly different (frequency, walk vs run, jump rate, speed).
4. Walk/run does not look like sliding: limb cycle speed matches travel speed.
5. Stop has a short deceleration; facing flips with direction.
6. Drag/toss still lands on scanned platforms; bubble still works.
7. Activity persists across reload (existing zustand persist).
8. Bundle: one sheet image under `public/` (no importing 74 individual PNGs into the JS graph).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Sheet too large | Downscale frames when packing (e.g. 128px wide) while keeping aspect; compress PNG |
| Black fringe after keying | Slight choke/erode or threshold cleanup in build script |
| Climb looks wrong on jump frames | Prefer short vertical move + jump cycle; avoid long climb holds |
| `CatBody` imported elsewhere | Grep and update exports in `components/index.ts` |

## Non-goals

- Pixel-perfect parity with old orange cat branding
- User-uploaded custom sprites
- Gamepad / keyboard control (guide demo only)
