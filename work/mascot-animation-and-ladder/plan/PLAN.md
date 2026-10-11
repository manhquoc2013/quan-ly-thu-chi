# Implementation Plan: Mascot Animation & Ladder Overhaul

## Wave 1 (Independent Units: Store/Settings, Ladder Component, Puppet Fluidity)
- [ ] T1 | REQ-5 | src/store/mascotStore.ts, src/store/mascotStore.test.ts, src/ui/screens/settings/SettingsScreen.tsx, src/ui/components/LucyControlDeck.tsx | failing test in mascotStore.test.ts for enabled toggle & persistence, then add enabled state and Settings/Deck toggles | npx vitest run src/store/mascotStore.test.ts
- [ ] T2 | REQ-2 | src/ui/components/MascotLadder.tsx, src/ui/components/MascotLadder.test.tsx | failing test for MascotLadder rendering rungs and folding states, then build MascotLadder component | npx vitest run src/ui/components/MascotLadder.test.tsx
- [ ] T3 | REQ-4 | src/ui/components/NamCatPuppet.tsx, src/ui/components/NamCatPuppet.test.tsx | failing test for puppet squash & stretch and tail inertia dynamics, then implement fluid transformations | npx vitest run src/ui/components/NamCatPuppet.test.tsx

## Wave 2 (Clean Removal of Rope & Grapple)
- [ ] T4 | REQ-1 | src/ui/components/MascotOverlay.tsx | verify removal of grapple/rope hooks, then purge ropeOn, ropeLineRef, ropeHookRef and grapple action handling | npx tsc --noEmit

## Wave 3 (Locomotion Integration: Ladder Climbing & Parachute Descent)
- [ ] T5 | REQ-3 | src/ui/components/MascotOverlay.tsx, src/ui/components/MascotOverlay.test.tsx | failing test for descent branching (< 250px ladder down vs >= 250px parachute), then integrate MascotLadder deployment and descent rules | npx vitest run src/ui/components/MascotOverlay.test.tsx
