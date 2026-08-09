# Mascot Sprite Sheet + Activity Levels

Date: 2026-08-09  
Status: approved for planning  
Source assets: `/Users/tranquoc/Downloads/png/cat`  
Reference: walk-cycle guide (`mascot.rtf`) — sprite sheet + CSS `steps()` + JS movement

## Goal

Replace the SVG puppet (`CatBody`) with a chibi cat **sprite sheet** animation, and make **low / medium / high** activity levels drive distinct motion profiles (not only idle delay). Apply walk-cycle principles: frame stepping, velocity matching, inertia, and a clear state machine. Cover **all pack actions** used by the overlay: idle, walk, run, jump, fall, hurt, slide, dead.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Visual source | Use pack `png/cat` as the real mascot (grey chibi), not generated SVG frames |
| Technique | Single spritesheet + CSS `steps()` + JS position/physics |
| Activity levels | Change delay, move speed, action mix, and walk vs run |
| Full pack rows | Include Slide + Dead (not only locomotion) |
| Keep | Platform scan, drag/toss, speech bubble, double-click activity cycle, `mascotStore` persist |
| Out of scope | Dog pack, emotion-bubble redesign, Settings UI redesign |

## Asset pipeline

### Source frames (542×474, black background) — all rows in v1

| Row / state | Frames | Used for |
|-------------|--------|----------|
| idle | 10 | Standing / breathing |
| walk | 10 | Normal locomotion |
| run | 8 | High-activity locomotion |
| jump | 8 | Jump; climb/grapple vertical hops |
| fall | 8 | Soft toss / free-fall (parachute overlay may remain) |
| hurt | 10 | Flinch on grab / poke |
| slide | 10 | Replaces old SVG `spin`; playful ground slide / celebrate twitch |
| dead | 10 | Hard toss “KO” gag, then recover |

Sheet uses **all 74 frames** from `png/cat` (no leftover actions in the pack for this character).

### Build output

- Script (one-shot / repeatable): `scripts/build-mascot-sheet.mjs`
- Output: `public/mascot/cat/spritesheet.png`
- Meta: `public/mascot/cat/meta.json` with:
  - `frameWidth`, `frameHeight` (source or trimmed)
  - `displayWidth`, `displayHeight` (~64–72px UI size)
  - `rows`: ordered list of `{ name, frames }` — order: idle, walk, run, jump, fall, hurt, slide, dead
- Pre-process: remove solid black background (make transparent) before packing so the overlay does not show a black box.
- Packing: one horizontal strip per state; rows stacked vertically. Sheet width = `maxFrames * frameWidth` (maxFrames = 10). Shorter rows leave empty cells on the right; runtime uses per-row `frames` from meta so `steps(frames)` never samples empty cells.

## Runtime architecture

