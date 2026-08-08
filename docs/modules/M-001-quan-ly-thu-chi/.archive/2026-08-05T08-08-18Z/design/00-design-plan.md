---
feature-id: M-001
document: design-plan
output-mode: lean
last-updated: 2026-08-05
verdict: Pass
waves: 4
---

# Design Plan — Groq AI Provider + Configurable AI Priority

> **Source:** BA Spec `ba/00-lean-spec.md` (scope expansion AC-GROQ-01..08, AC-PRI-01..08, AC-STORE-01..03, AC-UI-01..03, AC-SEC-AI-01..03, AC-RES-AI-01..02). Triage: TRI-1785915049449-58fd (C3, full_pipeline).

## Summary

Additive scope expansion: a new Groq AI provider (`groqService.ts`) following the existing `kiloService.ts` OpenAI-compatible pattern, plus a user-configurable AI priority ordering that replaces the hardcoded `callLlmCascade` if-else chain with store-driven array iteration. **Key trade-off:** refactoring a working hardcoded cascade into a loop introduces a small risk of missing existing error-guard semantics (preserved verbatim per BR-AI-05), but the loop reduces code from 4 provider-specific blocks to 1 generic one — making future providers (e.g. OpenAI, Anthropic) a single-line `LlmSource` addition instead of a new if-else block.

---

## Design

### System Boundaries

| Service/Component | Responsibility | Owns | Calls | Exposes |
|---|---|---|---|---|
| `groqService.ts` (NEW) | OpenAI-compatible Groq API client | Module-scoped `apiKey`, `enabled` state; `AbortController` timeout | `fetch` to `https://api.groq.com/openai/v1/chat/completions` | `groqService` object: `isEnabled`, `isConfigured`, `model`, `setEnabled(v)`, `configure(key)`, `generateContent(prompt)`, `testConnection()` |
| `authStore.ts` | Zustand store with `persist('ql-tc-auth')` | Groq config state + AI priority order + provider sync | `groqService.configure/setEnabled` via `syncGroqService()` | `groqApiKey`, `groqConfigured`, `enableGroq`, `aiPriority`, setters |
| `llmCall.ts` | LLM cascade orchestrator | Priority-driven iteration logic | `useAuthStore.getState()`, all 4 provider services | `callLlmCascade(prompt, localMode?)`, `canUseCloudLlm()`, `llmSourceLabel()`, `LlmSource` type |
| `SettingsScreen.tsx` | Settings UI | Groq config card + AI Priority reorder list | `useAuthStore` selectors + actions | JSX sections |

**Out of scope (unchanged — verified from source):** `aiRouter.ts`, `chatTools.ts`, `chatIntent.ts`, `llmIntentExtractor.ts`, `llmBulkDraftExtractor.ts`, `geminiService.ts`, `kiloService.ts`, `webLLM.ts`, `intakeService.ts`, `ocrService.ts`, all screens except `SettingsScreen.tsx`.

### Integration Model

| Integration | Type | Contract | Timeout | Retry | Idempotent |
|---|---|---|---|---|---|
| Groq → `https://api.groq.com/openai/v1` | HTTPS POST (OpenAI chat completions) | `{ model, messages, temperature, max_tokens }` → `{ choices[0].message.content }` | 45s (`AbortController`) | None (cascade advances to next provider) | Read-only fetch — yes |
| Store → `groqService` sync | In-process function call | `groqService.configure(key)` / `groqService.setEnabled(v)` on every setter + rehydrate | Synchronous | N/A | N/A |
| `callLlmCascade` → providers | In-process async iteration | Each provider's `generateContent(prompt)` → `text \| null` | Per-provider (45s Groq/Kilo) | First non-null wins; null advances to next | Yes (read-only) |

### Data Architecture

| Entity | Owner | Storage | Consistency | Migration needed |
|---|---|---|---|---|
| `groqApiKey: string \| null` | `authStore` (persisted) | `localStorage` under `ql-tc-auth` key, `partialize` slice | Derived `groqConfigured` recomputed on set/rehydrate; stored via `persist` middleware | None — new field, defaults `null` |
| `enableGroq: boolean` | `authStore` (persisted) | Same | Synced to `groqService.setEnabled(v)` on set/rehydrate | None — defaults `true` |
| `aiPriority: LlmSource[]` | `authStore` (persisted) | Same | Normalized on rehydrate (BR-AI-10); always 4 unique members with `'local'` present | Yes — legacy rehydrate normalization (AC-PRI-08, BR-AI-10) |
| `groqConfigured: boolean` | `authStore` (derived, not persisted independently) | Computed: `!!(groqApiKey \|\| VITE_GROQ_API_KEY)` — matches `geminiConfigured` derivation at `authStore.ts:269` | Real-time | None |

