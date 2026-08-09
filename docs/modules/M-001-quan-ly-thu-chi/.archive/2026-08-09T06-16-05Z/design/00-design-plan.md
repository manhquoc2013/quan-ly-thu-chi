---
feature-id: M-001
document: design-plan
output-mode: lean
verdict: Pass
waves: 1
---

# Design Plan: SiliconFlow AI Provider

## Summary

Add SiliconFlow as a fifth cloud LLM provider (API: `https://api.siliconflow.cn/v1`) following the OpenRouter pattern exactly — `siliconFlowService.ts` with `generateContent(prompt)` → `fetch` POST `/chat/completions` using the user's SiliconFlow API key, auto-fallback across a model list, and 45s timeout. Integrated into the existing LLM cascade via `llmTypes.ts` union extension, `llmCall.ts` switch case, `aiRouter.ts` `ChatReplySource`, and Settings UI.

## System Boundaries

| Service | Responsibility | Owns | Calls | Exposes |
|---------|---------------|------|-------|---------|
| `siliconFlowService` | SiliconFlow API client — POST `/chat/completions`, auto-model-fallback | API key lifecycle, model list, enable/disable | SiliconFlow API (`api.siliconflow.cn`) | `generateContent(prompt): Promise<string|null>` |
| `llmCall.ts` | LLM cascade router | Priority ordering, provider dispatch | All LLM services | `callLlmCascade()`, `canUseCloudLlm()` |
| `authStore.ts` | State for SiliconFlow API key, enable toggle | `siliconFlowApiKey`, `siliconFlowConfigured`, `enableSiliconFlow` | `siliconFlowService.configure()/disconnect()` | Zustand store actions |
| `SettingsScreen.tsx` | UI for SiliconFlow key input, toggle, test | Key field, enable switch, test/connection | `siliconFlowService.testConnection()` | None (UI only) |

## Integration Model

| Integration | Type | Contract | Timeout | Retry | Idempotent |
|-------------|------|----------|---------|-------|------------|
| App → SiliconFlow API | HTTP POST | OpenAI-compatible `/chat/completions` | 45s per model | 4 free models, iterates on any failure | N/A (chat completions) |

