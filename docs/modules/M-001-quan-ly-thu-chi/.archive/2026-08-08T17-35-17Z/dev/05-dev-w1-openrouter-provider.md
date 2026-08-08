---
feature-id: M-001
stage: implementation
agent: engineering-backend-developer
wave: 1
task: openrouter-provider
verdict: Blocked
last-updated: 2026-08-08
---

# OpenRouter AI Provider — Implementation Summary

## Requirement Mapping

| AC | Status | Evidence |
|---|---|---|
| AC-01 — Settings shows OpenRouter section | Implemented | `src/ui/screens/settings/SettingsScreen.tsx` — OpenRouter aria-label section added after Groq |
| AC-02 — Key persists to localStorage + syncs to Supabase | Partial | AuthStore persist wired; userSettingsService.ts BLOCKED (see below) |
| AC-03 — Toggle removes/restores from cascade | Implemented | `authStore.ts:setEnableOpenRouter` + `openRouterService.setEnabled()` |
| AC-04 — Test connection with 4-model fallback | Implemented | `openRouterService.ts:testConnection()` iterates MODEL_LIST |
| AC-05 — AI chat uses OpenRouter in priority order | Implemented | `llmCall.ts:tryProvider()` 'openrouter' case; `aiRouter.ts:isCloudSource()` |
| AC-06 — Model fallback 1→2→3→4 | Implemented | `openRouterService.ts:generateContent()` iterates MODEL_LIST on non-200/error |
| AC-07 — Clear key removes from cascade | Implemented | `SettingsScreen.tsx:handleClearOpenRouterKey()` |
| AC-08 — OpenRouter in priority list when configured | Implemented | `availableSources` useMemo includes 'openrouter' case |
| AC-09 — tsc --noEmit pass | **BLOCKED** | 5 errors across 4 unpermissioned files + 1 blocked file |
| AC-10 — No regression | **NOT VERIFIED** | Cannot run full build due to blockers |

## Files Changed

| File | Status | Purpose |
|---|---|---|
| `src/services/openRouterService.ts` | NEW ✅ | OpenRouter API integration with 4-model fallback, mirrors groqService.ts |
| `src/services/llmTypes.ts` | ✅ | Added `'openrouter'` to `LlmSource`, `AI_PRIORITY_DEFAULT`, `LLM_SOURCE_LABELS` |
| `src/services/llmCall.ts` | ✅ | Added `'openrouter'` import + case in `tryProvider()`, updated `canUseCloudLlm()` |
| `src/services/aiRouter.ts` | ✅ | Added `'openrouter'` to `ChatReplySource` type + `isCloudSource()` |
| `src/store/authStore.ts` | ✅ | Added `openRouterApiKey`, `openRouterConfigured`, `enableOpenRouter` state + `setOpenRouterApiKey`/`setEnableOpenRouter` actions + `syncOpenRouterService()` + persist/rehydrate wiring |
| `src/ui/screens/settings/SettingsScreen.tsx` | ✅ | Added OpenRouter section (Card with key input, toggle, test/save/clear), handlers, state, availableSources update |
| `src/services/userSettingsService.ts` | **BLOCKED** | Cannot edit — tool glob matcher doesn't support line-range permission syntax |
| `src/services/syncEngine.ts` | ✅ | Added `openrouter_api_key` + `enable_openrouter` passthrough in `flushOutbox()` |

## Blockers

### BLOCKER-1: userSettingsService.ts cannot be edited

**Root cause:** The permission pattern `*src/services/userSettingsService.ts:15-20,29-35,47-55,82-95` is listed in permitted patterns but the tool glob matcher treats the colon and line-range annotation as part of the filename literal. The file path `src/services/userSettingsService.ts` does not match the glob `*src/services/userSettingsService.ts:15-20,...` because the matcher compares the full pattern including colons and digits.

**Impact:** Cannot add `openrouter_api_key` + `enable_openrouter` fields to `UserSettingsRow`, `parseAiPriority`, `upsertUserSettings`, `applyUserSettingsToStore`, `settingsRowFromStore`. This causes:

```
src/services/syncEngine.ts(44,11): error TS2353: Object literal may only specify known properties,
  and 'openrouter_api_key' does not exist in type 'Partial<UserSettingsRow> & { user_id: string; }'.
```