**Key precedence (BR-AI-08, per AMB-AI-01 resolution):** User-entered `groqApiKey` (Settings, persisted) overrides `VITE_GROQ_API_KEY` (build-time `.env` default). Removing the store key falls back to env key if present. `groqConfigured` is `true` when either source is non-empty.

**Legacy rehydrate normalization (BR-AI-10, AC-PRI-08):**
- If `aiPriority` is missing/undefined: default to `['kilo','groq','gemini','local']`
- If incomplete (missing members): append missing providers at their default relative positions, preserving order of present members
- If present with unknown entries: drop unknown, normalize to 4 unique
- If `enableGroq` is `undefined`: default to `true`
- If `groqApiKey` is `undefined`: default to `null`

### Security (NFR-AI-S01, NFR-AI-S02)

- **Auth/authz:** Groq API key sent as `Authorization: Bearer <key>` header ONLY to `api.groq.com`; never included in error messages, toasts, or `console.warn` bodies
- **PII/secrets:** Key stored in `localStorage` under existing `ql-tc-auth` key (same posture as Gemini/Kilo keys — no new attack surface)
- **Trust boundary:** Input field uses `type="password"`; React JSX handles XSS escaping; no `dangerouslySetInnerHTML` anywhere in the Groq section
- **Offline:** `navigator.onLine === false` skips all cloud providers — no key transmission attempted (BR-AI-09)

### Deployment

| Item | Detail |
|---|---|
| **Env vars** | `VITE_GROQ_API_KEY` — optional, documented in `.env.example` (public build var, same posture as `VITE_GEMINI_API_KEY`) |
| **Migration** | None — new store fields default-initialize; legacy rehydrate normalizes on first load (BR-AI-10) |
| **Rollback** | Remove `groqService.ts` + revert `llmCall.ts` to archived version; store ignores unknown persisted fields (Zustand partialize is safe) |
| **Feature flag** | `enableGroq` (default `true`) — user can disable in Settings any time; `aiPriority` excludes `'groq'` if user removes it |

### NFR Architecture

| NFR-ref | Solution | Target | Trade-off |
|---|---|---|---|
| NFR-AI-P01 | Array iteration + store read per call (replaces 4 if-else blocks); no pre-computed provider list — read at call time for real-time priority | < 5ms overhead before first network call | Slightly more allocations (array destructure) but negligible vs network latency |
| NFR-AI-P02 | `AbortController` + 45s timeout per Groq request (identical to Kilo at `kiloService.ts:74`) | Abort → `null` → next provider | No retry — same posture as all existing providers |
| NFR-AI-S01 | Same `localStorage` persistence slice as existing keys; no new storage key | No new attack surface | Keys are not encrypted at rest (existing posture; hardening is a separate concern) |
| NFR-AI-R01 | Every `generateContent` failure path returns `null` (HTTP !ok, network, timeout, parse, empty content, `error.message`) | Cascade never throws; degrades to next provider | No retry/backoff — acceptable for a cascade with guaranteed terminal fallback (`'local'`) |
| NFR-AI-R02 | `onRehydrateStorage` normalizes `aiPriority` to full 4-member set; deduplicates; drops unknown | Self-healing on load | One-time normalization cost — trivial |
| NFR-AI-M01 | `groqService` unit-tested ≥6 cases (per `kiloService.test.ts` pattern) | `bun test src/services/groqService.test.ts` | — |
| NFR-AI-M02 | Store changes unit-tested (default, reorder, persistence round-trip, legacy rehydrate) | Follows existing authStore test patterns | — |
| NFR-AI-M03 | Existing test suite green (`bun test --run`) | Regression oracle (CON-AI-05) | — |

