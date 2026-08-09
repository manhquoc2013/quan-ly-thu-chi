# Mascot SVG + Pixel-Inspired Actions Implementation Plan

> **For agentic workers:** Implement task-by-task. Spec: `docs/superpowers/specs/2026-08-09-mascot-sprite-activity-design.md`.

**Goal:** Upgrade SVG mascot with full action set, face/limb control, RAF anti-teleport motion, readable parachute, and activity profiles.

**Architecture:** Single `MascotOverlay.tsx` — `CatBody` part keyframes + emotion/action face; overlay owns RAF position integration and scheduler.

**Tech Stack:** React, Zustand mascotStore, CSS keyframes, requestAnimationFrame.

## Global Constraints

- No pixel PNGs at runtime; SVG only.
- Legacy Action aliases (`flinch`/`tossed`/`spin`/`grapple`) still accepted by `CatBody` for AuthGuard/Chat.
- One motion driver (RAF); no stacked CSS top/left transition + WAAPI.

---

## Tasks

- [x] Task 1: Expand `CatBody` actions, keyframes, face overrides; normalize legacy aliases
- [x] Task 2: RAF motion (walk/run/climb/fall/jump) + activity profiles + parachute graphic
- [x] Task 3: Wire scheduler/drag; verify TypeScript; update `.ai-context.md`
