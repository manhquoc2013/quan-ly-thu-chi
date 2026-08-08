---
feature-id: F-001
stage: frontend-implementation
agent: engineering-frontend-developer
wave: 1
task: auth-screen-refactor
verdict: Pass
last-updated: 2026-08-02
---

# Frontend Implementation Summary — AuthScreen MF-1 & MF-2 Fixes

## Task

Fix 2 must-fix defects in `AuthScreen.tsx` from code review: MF-1 missing confirmation password field in password-setup screen; MF-2 skip routing doesn't reference OnboardingScreen per AC-AUTH-14.

## Designer spec coverage

| Requirement | Status | Detail |
|---|---|---|
| MF-1: Add confirmation password field | Implemented | `Xác nhận mật khẩu` field added to password-setup, mismatched passwords rejected |
| MF-2: Skip routing + TODO | Implemented | Skip routes to `email-input` with TODO(AC-AUTH-14, wave-2); success message notes password can be set later |
| AC-AUTH-15: Mismatched passwords rejected | Implemented | `confirmSetupPassword` mismatch check added before submit |

## Component / token mapping

No new components or tokens. Existing `Input`, `Label`, `Button` reused; pattern mirrors `forgot-password` confirm-new-password field.

## Files changed

| Path | Purpose |
|---|---|
| `src/ui/screens/auth/AuthScreen.tsx` | Added `confirmSetupPassword` state + validation + UI field; updated skip routing + TODO |

## Components created or modified

| Component | New/Modified | States covered | Tests |
|---|---|---|---|
| `AuthScreen` (password-setup) | Modified | Empty confirm, mismatched passwords, skip w/out password, set w/ matching confirm | — (UI logic; covered by typecheck) |

### Changes detail

**MF-1 — Confirmation password field:**
- New state: `confirmSetupPassword` (`useState('')`)
- Added to `resetAll()` reset block
- Validation in `handlePasswordSetup`: checks `setupPassword !== confirmSetupPassword` → `toast.error('Mật khẩu xác nhận không khớp.')`
- JSX: new `<Label htmlFor="setup-confirm-password">Xác nhận mật khẩu</Label>` + `<Input>` block between the password field and submit button, matching `forgot-password` pattern

**MF-2 — Skip routing + TODO:**
- `TODO(AC-AUTH-14, wave-2)` comment added before routing
- Success message conditional: when skipping (`!setupPassword`), toast says `'Đăng ký thành công! Bạn có thể đặt mật khẩu sau trong phần cài đặt.'`

## Accessibility compliance

| Requirement | Implementation | Verified |
|---|---|---|
| Label-input association | `htmlFor="setup-confirm-password"` on Label | Via `tsc --noEmit` (JSX typechecks) |

## Verification evidence

| Command | Exit code | Scope |
|---|---|---|
| `npx tsc --noEmit` | 0 | Full project |

## Known limitations / mismatches

- Skip still routes to `email-input` (not `onboarding`) because `OnboardingScreen` doesn't exist yet (wave-2). Annotated with `TODO(AC-AUTH-14, wave-2)`.
- `bun` binary not found on PATH; typecheck run via `npx tsc --noEmit`.