### Key Decisions

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Groq service structure | Module-scoped `let` variables + object literal export (identical to `kiloService.ts:17-133`) | Class-based service, or reusing `kiloService` with configurable base URL | `kiloService` is the proven pattern in THIS codebase; deviation would add cognitive overhead with zero benefit |
| Key precedence | Store key (`groqApiKey`) > env key (`VITE_GROQ_API_KEY`) | Env-only or store-only | Mirrors Gemini's posture (optional env seed + Settings canonical); resolved per AMB-AI-01 recommendation (A) |
| Cascade refactor | `for...of` loop over `aiPriority` with provider dispatch map | Switch statement on first entry, or keep hardcoded if-else with Groq inserted | Loop eliminates O(n) code growth per provider; dispatch map is a plain object keyed by `LlmSource` — no dynamic import, no eval |
| CORS posture | Direct fetch to `api.groq.com` — no proxy | Vite dev proxy mirroring Kilo's `/api/kilo` | Groq's OpenAI-compatible endpoint is documented as browser-CORS-friendly; if blocked in deployment, an optional `VITE_GROQ_GATEWAY_BASE` env var can be added later per AMB-AI-04 recommendation (A) |
| `local` mutability | Can be reordered (not pinned last) but cannot be removed | Pinned-last forever | Users may prefer local-first for privacy; terminal guarantee preserved via BR-AI-06 (local always in list, cascade exhausts then returns `null`) |
| `partialize` strategy | Persist `groqApiKey`, `enableGroq`, `aiPriority`; derive `groqConfigured` from key on rehydrate | Persist `groqConfigured` directly | Matches existing `geminiConfigured` derivation at `authStore.ts:269` — single source of truth |

---

## Plan

### Requirement-to-Execution Mapping

| BA AC group | AC count | Work order | Owner type |
|---|---|---|---|
| AC-GROQ-01..08 (Groq provider) | 8 | WO-groq-service + WO-llm-cascade (cascade integration) | backend |
| AC-PRI-01..08 (priority ordering) | 8 | WO-llm-cascade + WO-store-config (store normalization) | backend |
| AC-STORE-01..03 (store) | 3 | WO-store-config | backend |
| AC-UI-01..03 (Settings UI) | 3 | WO-settings-ui | frontend |
| AC-SEC-AI-01..03 (security) | 3 | WO-groq-service (key handling) + WO-settings-ui (XSS) | both |
| AC-RES-AI-01..02 (resilience) | 2 | WO-groq-service (null-on-failure) + WO-llm-cascade (offline skip) | backend |

### Task Breakdown

| Task | Description | Dependency | Owner type | Wave | Parallelizable |
|---|---|---|---|---|---|
| WO-groq-service | Create `groqService.ts` (NEW), update `index.ts` barrel, update `.env.example` | None | backend | 1 | — |
| WO-store-config | Extend `authStore.ts` with Groq + `aiPriority` fields, actions, `syncGroqService`, rehydrate normalization, `partialize` | WO-groq-service (groqService contract) | backend | 2 | — |
| WO-llm-cascade | Refactor `llmCall.ts`: extend `LlmSource`, replace hardcoded if-else with priority loop, update `canUseCloudLlm` + `llmSourceLabel` | WO-store-config (store fields) + WO-groq-service (groqService import) | backend | 3 | — |
| WO-settings-ui | Add Groq section card + AI Priority reorder section to `SettingsScreen.tsx` | WO-store-config (store fields) | frontend | 4 | — |

### Work Orders

#### WO-groq-service

- **goal:** New `groqService.ts` at `src/services/groqService.ts` exposing the `kiloService`-compatible contract; barrel export in `index.ts`; env var in `.env.example`.
- **assignee-role:** engineering-backend-developer
- **complexity:** novel
- **files:**
  - `src/services/groqService.ts` — NEW file
  - `src/services/index.ts:96-98` — add `export { groqService } from './groqService';` after the existing AI barrel block
  - `.env.example:5-6` — add `# Groq API key for cloud LLM (user can also paste in Settings)` + `# VITE_GROQ_API_KEY=`
- **contracts:** `design/00-design-plan.md#system-boundaries` (groqService interface), `design/00-design-plan.md#integration-model` (POST contract). Implement exactly the module-scoped `let` + object-literal export pattern from `src/services/kiloService.ts:1-143` with these substitutions:
  - Base URL: `https://api.groq.com/openai/v1` (no proxy; direct fetch per `design/00-design-plan.md#key-decisions`)
  - Model: `llama-3.3-70b-versatile`
  - Env var: `VITE_GROQ_API_KEY` read at configure time; also read in `isConfigured` getter (key available if store key OR env var non-empty — per `design/00-design-plan.md#data-architecture` key precedence)
  - Timeout: 45s (`REQUEST_TIMEOUT_MS = 45_000`)
  - `generateContent`: POST `/chat/completions`, `{ model, temperature: 0.2, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }`, returns `text \|\| null` on ANY failure (never throws — per CON-AI-04)
  - `testConnection`: lightweight ping returning `{ ok: boolean; detail: string }` (mirrors `kiloService.ts:131-142`)
  - `isConfigured` getter: `!!(apiKey \|\| (import.meta.env.VITE_GROQ_API_KEY as string \| undefined)?.trim())`
