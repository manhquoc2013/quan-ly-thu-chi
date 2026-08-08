---
feature-id: M-001
document: lean-architecture
last-updated: 2026-08-08
verdict: Pass
waves: 1
---

# Lean Architecture — Wave 1 UI Redesign

## Summary

Replace the pastel-blue theme (EFF2F7 bg / 1565C0 accent) with a Navy+Teal palette, replace the top horizontal tab bar with a collapsible vertical sidebar + new top bar, and add a dark mode toggle persisted to localStorage. One frontend developer task — all 11 affected files are UI-only; zero business-logic, store, or service changes.

## System Boundaries

| Service / Module | Responsibility |
|---|---|
| App shell (`src/App.tsx`) | Dark mode class lifecycle on `<html>` via localStorage |
| Layout (`src/ui/Layout.tsx`) | Sidebar + top bar + content area + mobile tabs + FAB + StatusBar |
| Theme CSS (`src/index.css`) | Design tokens: colors, typography, spacing, transitions |
| Theme JS (`src/ui/theme/tokens.ts`) | JS-accessible color/spacing/type exports for charts & inline styles |
| Theme presets (`src/ui/theme/presets.ts`) | Tailwind class strings for button/badge/panel/status variants |

## Integration Model

| Integration | Type | Contract |
|---|---|---|
| Layout → React Router | `<NavLink>` | Same 8 route paths: `/`, `/expense`, `/revenue`, `/customers`, `/products`, `/platforms`, `/report`, `/settings` |
| Layout → authStore | Zustand | `useAuthStore(s => s.userId)`, `useAuthStore(s => s.userProfile)` — read-only |
| App → localStorage | Web Storage | Key: `"theme"`, values: `"light"` / `"dark"` |

## Data Architecture: Theme State

| Entity | Storage | Schema |
|---|---|---|
| Theme preference | `localStorage` key `"theme"` | `"light"` (default) or `"dark"` |
| Dark mode visual state | CSS `.dark` class on `<html>` | Present/absent |
| Sidebar collapse state | React `useState` | `true` (expanded, default), component-local |

Dark mode flow: mount → read localStorage → toggle `.dark` class → CSS `.dark { }` overrides resolve → Tailwind utilities pick up new values.

## Key Decisions

| Decision | Chosen | Rationale |
|---|---|---|
| Theme delivery | CSS variables (@theme + .dark block) | Existing architecture; zero runtime JS cost |
| Sidebar navigation | `<NavLink>` with isActive | Same proven pattern as current tabs |
| Dark mode init | `App.tsx` useEffect on mount | Earliest React mount point, avoids flicker |
| Mobile sidebar | Keep existing bottom tabs | Proven UX on mobile; Wave 1 scope limit |
| Sidebar background | Fixed #1E293B (dark navy) in both modes | Matches preview design, consistent visual identity |
| FAB color | Fixed #0D9488 (teal) | Matches sidebar accent, pops in both modes |

## Work Order: WO-ui-redesign-wave1

**Goal:** All 11 source files updated: new Navy+Teal theme, vertical collapsible sidebar, new top bar, dark mode toggle, and secondary screen color updates.

**Assignee:** engineering-frontend-developer | **Complexity:** novel | **Wave:** 1

**Primary files:**
- `src/index.css` — new @theme block (Navy+Teal), .dark overrides, font size bump (14px base)
- `src/ui/theme/tokens.ts` — all JS color tokens updated; dimens updated (sidebarWidth: 240, collapsed: 64, headerHeight: 56)
- `src/ui/theme/presets.ts` — verify presets auto-resolve from updated tokens
- `src/ui/Layout.tsx` — REWRITE: sidebar + top bar; preserve all useEffect hooks verbatim (bootstrap, WebLLM, Kilo, clock, sync)
- `src/App.tsx` — add `useEffect`: read localStorage "theme", apply/remove .dark class

**Secondary files (hardcoded color audits):**
- `src/ui/components/StatusBar.tsx` — dotColor values
- `src/ui/screens/dashboard/DashboardScreen.tsx` — chart fill/stroke/tooltip hex values
- `src/ui/screens/expense/ExpenseScreen.tsx` — verify CSS-only (auto-resolves)
- `src/ui/screens/revenue/RevenueScreen.tsx` — verify/update inline styles
- `src/ui/screens/report/ReportScreen.tsx` — verify CSS-only
- `src/ui/screens/settings/SettingsScreen.tsx` — verify CSS+shadcn (auto-resolves)

**Theme tokens (canonical — source of truth is CSS @theme block):**
- Background: #F8FAFC (light) / #0F172A (dark)
- Surface: #FFFFFF (light) / #1E293B (dark)
- Accent: #0D9488 teal (light) / #2DD4BF teal (dark)
- Sidebar: #1E293B fixed dark navy
- Font base: 14px (was 13px), sm: 13px, lg: 15px, xl: 18px, 2xl: 22px

**Verify:** `bun run typecheck && bun run build`

**Done-when:** tsc exits 0, build succeeds, sidebar navigates 8 routes, dark mode toggles + persists, mobile bottom tabs work, sidebar collapses/expands smoothly, all screens render.

## Implementation Sequence

Single developer, single wave:
1. `src/index.css` — CSS tokens first
2. `src/ui/theme/tokens.ts` + `presets.ts` — JS mirrors
3. `src/App.tsx` — dark mode init
4. `src/ui/Layout.tsx` — sidebar + top bar rewrite
5. Secondary screen files — hardcoded color audits

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Lost logic during Layout.tsx rewrite | High | Preserve ALL 5 useEffect hooks verbatim from current Layout.tsx:77-145 |
| Hardcoded hex colors not caught by CSS cascade | Medium | Grep for `#` in screen files, update to new palette |
| `.dark` block conflict with existing shadcn variables | Low | Add custom-property overrides inside existing `.dark` block |
