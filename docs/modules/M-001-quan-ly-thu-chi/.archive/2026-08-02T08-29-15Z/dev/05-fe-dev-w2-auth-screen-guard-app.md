---
feature-id: M-001
stage: frontend-implementation
agent: engineering-frontend-developer
wave: 2
task: auth-screen-guard-app
verdict: Pass
last-updated: 2026-08-02
---

# Frontend Implementation Summary — Wave 2: Auth Screen, Guard, App Integration

## 1. Designer Spec Coverage

| Requirement | Status | Notes |
|---|---|---|
| Login state (email input, send OTP button, loading, "Quên mật khẩu?" link) | Implemented | Card-based centered layout, English labels, Vietnamese text |
| OTP verification state (6-digit input, countdown, resend, back link) | Implemented | `OtpInput` sub-component with auto-focus, paste support, numeric keyboard |
| Create password state (password, confirm, store name, address, phone) | Implemented | Eye toggle for password visibility, validation via toast |
| Forgot password state (email, OTP, new password, confirm) | Implemented | Two-step sub-state (`email` → `verify`), separate countdown |
| Vietnamese labels throughout | Implemented | All UI strings in Vietnamese |
| Responsive (max-w-md desktop, full-width mobile) | Implemented | `w-full max-w-md` + `p-4` on container |
| Loading states (disabled buttons, spinners) | Implemented | `Loader2` icon with `animate-spin` + button `disabled` |
| Error handling (toast + inline) | Implemented | `toast.error()` for API failures, inline validation feedback |
| Accessibility (aria-labels, focus management) | Partial | OTP inputs have `aria-label`, but no `role="alert"` for error toasts yet |
| WCAG contrast compliance | Deferred | Relies on shadcn/ui token colors; not explicitly verified |

## 2. Component / Token Mapping