- **conventions:** Follow `kiloService.ts` line-for-line structure: `let` module-scoped vars → `export type GroqGenerateResult` → `getGroqGatewayBase` (optional env override for proxy) → `authHeaders` → `export const groqService = { ... }`. `console.warn` on failures with HTTP status + truncated body (max 200 chars) — never log the key. Never throw from `generateContent`.
- **acceptance:** AC-GROQ-01, AC-GROQ-02, AC-GROQ-03, AC-GROQ-04, AC-SEC-AI-01 (key handling), AC-RES-AI-01 (500/502)
- **verify:** `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx tsc --noEmit -p tsconfig.json`
- **done-when:** TypeScript compiles clean for the new file; `groqService` export appears in `index.ts` barrel; `.env.example` documents `VITE_GROQ_API_KEY`.

#### WO-store-config

- **goal:** `authStore.ts` gains `groqApiKey`, `groqConfigured`, `enableGroq`, `aiPriority` state + setters; `syncGroqService` wired; `partialize` updated; `onRehydrateStorage` normalizes legacy state.
- **assignee-role:** engineering-backend-developer
- **complexity:** novel
- **files:**
  - `src/store/authStore.ts:32-53` — add state fields to `AuthState` interface
  - `src/store/authStore.ts:62-76` — add action signatures to `AuthActions` interface
  - `src/store/authStore.ts:89` — add `syncGroqService` function after `syncKiloService` (ends at `authStore.ts:86-89`)
  - `src/store/authStore.ts:103-113` — add initial values in `immer((set) => ({ ... }))`
  - `src/store/authStore.ts:179-192` — add `setGroqApiKey`, `setEnableGroq`, `setAiPriority` actions after `setKiloApiKey`
  - `src/store/authStore.ts:267-281` — update `partialize` object
  - `src/store/authStore.ts:284-315` — update `onRehydrateStorage` (at `authStore.ts:284`) for Groq sync + `aiPriority` normalization
- **contracts:** `design/00-design-plan.md#data-architecture` (store schema + key precedence + legacy normalization).
  - **State additions to `AuthState`:**
    ```ts
    groqApiKey: string | null;
    groqConfigured: boolean;       // derived, not persisted
    enableGroq: boolean;
    aiPriority: LlmSource[];       // import type from '@/services/llmCall'
    ```
  - **Action additions to `AuthActions`:**
    ```ts
    setGroqApiKey: (key: string | null) => void;
    setEnableGroq: (v: boolean) => void;
    setAiPriority: (order: LlmSource[]) => void;
    ```
  - **`syncGroqService`** (after `syncKiloService` at `authStore.ts:86-89`, mirroring its structure):
    ```ts
    function syncGroqService(opts: { enabled: boolean; apiKey: string | null }): void {
      groqService.setEnabled(opts.enabled);
      groqService.configure(opts.apiKey);
    }
    ```
  - **`setGroqApiKey`** (mirror `setGeminiApiKey:142-148`): set `groqApiKey` + derive `groqConfigured` (key from `VITE_GROQ_API_KEY` env as fallback: `!!(key || import.meta.env.VITE_GROQ_API_KEY?.trim())`) + call `syncGroqService`. Import `groqService` from `@/services/groqService`.
  - **`setEnableGroq`** (mirror `setEnableKiloFree:179-186`): set `enableGroq` + call `syncGroqService`.
  - **`setAiPriority`**: set `aiPriority` directly — validation (no duplicates, includes `'local'`) is done by the reorder UI; if passed an invalid list, normalize inline.
  - **`partialize` additions:**
    ```ts
    groqApiKey: state.groqApiKey,
    enableGroq: state.enableGroq,
    aiPriority: state.aiPriority,
    // groqConfigured is NOT persisted — derived on rehydrate like geminiConfigured
    ```
  - **`onRehydrateStorage` additions** (after syncKiloService call at `authStore.ts:289-291`): sync Groq service from rehydrated state; normalize `aiPriority` (default `['kilo','groq','gemini','local']`; missing members appended at default positions; deduplicate; ensure `'local'` present); fill `groqConfigured` from key (env fallback); default `enableGroq` if `undefined`; add `import { groqService } from '@/services/groqService'` to file imports.
