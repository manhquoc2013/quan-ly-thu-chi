---
feature-id: M-001
stage: final-quality-gate
agent: engineering-code-reviewer
verdict: Pass
must-fix-count: 0
should-fix-count: 1
last-updated: 2026-08-09
---

# OpenRouter AI Provider Integration — Code Review

## Scope Reviewed

Full OpenRouter AI provider integration across 12 files (713 insertions, 186 deletions), implementing a fourth cloud LLM source in the cascade: Kilo → OpenRouter → Groq → Gemini → WebLLM.

| # | File | Change | Reviewed |
|---|---|---|---|
| 1 | `src/services/openRouterService.ts` | NEW — 148 lines | ✅ |
| 2 | `src/services/llmTypes.ts` | +5 / -1 lines | ✅ |
| 3 | `src/services/llmCall.ts` | +12 / -1 lines | ✅ |
| 4 | `src/services/aiRouter.ts` | +123 / -? lines | ✅ |
| 5 | `src/services/llmBulkDraftExtractor.ts` | +4 / -1 lines | ✅ |
| 6 | `src/services/llmIntentExtractor.ts` | +270 / -? lines | ✅ |
| 7 | `src/services/userSettingsService.ts` | +12 / -? lines | ✅ |
| 8 | `src/services/syncEngine.ts` | +2 lines | ✅ |
| 9 | `src/store/authStore.ts` | +36 lines | ✅ |
| 10 | `src/ui/screens/settings/SettingsScreen.tsx` | +259 / -? lines | ✅ |
| 11 | `src/ui/screens/ai/AIChatScreen.tsx` | +5 / -1 lines | ✅ |
| 12 | `src/ui/screens/ai/ChatPanel.tsx` | +23 / -? lines | ✅ |

## Overall Verdict

**Pass.** The implementation is correct, complete, type-safe, and follows existing patterns. All gates pass. No must-fix defects found. One pre-existing should-fix discovered during review (unrelated to the OpenRouter change).

### Executed Verification

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **exit 0** — zero errors |
| Test suite | `npx vitest run` | **22/22 pass**, 188 tests (15 todo), exit 0 |
| ai-kit-verify gate | `--as-gate --module M-001` | **would_pass: true**, zero blocking findings |
| LSP impact | `openRouterService` symbol | 18 refs, 5 files — wired correctly |

## Requirement Alignment

All acceptance criteria met:

| AC | Status | Evidence |
|---|---|---|
| OpenRouter UI in Settings | ✅ | `SettingsScreen.tsx` — `aria-label="OpenRouter AI settings"` section with key input, toggle, test, save, clear |
| Key persists | ✅ | `authStore.ts` Zustand persist (localStorage) + `syncEngine.ts` outbox + `userSettingsService.ts` full Supabase write/read |
| Toggle removes/restores from cascade | ✅ | `authStore.ts:setEnableOpenRouter()` → `openRouterService.setEnabled()` |
| Test connection with 4-model fallback | ✅ | `openRouterService.ts:testConnection()` → `generateContent()` iterates MODEL_LIST |
| Chat routes to OpenRouter | ✅ | `llmCall.ts:tryProvider()` case `'openrouter'`; `aiRouter.ts:isCloudSource()` includes openrouter |
| Model fallback 1→2→3→4 | ✅ | `openRouterService.ts:generateContent()` for-loop with continue on non-200/error |
| Clear key removes from cascade | ✅ | `SettingsScreen.tsx:handleClearOpenRouterKey()` → `openRouterService.disconnect()` |
| Priority order | ✅ | `AI_PRIORITY_DEFAULT`: `['kilo', 'openrouter', 'groq', 'gemini', 'local']` |
| Union types complete | ✅ | All 6 downstream union types include `'openrouter'` (llmBulkDraftExtractor, llmIntentExtractor ×4, AIChatScreen, ChatPanel) |

## Architecture Alignment

The change faithfully mirrors the existing `groqService.ts` pattern — a deliberate trade-off documented in the dev summary. Each provider retains its own module with module-private module state (`apiKey`, `configured`, `enabled`), a shared `configure()`/`disconnect()`/`setEnabled()` interface, and a `generateContent()` method. The cascade in `llmCall.ts:tryProvider()` adds a new case following the identical gate-check pattern. No architectural drift detected.

## Code Quality Findings

### Strengths

- **Consistent pattern adherence.** `openRouterService.ts` follows `groqService.ts` exactly — same error handling, same timeout pattern, same response parsing shape, same null-return-on-failure contract. Any engineer familiar with one provider can understand the other instantly.
- **Clean abort handling.** Each model attempt creates its own `AbortController` + `setTimeout`, and the `finally` block clears the timeout regardless of outcome — no timer leaks.
- **Response body truncation.** `console.warn` logs `body.slice(0, 200)` rather than the full response, avoiding unbounded log growth on error responses.
- **Complete cascade wiring.** The `'openrouter'` case in `tryProvider()` checks all three gates (`isEnabled`, `isConfigured`, `navigator.onLine`) before attempting the call, matching the existing Groq pattern.

### Observations