Model list (mirrors OpenRouter's 4-model pattern):
```ts
const SILICONFLOW_MODEL_LIST = [
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen3-8B',
  'THUDM/glm-4-9b-chat',
  'deepseek-ai/DeepSeek-V3',
] as const;
```

SiliconFlow also offers free-tier models (varies; check console). Use the same auto-fallback iteration approach: if a model returns non-200 or API error, try next model in list.

## Data Architecture

| Entity | Owner | Storage | Consistency | Migration |
|--------|-------|---------|-------------|-----------|
| `siliconflow_api_key` | Per-user `user_settings` row (Supabase) | Cloud column (string | null) | Cloud-synced via outbox | **NO** — column likely already exists or will be added as part of the same PR |
| `siliconFlowApiKey` | `authStore` (Zustand) | Local storage cache | Client-side only | None |

## Security

- **API key handling**: Identical to OpenRouter — stored as `string | null` in `authStore`, persisted in localStorage via Zustand `persist`, synced to Supabase `user_settings` table via `queueUserSettingsSync()`, redacted in UI as `type="password"`.
- **Transport**: HTTPS only (`https://api.siliconflow.cn/v1`).
- **Bearer token**: `Authorization: Bearer ${apiKey}` in fetch headers.
- **No PII** beyond what is already sent to any LLM provider (user chat messages).

## Key Decisions

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Implementation pattern | Mirror `openRouterService.ts` exactly | New architecture | C2 change, minimal blast radius |
| Model list | 4 SiliconFlow models | OpenRouter models | SiliconFlow has different model catalog |
| Cascade position | After OpenRouter (index 1 → 4: `['kilo', 'openrouter', 'siliconflow', 'groq', 'gemini', 'local']`) | Before OpenRouter | Same tier, user can reorder in Settings |
| Auto-config from env | Yes (`VITE_SILICONFLOW_API_KEY`) | No | Developer convenience, matches OpenRouter |

## Requirement-to-Execution Mapping

| BA Requirement | Execution Target |
|---------------|-----------------|
| Add SiliconFlow AI provider | `siliconFlowService.ts` (NEW) |
| Integrate into LLM cascade | `llmTypes.ts`, `llmCall.ts`, `aiRouter.ts` |
| Persist API key in user settings | `authStore.ts`, `userSettingsService.ts`, `syncEngine.ts` |
| UI: Settings input + toggle + test | `SettingsScreen.tsx` |
| UI: Source label in chat messages | `AIChatScreen.tsx`, `ChatPanel.tsx` |

## Work Orders

### WO-siliconflow-service

- **goal:** Create `siliconFlowService.ts` mirroring `openRouterService.ts` — API key config, enabled/disabled, `generateContent(prompt)` with 4-model auto-fallback, `testConnection()`.
- **assignee-role:** engineering-backend-developer
- **complexity:** mechanical
- **files:**
  - `src/services/siliconFlowService.ts` — NEW, mirror `openRouterService.ts` with `SILICONFLOW_BASE = 'https://api.siliconflow.cn/v1'` and `SILICONFLOW_MODEL_LIST`
- **contracts:** `design/00-design-plan.md#Integration-Model`
- **verify:** `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx tsc --noEmit src/services/siliconFlowService.ts`
- **done-when:** File compiles with zero errors, exports `siliconFlowService` with same interface as `openRouterService`

### WO-cascade-integration

- **goal:** Register `siliconflow` in the LLM cascade — union type, priority array, switch case, `ChatReplySource`, `canUseCloudLlm()`, source label.
- **assignee-role:** engineering-backend-developer
- **complexity:** mechanical
- **files:**
  - `src/services/llmTypes.ts:9` — add `'siliconflow'` to `LlmSource` union + `AI_PRIORITY_DEFAULT` + `LLM_SOURCE_LABELS`
  - `src/services/llmCall.ts:33` — add `case 'siliconflow':` to `tryProvider()`, import `siliconFlowService`
  - `src/services/llmCall.ts` — `canUseCloudLlm()` — add `enableSiliconFlow !== false && siliconflowConfigured && siliconFlowService.isConfigured` check
  - `src/services/aiRouter.ts:59` — add `'siliconflow'` to `ChatReplySource` union; update `isCloudSource()`
  - `src/services/llmBulkDraftExtractor.ts` — add `'siliconflow'` to `callLlm()` return source type
  - `src/services/llmIntentExtractor.ts` — add `'siliconflow'` to `callLlm()` return source type
- **contracts:** `design/00-design-plan.md#Data-Architecture`
- **verify:** `npx tsc --noEmit`
- **done-when:** All files compile, `llmSourceLabel('siliconflow')` returns a label

### WO-settings-persistence

- **goal:** Wire `siliconflow_api_key` into auth store, user settings service, and sync outbox.
- **assignee-role:** engineering-backend-developer
- **complexity:** mechanical
- **files:**
  - `src/store/authStore.ts:43` — add `siliconFlowApiKey`, `siliconFlowConfigured`, `enableSiliconFlow` state fields + actions + persist + rehydrate
  - `src/services/userSettingsService.ts` — add `siliconflow_api_key` to `UserSettingsRow`, `parseAiPriority` allowed set, `upsertUserSettings`, `applyUserSettingsToStore`, `settingsRowFromStore`
  - `src/services/syncEngine.ts:44` — add `siliconflow_api_key` to flush upsert
- **contracts:** `design/00-design-plan.md#Data-Architecture`
- **verify:** `npx tsc --noEmit`
- **done-when:** Store persists siliconflow key, sync round-trips to cloud

### WO-ui-integration

- **goal:** Add SiliconFlow section to Settings UI and source label to chat screens.
- **assignee-role:** engineering-frontend-developer
- **complexity:** mechanical
- **files:**
  - `src/ui/screens/settings/SettingsScreen.tsx` — import `siliconFlowService`, add `siliconflowKeyInput` state, handleSave/handleTest/handleClear handlers, add Settings section (key input + enable toggle + Save/Test/Clear buttons), add `siliconflow` to `availableSources` filter in `useMemo`
  - `src/ui/screens/ai/AIChatScreen.tsx` — add `'siliconflow'` to `ChatMessage.source` type union
  - `src/ui/screens/ai/ChatPanel.tsx` — add `'siliconflow'` to `ChatMessage.source` type union
- **contracts:** `design/00-design-plan.md#System-Boundaries`
- **verify:** `npx tsc --noEmit`
- **done-when:** Settings screen shows SiliconFlow section, chat messages display SiliconFlow source label

## Execution Sequence

1. **Wave 1** (ALL tasks in parallel — non-overlapping files):
   - WO-siliconflow-service → engineer-backend-developer
   - WO-cascade-integration → engineer-backend-developer (separate task from service)
   - WO-settings-persistence → engineer-backend-developer
   - WO-ui-integration → engineer-frontend-developer

All 4 tasks are independent (different file ownership). Can run in parallel.

## Implementation Risks

| Risk | Mitigation |
|------|-----------|
| Supabase `user_settings` table missing `siliconflow_api_key` column | Developer must add ALTER TABLE migration in same PR (or confirm column exists) |
| Model list outdated | Use current Qwen/GLM/DeepSeek models available on SiliconFlow console |
| CORS from browser | SiliconFlow API may require CORS; if blocked, fallback mirrors OpenRouter pattern (same `fetch` from browser) |

## Developer Guidance

- Open the existing `openRouterService.ts` — every function signature, every pattern, every variable name must be replicated with `siliconFlow` prefix. Do NOT invent new patterns.
- In `llmTypes.ts`, `LlmSource` is a discriminated union with ZERO imports — it MUST stay zero-dependency (used by both `llmCall.ts` and `authStore.ts`).
- The `canUseCloudLlm()` function in `llmCall.ts` determines whether any cloud path is available; siliconflow must be added alongside the existing providers.
- `aiRouter.ts` has `isCloudSource()` that checks if a source is cloud-based — add `siliconflow` there too.
- `parseAiPriority()` in `userSettingsService.ts` validates allowed values — add `'siliconflow'` to the allowed Set.
- Settings sections for Groq and OpenRouter are adjacent in the component; place SiliconFlow section between them (or after Groq, before OpenRouter).

## Migration/Rollout/Rollback Notes

- **Migration:** Add `siliconflow_api_key` column to `user_settings` table if not present (ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
- **Rollback:** Revert PR — all changes are additive, no data migration needed on revert.
- **Feature flag:** None needed — SiliconFlow only activates when user configures an API key and enables the provider.

## Execution Readiness Verdict

All 12 files confirmed present in the workspace. The OpenRouter pattern is fully understood and documented. No unknowns remain. The design is a direct mirror — no novel architecture decisions. Schema migration for `siliconflow_api_key` column in `user_settings` table is part of the developer's PR scope.

<verdict_envelope>
  <verdict>Pass</verdict>
  <confidence>high</confidence>
  <structured_summary>
    <key_findings><item>Design is a direct mirror of openRouterService.ts pattern — siliconFlowService.ts with 4-model auto-fallback, 45s timeout, same API contract (POST /chat/completions to api.siliconflow.cn/v1)</item><item>12 files identified: 1 new (siliconFlowService.ts) + 11 existing modifications across services, store, and UI screens</item><item>4 parallel work orders with non-overlapping file ownership — 3 backend + 1 frontend</item><item>Cascade order: kilo → openrouter → siliconflow → groq → gemini → local (user can reorder in Settings)</item></key_findings>
    <artifacts_produced><item>docs/modules/M-001-quan-ly-thu-chi/design/00-design-plan.md</item></artifacts_produced>
  </structured_summary>
  <blockers></blockers>
</verdict_envelope>