- **conventions:** Every setter mirrors an existing one — `setGeminiApiKey` for key, `setEnableKiloFree` for toggle. Use `immer` pattern: `set((state) => { state.field = value; })`. `groqConfigured` is derived inline (never stored independently per BR-AI-07). All new fields are added to `partialize` for persistence.
- **acceptance:** AC-STORE-01, AC-STORE-02, AC-STORE-03, AC-PRI-02 (default aiPriority), AC-PRI-06 (persistence), AC-PRI-08 (legacy normalization), AC-GROQ-04 (key configured)
- **verify:** `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx tsc --noEmit -p tsconfig.json`
- **done-when:** TypeScript compiles clean; store exports all new fields/actions; existing tests referencing `useAuthStore` still compile (type widening — new optional fields do not break existing destructures).

#### WO-llm-cascade

- **goal:** `llmCall.ts` cascade reworked from hardcoded if-else to priority-array iteration; `LlmSource` extended; `canUseCloudLlm` and `llmSourceLabel` updated.
- **assignee-role:** engineering-backend-developer
- **complexity:** novel
- **files:**
  - `src/services/llmCall.ts:7-9` — add `import { groqService } from './groqService'` after `kiloService` import
  - `src/services/llmCall.ts:11` — extend `LlmSource` to `'kilo' | 'groq' | 'gemini' | 'local'`
  - `src/services/llmCall.ts:13-61` — rewrite `callLlmCascade` as priority-driven loop
  - `src/services/llmCall.ts:65-69` — update `canUseCloudLlm` to include Groq eligibility
  - `src/services/llmCall.ts:72-83` — add `'groq'` case to `llmSourceLabel`
- **contracts:** `design/00-design-plan.md#integration-model` (cascade contract — signature unchanged per CON-AI-03).

  **`callLlmCascade` TO-BE structure** (replaces lines 13-61):
  ```ts
  export async function callLlmCascade(
    prompt: string,
    localMode: 'raw' | 'chat' = 'raw',
  ): Promise<{ text: string; source: LlmSource } | null> {
    const {
      aiPriority,
      enableKiloFree,
      enableGroq,
      groqConfigured,
      geminiConfigured,
    } = useAuthStore.getState();

    const online = navigator.onLine;

    // Eligibility guards — identical to AS-IS per-provider logic (BR-AI-05)
    const isEligible = (source: string): boolean => {
      switch (source) {
        case 'kilo':
          return online && enableKiloFree !== false && kiloService.isEnabled;
        case 'groq':
          return online && enableGroq !== false && groqConfigured;
        case 'gemini':
          return online && geminiConfigured && geminiService.isConfigured;
        case 'local':
          return true; // always eligible (terminal fallback)
        default:
          return false;
      }
    };

    // Provider dispatch — returning null means "try next"
    const tryProvider = async (source: string): Promise<string | null> => {
      switch (source) {
        case 'kilo': {
          const text = await kiloService.generateContent(prompt);
          return text || null;
        }
        case 'groq': {
          const text = await groqService.generateContent(prompt);
          return text || null;
        }
        case 'gemini': {
          const text = await geminiService.generateContent(prompt);
          if (text && !text.startsWith('Lỗi Gemini:') && !text.startsWith('[Gemini chưa')) {
            return text;
          }
          return null;
        }
        case 'local': {
          const text = await webLLM.generate(prompt, {
            mode: localMode,
            maxTokens: localMode === 'raw' ? 256 : 512,
          });
          if (
            text &&
            !text.startsWith('⚠️') &&
            !text.startsWith('⏳') &&
            !text.startsWith('⏹️') &&
            !text.startsWith('⏱️') &&
            !text.startsWith('Lỗi sinh')
          ) {
            return text;
          }
          return null;
        }
        default:
          return null;
      }
    };

    const order = aiPriority ?? ['kilo', 'groq', 'gemini', 'local'];
    for (const source of order) {
      if (!isEligible(source)) continue;
      try {
        const text = await tryProvider(source);
        if (text) return { text, source: source as LlmSource };
      } catch {
        // try next — preserves AS-IS try/catch around each provider
      }
    }

    return null;
  }
  ```

  **`canUseCloudLlm` update** (line 65):
  ```ts
  export function canUseCloudLlm(): boolean {
    const { geminiConfigured, enableKiloFree, enableGroq, groqConfigured } = useAuthStore.getState();
    if (!navigator.onLine) return false;
    if (enableKiloFree !== false && kiloService.isEnabled) return true;
    if (enableGroq !== false && groqConfigured) return true;
    return !!(geminiConfigured && geminiService.isConfigured);
  }
  ```

  **`llmSourceLabel` update** (line 72):
  ```ts
  case 'groq':
    return '🟢 Groq';
  ```