```
mascotStore.activity ──► activityProfile (delay, speeds, weights)
                              │
schedule / intent ──► state machine
  (idle|walk|run|jump|fall|hurt|slide|dead)
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
- Active class e.g. `.anim-walk` → `animation: spriteCycle var(--dur) steps(var(--frames)) infinite` (or `forwards` once for one-shot rows: hurt/slide/dead/jump/fall).
- `@keyframes spriteCycle`: `background-position-x` from `0` to `-fw * frames`.
- Row select: `background-position-y: calc(-1 * rowIndex * fh)`.
- Facing: `transform: scaleX(-1)` when moving left (speech bubble must not inherit the flip incorrectly).

### Remove

- `CatBody` SVG and per-limb `@keyframes` in `MascotOverlay.tsx` (or delete export if unused elsewhere).

## State machine

| State | Sprite row | Loop | Enter | Exit |
|-------|------------|------|-------|------|
| idle | idle | infinite | default / after action | scheduler picks next |
| walk | walk | infinite | low/medium move intent | friction stop → idle |
| run | run | infinite | high move intent | friction stop → idle |
| jump | jump | once / short loop | jump, climb, grapple | land → idle |
| fall | fall | once / short loop | soft toss (release with moderate velocity) | land → idle |
| hurt | hurt | once | mousedown / grab / poke | short duration → idle or stay while dragging |
| slide | slide | once | scheduler “spin” replacement; optional landing flourish | end of cycle → idle |
| dead | dead | once | hard toss (release speed / distance above threshold) | ~1.2–1.8s then idle + optional quip |

### Climb / grapple

Keep existing platform targeting; play **jump** frames during the vertical move (no dedicated climb sheet in pack).

### Toss severity

| Release | Sprite | Notes |
|---------|--------|-------|
| Click / tiny move | hurt → idle | Activity cycle on double-click unchanged |
| Soft toss | fall (+ parachute optional) | Land on platform/ground |
| Hard toss (`hypot(dx,dy)` or speed ≥ threshold) | fall in air, then **dead** on land | Playful KO; auto-recover; no permanent disable |

## Activity profiles

| Profile | Delay between actions | Locomotion | Jump / climb | Slide weight | Max speed (px/frame @60fps) | Cycle duration |
|---------|----------------------|------------|--------------|--------------|-----------------------------|----------------|
| low | 4000–9000 ms | mostly idle + slow walk | rare | rare | ~2–3 | walk ~0.9–1.1s |
| medium | 2000–5000 ms | walk primary | moderate | occasional | ~4–5 | walk ~0.7–0.85s |
| high | 800–2000 ms | run + walk | frequent | more often | ~6–8 | run ~0.45–0.6s, walk ~0.55s |

**Velocity matching:** choose `--dur` so one full walk/run cycle roughly matches distance traveled per cycle (avoid “ice skating”). Tune empirically after sheet is in place.

**Inertia:** on walk/run start, accelerate toward target speed; on stop, apply friction until `|vx| < epsilon` then switch to idle and remove walk/run class.

## Interaction

- Drag → `hurt` while holding.
- Soft release → `fall` (+ optional parachute); land → idle.
- Hard release → `fall` then `dead` on land; recover to idle; may `speak` a short gag line.
- Scheduler may pick `slide` instead of the old SVG spin.
- Double-click cycles `low → medium → high → low` via existing `setActivity`.
- Speech bubble + idle chatter remain; emotion strings in store still accepted but face is baked into sprites (no SVG mouth swap).

## Files

| Path | Change |
|------|--------|
| `scripts/build-mascot-sheet.mjs` | New — pack + transparency (8 rows) |
| `public/mascot/cat/spritesheet.png` | New — built asset |
| `public/mascot/cat/meta.json` | New — dimensions / row meta |
| `src/ui/components/MascotOverlay.tsx` | Major — sprite + physics + profiles |
| `src/store/mascotStore.ts` | Keep API; no breaking change expected |
| Settings / Layout | No required change if activity API unchanged |

## Acceptance criteria

1. Mascot renders grey chibi from spritesheet (no orange SVG body).
2. All eight rows play correctly with discrete frames (`steps`, no smear): idle, walk, run, jump, fall, hurt, slide, dead.
3. Low vs medium vs high are visibly different (frequency, walk vs run, jump/slide rate, speed).
4. Walk/run does not look like sliding ice: limb cycle speed matches travel speed (ground **slide** state is intentional and uses the slide row).
5. Stop has a short deceleration; facing flips with direction.
6. Soft toss → fall; hard toss → dead gag then recover; platforms + bubble still work.
7. Activity persists across reload (existing zustand persist).
8. Bundle: one sheet image under `public/` (no importing 74 individual PNGs into the JS graph).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Sheet too large (8×10 frames) | Downscale frames when packing (e.g. 128px wide) while keeping aspect; compress PNG |
| Black fringe after keying | Slight choke/erode or threshold cleanup in build script |
| Climb looks wrong on jump frames | Prefer short vertical move + jump cycle; avoid long climb holds |
| Dead feels too dark | Keep short, auto-recover, light speech line; only on hard toss |
| `CatBody` imported elsewhere | Grep and update exports in `components/index.ts` |

## Non-goals

- Pixel-perfect parity with old orange cat branding
- User-uploaded custom sprites
- Gamepad / keyboard control (guide demo only)
- Dog pack
