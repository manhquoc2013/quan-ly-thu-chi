# IMPLEMENTATION RECORD

- **Branch:** Current branch (per no auto-commit / no auto-branch policy)
- **Commit Message Suggestion:** `feat(mascot): purge grapple rope remnants and enforce realistic vertical ladder locomotion`
- **Changed Files:**
  - `src/services/mascotLines.ts`: Removed 'grapple' from `LandVibe` union and `LAND_LINES` record.
  - `src/ui/components/NamCatPuppet.tsx`: Refined keyframes for `body-climb` (upright `rotate(0)`), `larm-climb` / `rarm-climb` (alternating rung grasping), and `lleg-climb` / `rleg-climb` (rung stepping).
  - `src/ui/components/MascotOverlay.tsx`: Removed 'grapple' action alias; centered mascot at `ladderX - W / 2`; ensured standing posture during deploy; straight vertical Y-axis locomotion with `spinAngle = 0`; proper transitions to idle and ladder packing.
  - `src/ui/components/MascotOverlay.test.tsx`: Added unit test coverage for `normalizeAction` without grapple and verified absence of grappling hook SVG lines.