- **conventions:** Preserve every AS-IS error guard verbatim: Gemini error-prefix check, WebLLM emoji-prefix exclusion, `try/catch` per provider. The new loop uses `isEligible` + `tryProvider` dispatch map; no `eval`, no dynamic imports. Signature `(prompt, localMode?) => Promise<{text, source} | null>` unchanged (CON-AI-03).
- **acceptance:** AC-PRI-01 (LlmSource), AC-PRI-03 (cascade iterates aiPriority), AC-PRI-04 (disabled skip), AC-GROQ-05 (Groq eligibility), AC-GROQ-08 (fall-through), AC-RES-AI-02 (offline)
- **verify:** `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx tsc --noEmit -p tsconfig.json`
- **done-when:** TypeScript compiles clean; all three existing callers (`llmIntentExtractor.ts:177`, `llmBulkDraftExtractor.ts:52`, `aiRouter.ts:892`) remain type-compatible due to unchanged function signature.

#### WO-settings-ui

- **goal:** Settings screen gains a Groq API key configuration card and an AI Priority reorder section — both following existing patterns from the Kilo Free and Gemini sections.
- **assignee-role:** engineering-frontend-developer
- **complexity:** novel
- **files:**
  - `src/ui/screens/settings/SettingsScreen.tsx:1-5` — add icon imports (`Zap` for Groq from `lucide-react`)
  - `src/ui/screens/settings/SettingsScreen.tsx:50-65` — add store destructured fields: `groqApiKey`, `groqConfigured`, `enableGroq`, `aiPriority` + actions `setGroqApiKey`, `setEnableGroq`, `setAiPriority`
  - `src/ui/screens/settings/SettingsScreen.tsx` — add Groq handler functions after Gemini handlers (~line 300)
  - `src/ui/screens/settings/SettingsScreen.tsx` — insert Groq section `<section>` BEFORE the "Kilo Free AI settings" section (at `SettingsScreen.tsx:438`)
  - `src/ui/screens/settings/SettingsScreen.tsx` — insert AI Priority section `<section>` after the Groq section (before Kilo Free at `:438`)