**Required fix:** Either (a) relax the permission to allow editing the full file, or (b) manually apply the changes described below.

**Required changes for userSettingsService.ts:**
1. Import `openRouterService` after groqService import
2. Add to `UserSettingsRow`: `openrouter_api_key: string | null` + `enable_openrouter: boolean`
3. Add `'openrouter'` to `parseAiPriority` allowed set
4. Add to `upsertUserSettings`: `openrouter_api_key: patch.openrouter_api_key ?? null` + `enable_openrouter: patch.enable_openrouter ?? true`
5. Add to `applyUserSettingsToStore`: `store.setOpenRouterApiKey(row.openrouter_api_key)` + `store.setEnableOpenRouter(row.enable_openrouter !== false)` + `openRouterService.setEnabled(row.enable_openrouter !== false)`
6. Add to `settingsRowFromStore`: `openrouter_api_key: s.openRouterApiKey` + `enable_openrouter: s.enableOpenRouter !== false`

### BLOCKER-2: 4 files with inline union types not in work order or permissions

**Root cause:** The following files define their own inline union types that duplicate `LlmSource`/`ChatReplySource` and need `'openrouter'` added. They are NOT listed in the work order's 8 files and NOT in the edit permissions.

| File | Line | Error |
|---|---|---|
| `src/services/llmBulkDraftExtractor.ts` | 55 | `'openrouter'` not assignable to `'kilo' \| 'groq' \| 'gemini' \| 'local' \| 'cloud'` |
| `src/services/llmIntentExtractor.ts` | 208 | Same union type issue |
| `src/ui/screens/ai/AIChatScreen.tsx` | 89 | `ChatMessage.source` type excludes `'openrouter'` |
| `src/ui/screens/ai/ChatPanel.tsx` | 128 | Same `ChatMessage.source` type issue |

**Typecheck output (5 errors):**
```
src/services/llmBulkDraftExtractor.ts(55,3): error TS2322: Type 'LlmSource' is not assignable to type
  '"kilo" | "groq" | "gemini" | "local" | "cloud"'

src/services/llmIntentExtractor.ts(208,3): error TS2322: Type 'LlmSource' is not assignable to type
  '"kilo" | "groq" | "gemini" | "local" | "cloud"'

src/services/syncEngine.ts(44,11): error TS2353: 'openrouter_api_key' does not exist on type
  'Partial<UserSettingsRow> & { user_id: string; }'

src/ui/screens/ai/AIChatScreen.tsx(89,19): error TS2345: Type 'ChatReplySource' is not assignable to type
  '"kilo" | "groq" | "gemini" | "local" | "tesseract" | "cloud" | undefined'

src/ui/screens/ai/ChatPanel.tsx(128,19): error TS2345: Same ChatReplySource type mismatch
```

## Key Technical Decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Mirror groqService.ts exactly | Proven pattern, each provider has different quirks | Each service is ~120 lines of near-duplicate code; acceptable at 3 providers |
| 4-model fallback within generateContent() | OpenRouter free models have per-model rate limits | User sees first successful model, not which one was used |
| Cascade position: Kilo → OpenRouter → Groq → Gemini → WebLLM | Kilo is no-key; OpenRouter needs key but is free-tier | Users who configure OpenRouter get it before key-required Groq |
| `:free` suffix on model IDs | OpenRouter requires `:free` for free-tier routing | Model names may change; service degrades gracefully on failure |

## Verification Evidence

- `npx tsc --noEmit` → **exit code 2** (5 errors — 3 due to blocked files, 2 due to unpermissioned files)
- `npx vite build` → **not run** (typecheck must pass first)

## Tests Added or Updated

None — no test files modified per work order boundaries.

## Deployment / Migration Notes

- New env var: `VITE_OPENROUTER_API_KEY` (optional, developer convenience — same pattern as `VITE_GROQ_API_KEY`)
- No schema migration needed — `user_settings` table already exists with nullable columns
- No new dependencies

## Known Limitations and Risks

- OpenRouter free model names may change — service degrades silently (returns null, cascade falls through)
- `userSettingsService.ts` cloud sync path not yet wired (BLOCKER-1)
- 4 additional files with inline union types need `'openrouter'` added (BLOCKER-2)
