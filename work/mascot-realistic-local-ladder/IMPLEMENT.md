# IMPLEMENTATION SUMMARY

## Proposed Commit Message
`fix(mascot): enforce local ladder climb height (36-160px) and upward packing retract`

## Changes Summary
1. **src/ui/components/MascotLadder.tsx**:
   - Added `packDirection?: 'to-top' | 'to-bottom'` (defaults to `'to-top'`).
   - In `state === 'packing'`, ladder anchors top rail at `topY` and retracts bottom rails upward (`currentBottomY = topY + currentHeight`), cleanly folding into Mèo Nấm's backpack.
2. **src/ui/components/MascotOverlay.tsx**:
   - Defined & exported `MIN_LADDER_CLIMB_HEIGHT = 36` and `MAX_LADDER_CLIMB_HEIGHT = 160`.
   - Constrained `doClimb` and autonomous climbing choices so ladders only deploy for local spans between 36px and 160px.
   - Clamped `ladderBottomY` to safe boundaries (`Math.min(from.y + H, groundY() + H - 4)`), preventing ladders from slicing through the bottom bar or screen edges.
   - For vertical descents exceeding 160px, falls smoothly transition to parachute glide instead of huge ladders.
3. **Tests**:
   - `MascotLadder.test.tsx`: Added unit test verifying upward packing retraction into backpack.
   - `MascotOverlay.test.tsx`: Added unit tests verifying ladder height clamp bounds.
   - Full test suite: 229 tests passed, 0 lint errors, 0 lint warnings.