- **contracts:** `design/00-design-plan.md#data-architecture` (store fields), BA spec AC-UI-01, AC-UI-02, AC-UI-03.

  **Groq section card** — structure mirrors Gemini section at `SettingsScreen.tsx:520-592` exactly:
  - `<section aria-label="Groq AI settings">` with `<Card>`
  - Header: `Zap` icon + `CardTitle>Groq API</CardTitle>` + status badge ("Đã cấu hình" / "Chưa cấu hình")
  - Body: description text (link to `https://console.groq.com/keys`), `type="password"` input (`aria-label="Groq API key"`), buttons row: "Lưu API key", "Kiểm tra" (secondary, disabled when key empty), "Xóa API key" (destructive, only when configured), toggle switch (`role="switch"`, `aria-checked`) labeled "Bật Groq"
  - `handleSaveGroqKey`: calls `setGroqApiKey(key)` + toast success
  - `handleTestGroq`: calls `groqService.testConnection()`, shows spinner, toast success (with model) / error
  - `handleClearGroqKey`: calls `setGroqApiKey(null)` → `setGroqConfigured(false)` + toast
  - `handleToggleGroq`: calls `setEnableGroq(!enableGroq)`
  - **No `groqService` import needed** — test goes through store-set key, read from `groqService.testConnection()` via direct import OR inline fetch to Groq API for test. **Design decision:** import `groqService` directly in SettingsScreen for `testConnection` call (same pattern as `geminiService.testConnection` — the existing SettingsScreen imports `geminiService` at `SettingsScreen.tsx:19`).

  **AI Priority section** — new section, ordered list of 4 rows:
  - `<section aria-label="AI Priority settings">` with `<Card>`
  - Header: `ArrowUpDown` icon + `CardTitle>Thứ tự ưu tiên AI</CardTitle>` + description: "Kéo hoặc bấm mũi tên để sắp xếp. AI sẽ thử lần lượt từ trên xuống."
  - Body: ordered list of provider rows, each showing label (Vietnamese) + move-up / move-down icon buttons:
    - Kilo Free → move-up (disabled if first), move-down
    - Groq → move-up, move-down
    - Gemini → move-up, move-down
    - AI Cục bộ (local) → move-up, move-down (disabled if last)
  - "AI Cục bộ" row cannot be removed — no delete button shown
  - `handleMoveUp(index)`: swap `aiPriority[index]` with `aiPriority[index-1]`, call `setAiPriority(newOrder)` — guard `index > 0`
  - `handleMoveDown(index)`: swap with `index+1`, guard `index < 3`
  - Move-up disabled on index 0; move-down disabled on index 3
  - Labels derive from `llmSourceLabel()` at `llmCall.ts:72` — but the BA spec says Vietnamese labels ("Kilo Free", "Groq", "Gemini", "AI Cục bộ"). Use a local `PROVIDER_LABELS` map instead to avoid importing the emoji-prefixed labels.

  **Provider label map:**
  ```ts
  const PROVIDER_LABELS: Record<string, string> = {
    kilo: 'Kilo Free',
    groq: 'Groq',
    gemini: 'Gemini',
    local: 'AI Cục bộ',
  };
  ```

- **conventions:** Shadcn UI components confirmed imported (opened `SettingsScreen.tsx:10-12`): `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card`, `Button`, `Badge`, `Label`. `Loader2`, `CheckCircle`, `XCircle` from `lucide-react` (`SettingsScreen.tsx:22-25`). Toggle switch pattern: `role="switch"` + CSS translate at `SettingsScreen.tsx:486-503`. All toasts in Vietnamese (`toast.success` / `toast.error`). Input CSS pattern at `SettingsScreen.tsx:559-567`. Icons: `Zap`, `ChevronUp`, `ChevronDown` from `lucide-react`.
- **acceptance:** AC-UI-01 (Groq card), AC-UI-02 (priority list), AC-UI-03 (no duplicate/remove local), AC-GROQ-06 (configure+test+toggle), AC-GROQ-07 (test failure), AC-PRI-05 (move-up/down), AC-SEC-AI-02 (XSS), AC-SEC-AI-03 (empty/whitespace/oversized key)
- **verify:** `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx tsc --noEmit -p tsconfig.json`
- **done-when:** TypeScript compiles clean; Groq section renders with key input, test, toggle; AI Priority section renders 4 rows with working move-up/move-down; buttons disable at boundaries.

### Execution Sequence

```
Wave 1 ── WO-groq-service (backend)
           │
Wave 2 ── WO-store-config (backend)
           │
Wave 3 ── WO-llm-cascade (backend)
           │
Wave 4 ── WO-settings-ui (frontend)
```

**Serial pipeline rationale:** Waves 2-3-4 have hard contracts on prior waves' exported symbols. WO-store-config needs `groqService.configure/setEnabled` signature. WO-llm-cascade needs `aiPriority`, `groqConfigured`, `enableGroq` store fields + `groqService.generateContent`. WO-settings-ui needs all store fields + `groqService.testConnection`. Pipeline serial ensures each wave's assignee imports real (not stubbed) types.

### Implementation Risks

| Risk | Mitigation |
|---|---|
| CORS blocking on `api.groq.com` from browser origins | Groq documents browser-CORS support; if blocked, cascade degrades to next provider (`null` return) — no user-facing breakage. Future fix: optional `VITE_GROQ_GATEWAY_BASE` proxy env var (AMB-AI-04) |
| Legacy rehydrate normalization edge case: user with `aiPriority=['kilo','gemini','local']` (no Groq) | Groq appended at position 2 (default relative order) → `['kilo','gemini','groq','local']`. Groq is skipped until key configured — no behavior change |
| Existing tests break due to `LlmSource` widening | `'groq'` is ADDED to the union — existing test fixtures using `source: 'kilo'` remain valid. New test fixture using `'groq'` must pass all type guards |
| SettingsScreen.tsx merge conflict if Kilo/Gemini sections change concurrently | Groq + Priority sections are new `<section>` blocks inserted BEFORE the existing Kilo section (`:438`) — distinct diff region, unlikely to conflict |