| # | Severity | File:Line | Finding |
|---|---|---|---|
| O-1 | Observation | `openRouterService.ts:25-28` | Module-level side effect: `VITE_OPENROUTER_API_KEY` env var read at import time — same pattern as all other provider services. This can surprise if env vars change without a reload, but consistent with the existing codebase. |
| O-2 | Observation | `openRouterService.ts:145` | `testConnection()` reports `MODEL_LIST[0]` as the model used regardless of which model actually succeeded. Minor display inaccuracy; the LLM response text is correct. |
| O-3 | Observation | `SettingsScreen.tsx:378-387` vs `authStore.ts:168-174` | `handleTestOpenRouter` calls `openRouterService.configure(trimmed)` directly, then `setOpenRouterApiKey(trimmed)` also calls `syncOpenRouterService` → `openRouterService.configure`. Double-configure is idempotent and harmless — purely cosmetic. |

## Security Findings

All checks pass. No security defects found.

| Check | Result | Evidence |
|---|---|---|
| API key in URL/path | ✅ PASS | Key sent via `Authorization: Bearer` header only; URL is `https://openrouter.ai/api/v1/chat/completions` with no query params |
| Key logged in console | ✅ PASS | All 4 console.warn calls log model ID, status code, error message, or truncated response body — never the API key |
| Key input field masking | ✅ PASS | `SettingsScreen.tsx:815`: `<input type="password" ...>` |
| Key in localStorage | ⚠️ OBSERVED | Stored via Zustand persist middleware (`localStorage` key `ql-tc-auth`) — same pattern as all other API keys (Gemini, Groq, Kilo). This is the de facto project standard. |
| Key in Supabase sync | ⚠️ OBSERVED | Synced via `syncEngine.ts` to Supabase `user_settings` table — same pattern as all other keys. Encrypted at rest by Supabase; in transit via TLS. |
| No new dependencies | ✅ PASS | Uses native `fetch()` only |
| Cross-origin requests | ✅ PASS | `HTTP-Referer` and `X-Title` headers set per OpenRouter API requirements |

## Performance / Reliability / Operability

| Check | Result |
|---|---|
| Timeout handling | 45s per-model timeout with AbortController — reasonable. Total worst-case: 4 models × 45s = 3 min, but cascade short-circuits on first success |
| Offline handling | `navigator.onLine` gate before every call; returns null gracefully |
| Error degradation | On any failure (HTTP error, API error, timeout, network), logs a warning and tries next model. Returns null only if all 4 models fail — caller's cascade falls through |
| Memory leaks | No setInterval; all setTimeout cleared in finally block |
| No blocking I/O | All API calls async; no synchronous file/network operations |

## Test Adequacy

| Aspect | Result |
|---|---|
| Existing tests breakage | **Zero regressions** — 22/22 files pass (188 tests), exit 0 |
| Dedicated provider test | **None** — no `openRouterService.test.ts` exists. This mirrors the existing gap: only `kiloService.test.ts` has a provider-specific test file; `groqService.ts` and `geminiService.ts` also lack dedicated tests |
| Cascade coverage | `chatIntent.test.ts` (10 tests) and `intentSanitize.test.ts` (11 tests) exercise the cascade path indirectly, but do not verify the OpenRouter case specifically |
| Tests-call-production | The existing test files import and test production modules (e.g., `kiloService.test.ts` imports and calls `kiloService`). No inline implementation duplication detected |

**Assessment:** Test coverage is adequate for this change class (C2, additive, pattern-mirroring). The existing suite provides regression safety for the cascade and sync paths. Provider-specific tests are a pre-existing gap across all non-Kilo providers, not introduced by this change.

## Documentation Adequacy

Both dev summaries (`05-dev-w1-openrouter-provider.md` and `05-dev-w1-openrouter-type-fixes.md`) and the QA report (`07-qa-report-w1.md`) are thorough and accurate. They document the blockers encountered, the resolution, key technical decisions, and verification evidence. The OpenRouter service file itself carries a JSDoc header with API documentation links.

## Must-Fix Items

**None.**

## Should-Fix Items

| # | Severity | File:Line | Issue | Suggested Fix |
|---|---|---|---|---|
| SF-1 | Medium | `src/services/aiRouter.ts:84` | **Pre-existing bug:** `isCloudSource()` includes `kilo`, `openrouter`, `gemini` but is **missing `groq`**. When the cascade uses Groq, `isCloudSource('groq')` returns `false`, causing the reply source label to fall through incorrectly at line 996. | Add `'groq'` to the condition: `return source === 'cloud' \|\| source === 'kilo' \|\| source === 'openrouter' \|\| source === 'groq' \|\| source === 'gemini';` |

## Questions / Clarifications

None — all intent clear from the spec, dev summaries, and code.

## Follow-up Recommendations

1. **Add `groq` to `isCloudSource()`** (SF-1 above) — one-line fix, pre-existing but surfaced by this review.
2. **Consider provider test parity** — `kiloService.test.ts` is the only provider-specific test. A lightweight `openRouterService.test.ts` mocking `fetch` would catch model-list drift and response-parsing breakage early. This applies equally to `groqService` and `geminiService`.
3. **Model list maintenance** — the 4 free model IDs in `MODEL_LIST` are hardcoded. OpenRouter's free model lineup changes over time. Consider a periodic check or a fast-fail smoke test in CI.

## Final Review Summary

The OpenRouter AI provider integration is a well-executed, additive change that follows the established provider pattern with discipline. All 12 files are correctly wired — from the new service module, through the LLM cascade, auth store, settings UI, and Supabase sync pipeline. Typecheck and tests pass clean. Security posture matches the existing provider baseline. No blocking defects. One pre-existing bug in `isCloudSource()` (missing `groq`) was discovered during review and is recorded as a should-fix.
