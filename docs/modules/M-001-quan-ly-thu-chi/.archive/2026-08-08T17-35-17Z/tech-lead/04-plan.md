---
feature-id: M-001
document: tech-lead-plan
output-mode: lean
last-updated: 2026-08-08
verdict: Pass
waves: 1
---

# OpenRouter AI Provider — Technical Lead Plan

**Triage reference:** `docs/intel/_intake/TRI-1786205159267-353f.json`

## Summary

Add OpenRouter.ai as a new cloud AI provider in the LLM cascade (Kilo → OpenRouter → Groq → Gemini → WebLLM). OpenRouter uses an OpenAI-compatible API at `https://openrouter.ai/api/v1`, mirrors the existing `groqService.ts` pattern, and adds auto-fallback across 4 free models. One developer wave — all 8 files tightly coupled across service layer + auth store + settings UI.

Key trade-off: OpenRouter sits between Kilo (auto-free, no key) and Groq (needs key) in the cascade, giving users a free-tier cloud option with API key configuration.

## System Boundaries

| Service/Module | Responsibility | Owns | Calls | Exposes |
|---|---|---|---|---|
| `openRouterService.ts` (NEW) | OpenRouter API integration, model fallback | API key, model list, fetch logic | `https://openrouter.ai/api/v1/chat/completions` | `configure(key)`, `isConfigured`, `isEnabled`, `generateContent(prompt)`, `testConnection()` |
| `llmTypes.ts` | Source-type registry | `LlmSource` type, priority default, labels | — | `'openrouter'` source, label |
| `llmCall.ts` | Cascade orchestrator | Provider routing, fallback chain | `openRouterService` | OpenRouter case in `tryProvider()`, `canUseCloudLlm()` |
| `aiRouter.ts` | Chat reply routing | `ChatReplySource` type, cloud-source check | `callLlmCascade` (indirect via llmCall) | `'openrouter'` in `ChatReplySource`, `isCloudSource()` |
| `authStore.ts` | Persistent settings state | `openRouterApiKey`, `openRouterConfigured`, `enableOpenRouter` | `openRouterService` (sync) | `setOpenRouterApiKey`, `setEnableOpenRouter` |
| `SettingsScreen.tsx` | User-facing OpenRouter config UI | API key input, toggle, test/save/clear | `authStore`, `openRouterService`, `userSettingsService` | OpenRouter section (mirrors Groq section) |
| `userSettingsService.ts` | Cloud sync schema | `openrouter_api_key`, `enable_openrouter` columns | Supabase | `UserSettingsRow` extended, sync functions |
| `syncEngine.ts` | Outbox flush | OpenRouter fields in `user_settings` upsert | `upsertUserSettings` | Flush passthrough |

## Integration Model

| Integration | Type | Contract | Timeout | Retry | Idempotent |
|---|---|---|---|---|---|
| OpenRouter API | HTTP POST (OpenAI-compatible) | `POST https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <key>`, JSON body `{model, messages, temperature, max_tokens}` | 45s (AbortController) | None — returns null on any failure, cascade falls through | Yes (stateless read) |

## Data Architecture

| Entity | Owner | Storage | Consistency | Migration needed |
|---|---|---|---|---|
| OpenRouter API key | `authStore.ts` | Zustand persist → localStorage (`ql-tc-auth`) | Immediate local, eventual cloud via Supabase outbox | None (new field in existing store) |
| OpenRouter enabled toggle | `authStore.ts` | Same as above | Same | None |
| `openrouter_api_key` column | `userSettingsService.ts` | Supabase `user_settings` table | Cloud eventual | None (nullable column, compatible with existing rows) |

## Security

- **Auth/authz:** API key stored client-side in localStorage (Zustand persist), transmitted as `Bearer` token to OpenRouter — same pattern as Groq.
- **PII/secrets:** API key is a user credential. Not logged. Input type `password` in UI. Synced to Supabase `user_settings` table (RLS-protected per `user_id`).
- **Trust boundary:** Browser → OpenRouter API. Same threat model as Groq: client-side only, no server proxy.

## Key Decisions

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Service pattern | Mirror `groqService.ts` exactly | Abstract into generic provider interface | Groq pattern is proven, each provider has different quirks (model lists, error shapes), abstracting now adds indirection with no benefit |
| Model fallback | 4 free models with `:free` suffix, cascade within `generateContent()` | Use OpenRouter's built-in routing | OpenRouter free models have per-model rate limits; trying in sequence maximizes success |
| Cascade position | Kilo → OpenRouter → Groq → Gemini → WebLLM | OpenRouter before Kilo | Kilo is no-key zero-config; OpenRouter needs a key. Users who configure OpenRouter get it after Kilo (free-tier harmony) but before key-required Groq |
| `:free` suffix approach | Append `:free` to model IDs | Use separate model list with `:free` variants | OpenRouter requires `:free` suffix for free-tier routing; simplest approach |

