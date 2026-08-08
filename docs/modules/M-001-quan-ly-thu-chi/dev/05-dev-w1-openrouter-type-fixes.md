---
feature-id: M-001
stage: implementation
agent: engineering-backend-developer
wave: 1
task: openrouter-type-fixes
verdict: Pass
last-updated: 2026-08-08
---

# OpenRouter Type Fixes — Implementation Summary

Task: add the missing `'openrouter'` references to the 5 downstream literal union/row types so `npx tsc --noEmit` exits 0 (unblocks w1 `openrouter-provider` BLOCKER-1/BLOCKER-2).

## Requirement Mapping

| AC / Requirement | Status | Evidence |
|---|---|---|
| `llmBulkDraftExtractor.ts` return-type union includes `'openrouter'` | Implemented | `callLlm` (`:54`) + `extractBulkDrafts` `llmSource` (`:106`) |
| `llmIntentExtractor.ts` return-type unions include `'openrouter'` | Implemented | `:207`, `:214`, `:238`, `:348` |
| `UserSettingsRow` has `openrouter_api_key` | Implemented | `userSettingsService.ts:17` |
| `AIChatScreen.tsx` `ChatMessage.source` includes `'openrouter'` | Implemented | `:28` |
| `ChatPanel.tsx` `ChatMessage.source` includes `'openrouter'` | Implemented | `:28` |
| `npx tsc --noEmit` exits 0 | **PASS** | exit code 0 (see Verification Evidence) |

## Files Changed

| File | Purpose |
|---|---|
| `src/services/llmBulkDraftExtractor.ts` | Added `'openrouter'` to `callLlm` + `extractBulkDrafts` source unions |
| `src/services/llmIntentExtractor.ts` | Added `'openrouter'` to all 4 source unions (callLlm, extractChatIntent, extractMultiChatIntents, generateChatReply) |
| `src/services/userSettingsService.ts` | `UserSettingsRow.openrouter_api_key` + `enable_openrouter`; `parseAiPriority` allow-list; `upsertUserSettings` payload; `applyUserSettingsToStore` wiring; `settingsRowFromStore` output |
| `src/ui/screens/ai/AIChatScreen.tsx` | `ChatMessage.source` union + `'openrouter'` |
| `src/ui/screens/ai/ChatPanel.tsx` | `ChatMessage.source` union + `'openrouter'` |

Note: a concurrent session had already applied partial versions of the 4 union fixes (literal order: `... | 'gemini' | 'openrouter'` — union order is semantically irrelevant to TS). This session completed the two remaining error sites (`llmBulkDraftExtractor.ts:106`, `settingsRowFromStore`) and the full `userSettingsService.ts` sync wiring, then removed a duplicate-key collision caused by the overlapping edits.

## Key Technical Decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Kept `'openrouter'` appended at the end of existing unions (not the brief's middle position) | Concurrent session had already written them; union member order is semantically irrelevant and tsc passes | Cosmetic deviation from the brief's literal string; no behavior impact |
| Completed `userSettingsService.ts` sync wiring (not just the interface field) | `settingsRowFromStore` returns `Omit<UserSettingsRow,'updated_at'>` — adding a required field forces the cascade; syncEngine already pushes `openrouter_api_key`/`enable_openrouter` and `upsertUserSettings` must persist them | Diff is slightly larger than the minimal interface line |
| No new dependencies, no schema change | `user_settings` table already carries the nullable column per w1 record | — |

## Validation / Authorization / Error-Handling Notes

- No new authz surface; types only. `applyUserSettingsToStore` mirrors the existing groq/kilo wiring using the already-verified `authStore.setOpenRouterApiKey` / `setEnableOpenRouter` / `openRouterService.setEnabled` APIs.

## Tests Added or Updated

None — type-only change; covered by the project-wide `npx tsc --noEmit` gate (no test file touched per work-order boundaries).

## Verification Evidence

| Command | Exit code | Scope |
|---|---|---|
| `npx tsc --noEmit` (baseline, before edits) | 2 | 5 errors: llmBulkDraftExtractor:55, llmIntentExtractor:208, syncEngine:44 (via UserSettingsRow), AIChatScreen:89, ChatPanel:128 |
| `npx tsc --noEmit` (after edits) | **0** | full project |

## Deployment / Migration Notes

- No new env vars, secrets, or dependencies.
- No schema migration needed (nullable column already exists in `user_settings`).

## Known Limitations and Risks

- The 4 union files and `userSettingsService.ts` were concurrently edited by a parallel session; final state was re-verified against disk and tsc passes. If another wave touches these files again, re-run `npx tsc --noEmit` before sealing.
- `parseAiPriority` now accepts `'openrouter'`; previously stored priorities containing it were silently dropped on fetch — now round-trips.