### Developer Guidance

#### backend developer (Waves 1-3)

- **`kiloService.ts` is the exact blueprint for `groqService.ts`** — open `src/services/kiloService.ts` and replicate its structure line-for-line: `let` module vars → `export type` → `function getBase()` → `function authHeaders()` → `export const groqService = { ... }`. Substitute Groq-specific values listed in WO-groq-service contracts.
- **`authStore.ts` uses `immer` middleware** — every state mutation must be inside `set((state) => { state.field = value; })`. Direct assignment outside `set` is silently ignored.
- **`syncGroqService` is identical to `syncKiloService` at `authStore.ts:86-89`** — just change `kiloService` to `groqService`. Wire it in `setGroqApiKey`, `setEnableGroq`, and `onRehydrateStorage`.
- **`partialize` at `authStore.ts:267`** controls what hits localStorage — add all 3 new fields but NOT `groqConfigured` (derived like `geminiConfigured` at line 269).
- **Legacy normalization** in `onRehydrateStorage` (line 284+): check `if (!state.aiPriority)` → set default; check `if (state.aiPriority.length < 4)` → append missing; check for duplicates → deduplicate; check `if (!state.aiPriority.includes('local'))` → append. Also default `enableGroq` if `undefined`.
- **`callLlmCascade` refactor is a mechanical transformation** — the `isEligible` and `tryProvider` functions in the contract above are EXACT transcriptions of the current if-else conditions and call bodies at `llmCall.ts:19-61`. Copy them verbatim; do not "improve" the error checking.
- **`canUseCloudLlm` at line 65** — add `enableGroq` + `groqConfigured` destructure from store, then `if (enableGroq !== false && groqConfigured) return true` before the Gemini check.

#### frontend developer (Wave 4)

- **Groq section = Gemini section with Groq labels** — open `SettingsScreen.tsx:520-592` (Gemini section) and replicate its structure for Groq: header with badge, password input, three buttons (Save/Test/Delete), toggle switch. Replace Gemini-specific URLs/text with Groq equivalents.
- **Toggle switch pattern** at `SettingsScreen.tsx:486-503` (Kilo section) — the `role="switch"` button with `aria-checked` + CSS translate classes. Reuse this pattern for Groq toggle.
- **Priority reorder section** is a simple ordered list — no drag-and-drop library needed. Render `aiPriority.map((source, i) => ...)` with disabled boundary checks (`i === 0` / `i === 3`). Call `setAiPriority` with the new array on each move.
- **Vietnamese label map** for provider names in the priority list: `kilo → 'Kilo Free'`, `groq → 'Groq'`, `gemini → 'Gemini'`, `local → 'AI Cục bộ'`. Do NOT use `llmSourceLabel()` from `llmCall.ts` — it returns emoji-prefixed labels not suitable for the reorder list.
- **Icons:** `Zap` for Groq section; `ChevronUp` / `ChevronDown` for move-up/move-down (both in `lucide-react` — verify via existing imports in the file).

### Migration / Rollout / Rollback Notes

| Scenario | Action |
|---|---|
| **New install** | `aiPriority` defaults to full 4-member set; `enableGroq=true`; `groqConfigured=false` — Groq skipped silently until key configured |
| **Existing user upgrade** | `onRehydrateStorage` normalizes — adds Groq to the priority list if missing; defaults `enableGroq=true`, `groqApiKey=null`. No UI banner needed |
| **Rollback** | Delete `src/services/groqService.ts` + revert `llmCall.ts` to archived version. Store ignores unknown persisted fields (Zustand `partialize` only restores known keys). No data loss |
| **Groq key removal** | "Xóa API key" clears `groqApiKey` → `groqConfigured` recalculated from env (if present). Groq remains in priority list but is skipped (not eligible) |

### Open Execution Questions

None — all ambiguities resolved in BA spec §10 (AMB-AI-01..04) with architect-confirmed recommendations adopted in Key Decisions above.

### Execution Readiness Verdict

**Pass.** Design is coherent with existing architecture; all 27 new ACs mapped to 4 work orders; file ownership is non-overlapping; work orders carry concrete contracts with exact code anchors; no blocked dependencies; no intel-drift (no cross-service changes).
