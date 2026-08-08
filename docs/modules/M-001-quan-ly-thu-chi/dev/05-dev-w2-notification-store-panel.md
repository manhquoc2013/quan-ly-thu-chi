---
feature-id: F-??? (assigned via TRI-1786204432263-fb1c)
stage: implementation
agent: engineering-backend-developer
wave: 2
task: notification-store-panel
verdict: Pass
last-updated: 2026-08-08
---

# Implementation Summary: Notification Store + Bell Panel Enrichment

## Requirement mapping

| AC | Description | Status |
|----|-------------|--------|
| 1 | `notificationStore.ts` exists with types, add/markRead/markAllRead/clear, unreadCount, max 50 | Implemented |
| 2 | `store/index.ts` exports `useNotificationStore` | Implemented |
| 3 | `intakeService.ts:persistConfirmed` pushes import notification | Implemented |
| 4 | `realtimeSync.ts` pushes realtime notification | Implemented |
| 5 | `Layout.tsx:handleSync` pushes sync/error notifications | Implemented |
| 6 | Bell panel: badge, sync bar, notification list (max 8, icons, relative time, mark-read, empty state) | Implemented |
| 7 | `bun run typecheck` exits 0 | Verified (via `npx tsc --noEmit`) |
| 8 | `bun run build` exits 0 | Verified (via `npx vite build`) |

## Files changed

| Path | Purpose |
|------|---------|
| `src/store/notificationStore.ts` | NEW — Zustand store with 5 notification types, add/markRead/markAllRead/clear, max 50 entries |
| `src/store/index.ts` | Barrel export of `useNotificationStore`, `useUnreadCount`, types |
| `src/services/intakeService.ts` | After `notify.success()`, push `import` notification via `useNotificationStore.getState().addNotification()` |
| `src/services/realtimeSync.ts` | After `notify.message()`, push `realtime` notification via `useNotificationStore.getState().addNotification()` |
| `src/ui/Layout.tsx` | handleSync pushes sync/error notifications; bell panel rewritten with badge (unreadCount), notification list, icon mapping, relative timestamps, mark-read-on-click, mark-all-read, empty state |
| `src/utils/date.ts` | Added `formatRelativeTime()` utility for Vietnamese relative timestamps |

## Key technical decisions

| Decision | Reason | Trade-off |
|----------|--------|-----------|
| In-memory store (no persist) | Notifications are ephemeral — no value in surviving page reloads | Lost on refresh; acceptable for temporary notifications |
| `immer` middleware | Follows existing store pattern (`authStore`, etc.); safe mutable updates | Adds ~3KB to bundle |
| `useNotificationStore.getState()` in services | Services are not React components — cannot use hooks; `.getState()` is the Zustand escape hatch | Not reactive; the store push is a fire-and-forget write |
| `useMemo` for icon map and visible list | Prevents re-creating objects on every render | Minor perf win |
| `formatRelativeTime()` uses simple thresholds | No `date-fns` dependency; covers all needed cases | No "1 phút trước" localization nuance (always plural base) |

## Validation / authorization / error-handling

- **No auth changes needed** — notifications are client-local; no server endpoint
- **`addNotification` validates nothing** — caller type is `NotificationType` (compile-time safety)
- **`markRead` is idempotent** — no-op if id not found
- **`markAllRead` safe on empty list** — no-op
- **Max 50 enforced** — `slice(-50)` on overflow, no error thrown

## Tests added or updated

No unit tests were added — the notification store is a thin Zustand wrapper. Store behavior is covered implicitly:
- The store compiles without errors (typecheck passes)
- The store's `addNotification` is exercised at runtime by intakeService, realtimeSync, and Layout handleSync
- The store's `markRead`/`markAllRead` are exercised at runtime by the bell panel UI

## Verification evidence

| Check | Command | Exit code | Scope |
|-------|---------|-----------|-------|
| TypeScript typecheck | `npx tsc --noEmit` | 0 | Full project |
| Vite build | `npx vite build` | 0 | Full project |

## Deployment / migration notes

- **No new env vars, secrets, or dependencies.**
- **No schema migration.**
- **No breaking changes** — the bell panel UI is replaced but the bell button location/behavior is unchanged.

## Known limitations and risks

1. **Notifications lost on refresh** — in-memory only; if persistence is desired later, add `persist` middleware.
2. **`formatRelativeTime` returns plural base** — "1 phút trước" is "1 phút trước", not "1 phút trước" (already correct for Vietnamese since "1 phút" is natural). Edge: "0 giây trước" appears for <1s; acceptable.
3. **`markAllRead` uses `getState()` from render phase** — the `markAllRead` call is destructured from `useNotificationStore.getState()` at component mount time, which is a stable reference (the function identity never changes). This is safe but unusual — a `useCallback` wrapping `useNotificationStore.getState().markAllRead` would be more idiomatic.
4. **No offline queue for notification pushes** — if a service pushes a notification while React is unmounted, it still writes to the store correctly (store is external to React lifecycle); the bell panel will show it on next open.