## Requirement-to-Execution Mapping

| Requirement (from triage) | Covered by |
|---|---|
| OpenRouter section in Settings with API key, toggle, test | WO-openrouter-provider (SettingsScreen.tsx) |
| AI chat uses OpenRouter when configured & enabled | WO-openrouter-provider (llmCall.ts, aiRouter.ts) |
| Auto-fallback across free models on rate-limit | WO-openrouter-provider (openRouterService.ts) |
| Build + typecheck pass | WO-openrouter-provider verify commands |

## Task Breakdown

| Task | Description | Dependency | Owner type | Wave | Parallelizable | Risk |
|---|---|---|---|---|---|---|
| WO-openrouter-provider | Add OpenRouter service + types + cascade integration + auth store + settings UI + sync schema | None | backend | 1 | No (all 8 files self-contained) | Low — additive, proven pattern |

## Work Orders

### WO-openrouter-provider

- **goal:** OpenRouter appears as a configurable AI provider in Settings, participates in the LLM cascade, and settings sync to cloud.
- **assignee-role:** engineering-backend-developer
- **complexity:** novel
- **files:**
  - `src/services/llmTypes.ts:9` — Add `'openrouter'` to `LlmSource`, insert after `'kilo'` in `AI_PRIORITY_DEFAULT`, add entry to `LLM_SOURCE_LABELS`
  - `src/services/openRouterService.ts` — NEW file (mirror `src/services/groqService.ts`)
  - `src/services/llmCall.ts:8-11` — Import `openRouterService`, add `'openrouter'` case in `tryProvider()`, update `canUseCloudLlm()`
  - `src/services/aiRouter.ts:59` — Add `'openrouter'` to `ChatReplySource`, update `isCloudSource()`
  - `src/store/authStore.ts:24-40` — Add `openRouterApiKey`, `openRouterConfigured`, `enableOpenRouter` to `AuthState`, add `setOpenRouterApiKey`/`setEnableOpenRouter` to `AuthActions`, add `syncOpenRouterService()`, wire into persist partialize + onRehydrateStorage
  - `src/ui/screens/settings/SettingsScreen.tsx:616` — Add OpenRouter section (mirror Groq section at line ~616): API key input (type=password), enable toggle, test/save/clear buttons; add `openRouterKeyInput`/`testingOpenRouter` state; update `availableSources` useMemo switch to include `'openrouter'` case
  - `src/services/userSettingsService.ts:15-20,29-35,47-55,82-95` — Add `openrouter_api_key` + `enable_openrouter` to `UserSettingsRow` interface; add `'openrouter'` to `parseAiPriority()` allowed set; update `upsertUserSettings()` call, `applyUserSettingsToStore()`, and `settingsRowFromStore()`
  - `src/services/syncEngine.ts:37-51` — Add `openrouter_api_key` and `enable_openrouter` passthrough in `upsertUserSettings()` call within `flushOutbox()`

- **contracts:**
  - OpenRouter API: `POST https://openrouter.ai/api/v1/chat/completions` — OpenAI-compatible; headers include `Authorization: Bearer <key>`, `HTTP-Referer` (app origin), `X-Title` (app name); body `{model: MODEL_LIST[attemptIndex], messages: [{role:'user',content:prompt}], temperature:0.2, max_tokens:1024}`; models: `["google/gemini-2.0-flash-001:free","meta-llama/llama-4-maverick:free","qwen/qwen3-8b:free","deepseek/deepseek-chat-v3-0324:free"]`; iterate models on non-200/error, return null if all fail; 45s AbortController timeout
  - AuthStore contract: `openRouterApiKey: string | null`, `openRouterConfigured: boolean`, `enableOpenRouter: boolean` (default `true`) in `AuthState`; `setOpenRouterApiKey(key: string | null)`, `setEnableOpenRouter(v: boolean)` in `AuthActions`; `syncOpenRouterService()` mirrors `syncGroqService()` pattern
  - Cascade contract: `tryProvider()` case `'openrouter'`: check `openRouterService.isEnabled && openRouterService.isConfigured && navigator.onLine`, call `generateContent(prompt)`, return null on null/failure; `canUseCloudLlm()`: check `openRouterConfigured && openRouterService.isConfigured` under `enableOpenRouter !== false`
  - `ChatReplySource` type extended with `'openrouter'`; `isCloudSource()` returns true for `'openrouter'`
  - Cloud sync contract: `UserSettingsRow` extended with `openrouter_api_key: string | null`, `enable_openrouter: boolean`; all 4 functions (`upsertUserSettings`, `fetchUserSettings` → `applyUserSettingsToStore`, `settingsRowFromStore`, `parseAiPriority`) updated; `flushOutbox` passthrough includes `openrouter_api_key` and `enable_openrouter`

