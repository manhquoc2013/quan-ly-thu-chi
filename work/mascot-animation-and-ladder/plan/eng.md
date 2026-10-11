# Engineering Spec: Boundaries, Contracts & Seams

## 1. Modules & Boundaries
- `src/ui/components/MascotLadder.tsx`:
  - New component. Props: `{ x: number; bottomY: number; topY: number; state: 'deploying' | 'ready' | 'packing'; progress?: number }`.
  - Renders an SVG bamboo/folding ladder with rungs, deploy animation (spring-unfold from backpack), and pack-up retraction.
- `src/ui/components/MascotOverlay.tsx`:
  - Removes all rope/grapple logic (`ropeOn`, `ropeLineRef`, `ropeHookRef`, `speakLand('grapple')`).
  - Implements ladder locomotion lifecycle: Deploy ladder -> Climb ladder (up or down) -> Pack ladder -> Settle.
  - Implements descent branching: drop distance < 250px triggers ladder down; drop >= 250px or toss triggers parachute float.
- `src/ui/components/NamCatPuppet.tsx`:
  - Enhances tail, ear, and body SVG transforms with inertia and squash & stretch dynamics.
- `src/store/mascotStore.ts`:
  - Adds `enabled: boolean` (default: true).
  - Adds `setEnabled: (enabled: boolean) => void`.
  - Persisted in localStorage.
  - When `enabled` is false, `MascotOverlay` returns null immediately.
- `src/ui/screens/settings/SettingsScreen.tsx`:
  - Adds Mascot Enabled Switch in `tab === 'mascot'`.
- `src/ui/components/LucyControlDeck.tsx`:
  - Adds quick hide action button.

## 2. Testing Seams
- Unit tests:
  - `src/store/mascotStore.test.ts`: test `enabled` state toggling and persistence.
  - `src/ui/components/MascotLadder.test.tsx`: test ladder rendering rungs and bounds calculation.
  - Locomotion / Action tests: test action types and descent branching logic.