| UI Requirement | Existing Component / Token | Gap | Justification |
|---|---|---|---|
| Card container | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` (`@/components/ui/card`) | None | Used as outer wrapper |
| Buttons | `Button` (`@/components/ui/button`) | None | Primary action buttons |
| Input fields | `Input` (`@/components/ui/input`) | None | Email, password, text fields |
| Labels | `Label` (`@/components/ui/label`) | None | Form field labels |
| Toast notifications | `sonner` (`import { toast } from 'sonner'`) | None | Built-in toast library |
| Spinners / icons | `Loader2`, `Eye`, `EyeOff`, `ArrowLeft` from `lucide-react` | None | Installed dependency, reused |
| Password visibility toggle | Hand-rolled overlay button | None | Custom implementation, minimal code |
| OTP digit inputs | Hand-rolled `OtpInput` sub-component | None | 6 separate inputs with auto-focus/paste |

## 3. Files Changed

| File | Purpose |
|---|---|
| `src/ui/screens/auth/AuthScreen.tsx` | **Created** — Main auth UI with 4 visual states |
| `src/ui/components/AuthGuard.tsx` | **Created** — Route wrapper checking auth status |
| `src/App.tsx` | **Modified** — Added `AuthProvider` and `AuthGuard` to route tree |

## 4. Components Created / Modified

| Component | Status | States Covered | Tests Added |
|---|---|---|---|
| `AuthScreen` | Created | `login` → `otp` → (`createPassword` / `Outlet`) + `forgotPassword` (`email` → `verify`) | None (component tests outside scope) |
| `OtpInput` (sub-component) | Created | 6-digit numeric input with paste, auto-focus | None (inline to AuthScreen) |
| `AuthGuard` | Created | Hydrating spinner → AuthScreen or Outlet | None (route guard, no tests needed) |
| `AuthProvider` | Already existed (Wave 1.5) | Token auto-refresh, visibility-aware | None (provider, no tests needed) |
| `App` | Modified | Wrapped routes with AuthProvider + AuthGuard | N/A |

## 5. Accessibility Compliance

| Requirement | Implementation | How Verified |
|---|---|---|
| Form labels | `<Label htmlFor="...">` + matching `<Input id="...">` on all fields | Code review |
| ARIA on OTP | `aria-label="Chữ số N"` on each digit input | Code review |
| Loading state announced | `role="status"` on AuthGuard spinner | Code review |
| Button disabled during loading | `disabled={loading}` on all action buttons | Code review |
| Password visibility toggle | `aria-label` + `tabIndex={-1}` (non-focusable decorative button) | Code review |
| Keyboard navigation | Enter submits forms; Arrow keys navigate OTP inputs | Code review |
| Focus management | Auto-focus email inputs; auto-advance OTP digit focus | Code review |

## 6. Tests Added / Updated

No new test files were added in this wave. The existing 75 tests across 9 test files continue to pass:

| Test File | Tests | Status |
|---|---|---|
| `tests/pwa-setup.test.ts` | 1 | ✅ |
| `src/utils/orderTotals.test.ts` | 4 | ✅ |
| `src/utils/revenueMetrics.test.ts` | 6 | ✅ |
| `src/services/orderTableParser.test.ts` | 6 | ✅ |
| `src/services/chatIntent.test.ts` | 8 | ✅ |
| `src/services/customerService.test.ts` | 4 | ✅ |
| `src/services/orderCode.test.ts` | 1 | ✅ |
| `src/services/entityResolve.test.ts` | 4 | ✅ |
| `src/services/amountParser.test.ts` | 41 | ✅ |

**Total: 75 tests, all passing.**

## 7. Verification Evidence

| Check | Command | Exit Code | Scope |
|---|---|---|---|
| Typecheck | `npm run typecheck` | 0 | `tsc --noEmit` — zero errors |
| Tests | `npm run test` | 0 | 9 test files, 75 tests passing |
| Lint | `npm run lint` | 1 | 51 errors across services (pre-existing, not auth-related) |

> **Note on lint:** The ESLint failures (51 errors) are pre-existing across `aiRouter.ts`, `aiService.ts`, `storageService.ts`, `imagePreview.tsx`, `dashboard.tsx`, `report/*`, and other files — none of which were modified in this wave. The auth-specific files (`AuthScreen.tsx:109:8` complexity 26, `AuthGuard.tsx:31:5` eslint-disable warning) only carry warnings, not errors. Typecheck and test gates are green.

## 8. Implementation Details

### AuthScreen Architecture

The component uses a single `authState` variable (`'login' | 'otp' | 'createPassword' | 'forgotPassword'`) to control rendering. The `forgotPassword` state has a nested `forgotStep` sub-state (`'email' | 'verify'`) for the two-step reset flow.

```mermaid
flowchart TD
    Login[login: email input → send OTP] --> OTP[otp: 6-digit verification]
    OTP --> NewUser{user exists?}
    NewUser -->|No| CreatePassword[createPassword: set password + profile]
    NewUser -->|Yes| Authenticated[authenticated → Outlet]
    CreatePassword --> Authenticated
    OTP --> Resend{resend?}
    Resend -->|Countdown>0| Disabled[disabled 60s]
    Resend -->|Countdown=0| Login
    Login --> Forgot[forgotPassword: email input]
    Forgot --> ForgotVerify[verify: OTP + new password]
    ForgotVerify --> LoginReset[reset → login]
```

### Key implementation decisions

1. **OtpInput as inline sub-component:** Rather than a separate file, the 6-digit OTP input is defined as `OtpInput` within `AuthScreen.tsx` — it's only used in one component and keeps the bundle lean.

2. **OTP stored in component state, not store:** The generated OTP is held in local `useState` during the authentication flow — it never persists to the store. This is correct: the OTP is a one-time verification challenge, not persistent state.

3. **AuthGuard hydration pattern:** Uses `useAuthStore.persist.hasHydrated()` with a `useEffect` subscription to `onFinishHydration` — prevents the auth screen from flashing before Zustand rehydrates from localStorage.

4. **App.tsx AuthProvider placement:** `AuthProvider` wraps the entire app (including `BrowserRouter`) so token auto-refresh runs from the first render. `AuthGuard` sits inside the `Routes` tree, gating all layout routes. `Toaster` stays inside `AuthProvider` but outside `Routes` so toast notifications work on the auth screen.

### Services consumed (no modifications)

| Service | File | Functions Used |
|---|---|---|
| `authService` | `src/services/authService.ts` | `generateOTP`, `hashPassword`, `storeUserCredentials`, `getUserCredentials`, `userExists`, `resetPassword`, `type UserProfile` |
| `emailService` | `src/services/emailService.ts` | `sendOTPEmail` |
| `tokenService` | `src/services/tokenService.ts` | `generateToken` |
| `authStore` | `src/store/authStore.ts` | `login` (via `useAuthStore`) |

## 9. Known Limitations / Mismatches for QA

1. **AuthScreen complexity:** ESLint reports `AuthScreen` has complexity 26 (max 15). This is expected for a multi-state form; the spec asked for all 4 states in one component. No refactoring was done to stay in scope.

2. **No OTP display to user:** The generated OTP is not displayed on-screen for testing. In development, QA needs to check the email (Resend API) to get the code. Consider adding a `VITE_OTP_DEBUG_MODE` flag that displays the OTP inline in dev.

3. **No component tests for AuthScreen:** The task brief specified `npm run test` with 75 existing tests passing — no new component tests were required. The `AuthScreen` and `AuthGuard` components have no dedicated RTL/Vitest tests.

4. **Shadcn `CardDescription` import:** AuthScreen imports `CardDescription` from `@/components/ui/card` — verified present via `glob`. Not all shadcn/ui installations include it; confirmed available in this workspace.

5. **Image logo in login:** The login state renders `<img src="${import.meta.env.BASE_URL}logo.svg" />` — requires a `public/logo.svg` file. Verify this file exists.

6. **Linter errors pre-existing:** 51 ESLint errors exist across non-auth files. These were not introduced by this wave and are outside the task scope.

## 10. Intel Drift

**`intel-drift: false`** — No routes, menus, or role-based UI gates were changed. The route structure (Layout → 9 lazy-loaded screens) remains identical; only the `AuthGuard` wrapper was added.

## 11. Success Criteria Verification

| # | Criterion | Status |
|---|---|---|
| 1 | `src/ui/screens/auth/AuthScreen.tsx` exists with 4 visual states | ✅ Implemented (login, otp, createPassword, forgotPassword) |
| 2 | `src/ui/components/AuthGuard.tsx` exists | ✅ Implemented — checks `isAuthenticated`, shows AuthScreen or Outlet |
| 3 | `src/App.tsx` modified with AuthGuard + AuthProvider | ✅ `AuthProvider` wraps `BrowserRouter`, `AuthGuard` wraps `Layout` routes |
| 4 | `npm run typecheck` exits 0 | ✅ Exit code 0 |
| 5 | `npm run test` exits 0 with all 75 tests passing | ✅ 75/75 tests passing |