- **conventions:** OpenRouter service MUST mirror `src/services/groqService.ts` structure (module-level `let` for `apiKey`/`enabled`/`configured`, env-var auto-config via `VITE_OPENROUTER_API_KEY`, exported singleton with `isConfigured`/`isEnabled`/`model` getters, `setEnabled`/`configure`/`disconnect`/`generateContent`/`testConnection` methods). SettingsScreen OpenRouter section MUST mirror Groq section (same Card structure, toggle switch pattern, test button with Loader2 spinner, Badge for configured status).

- **acceptance:**
  - AC-01: Settings shows OpenRouter section with API key input (password field), enable toggle (default on), status badge (Đã cấu hình / Chưa cấu hình), Lưu/Kiểm tra/Xóa buttons
  - AC-02: Saving a valid OpenRouter API key persists to localStorage (Zustand persist) and syncs to Supabase cloud when online
  - AC-03: Toggling OpenRouter off removes it from cascade; toggling on restores it
  - AC-04: Test connection button calls OpenRouter API with 4-model fallback, shows success toast with model name or error detail
  - AC-05: AI chat uses OpenRouter when it is in the cascade priority order, configured, enabled, and online
  - AC-06: If model 1 fails (rate-limit, 429, or error), the service tries model 2 → 3 → 4, returning null only if all fail
  - AC-07: Clearing API key removes OpenRouter from cascade and shows "Chưa cấu hình" badge
  - AC-08: OpenRouter appears in the AI priority drag-to-reorder list (Settings) only when configured and enabled
  - AC-09: Build (`npx tsc --noEmit`) and typecheck pass with zero errors
  - AC-10: No regression — existing Groq, Gemini, Kilo, WebLLM providers still work

- **verify:**
  ```
  cd . && npx tsc --noEmit
  cd . && npx vite build
  ```

- **done-when:** Both verify commands exit 0 AND OpenRouter section renders in Settings, key save persists across refresh, toggle works, test connection returns success, AI chat routes through OpenRouter when it's the first available in priority order.

## Execution Sequence

Single wave (Wave 1), one developer.

```
WO-openrouter-provider
```

Execution order within the task:
1. `llmTypes.ts` — type registration (other files import from here)
2. `openRouterService.ts` — service implementation (NEW)
3. `llmCall.ts` + `aiRouter.ts` — cascade + routing integration
4. `authStore.ts` — state persistence + service sync
5. `userSettingsService.ts` + `syncEngine.ts` — cloud sync schema
6. `SettingsScreen.tsx` — UI (imports everything above)

## Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenRouter free models change names/availability | Medium | Low — service breaks silently, cascade falls through | `console.warn` on all failures; cascade is designed for graceful degradation |
| OpenRouter `:free` suffix convention changes | Low | Low — same as above | Check OpenRouter docs if test connection fails unexpectedly |

## Developer Guidance

- Open `src/services/groqService.ts` — this is the EXACT template for `openRouterService.ts`; replicate its structure, method signatures, error handling, and export shape
- The 4 free models with `:free` suffix are from OpenRouter's free-tier catalog as of 2026-08: start with `google/gemini-2.0-flash-001:free` (fastest), fall through `meta-llama/llama-4-maverick:free`, `qwen/qwen3-8b:free`, `deepseek/deepseek-chat-v3-0324:free`
- OpenRouter requires `HTTP-Referer` and `X-Title` headers (polite use); set Referer to `window.location.origin` and X-Title to `'Quản Lý Thu Chi'`
- The `llmTypes.ts` file MUST have zero imports (circular-dependency constraint documented in its header); only `LlmSource`, `AI_PRIORITY_DEFAULT`, `LLM_SOURCE_LABELS` are modified
- SettingsScreen's OpenRouter section goes immediately after the Groq section (`<section aria-label="Groq AI settings">` block ends around line ~695), following the same Card/header/badge/input/toggle/buttons pattern

## Open Execution Questions

None — all implementation details are resolved by mirroring the Groq pattern.

## Execution Readiness Verdict

**Pass.** The 8 files are scoped, contracts are defined, and the single work order is independently executable. The Groq pattern provides a verified template for every change.
