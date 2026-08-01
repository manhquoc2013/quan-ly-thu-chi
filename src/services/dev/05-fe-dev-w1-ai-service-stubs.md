# Frontend Implementation Summary — AI Service Stubs

## Designer spec coverage
- **Required UI states**: N/A — these are service stubs (backend layer), no UI layer changes.
- **Validation**: N/A — all methods are stubs returning placeholder responses.
- **Accessibility**: N/A — no UI components involved.
- **Fixes**: N/A — no fixes; this is new infrastructure.

## Component / token mapping
| UI requirement | Existing component/token | Gap | Justification |
|---|---|---|---|
| AI chat routing | `aiService` (existing stub) | New `aiRouterService` | Routes to local WebLLM or cloud Gemini based on availability |
| Gemini cloud AI | `@google/genai` (installed dep) | New `geminiService` | Placeholder for Gemini API integration |
| WebLLM local AI | `@mlc-ai/web-llm` (installed dep) | New `webLLMService` | Placeholder for local model inference |

## Files changed
| Path | Purpose |
|---|---|
| `src/services/aiRouter.ts` | Named export `aiRouterService` — routes requests to WebLLM or Gemini |
| `src/services/geminiService.ts` | Named export `geminiService` — stub for Gemini Cloud AI |
| `src/services/webLLM.ts` | Named export `webLLMService` — stub for WebLLM local model |

## Components created or modified
| Component | New/Modified | States covered | Tests added |
|---|---|---|---|
| `aiRouterService` | New | Stub always returns placeholder | N/A (service stub) |
| `geminiService` | New | Stub always returns placeholder | N/A (service stub) |
| `webLLMService` | New | loading=false, isLoaded=false, generate=placeholder | N/A (service stub) |

## Accessibility compliance
- N/A — no UI components or DOM rendering involved.

## Tests added or updated
- N/A — service stubs follow the same pattern as the existing `aiService.ts` (also stubbed, no tests).
- The project uses vitest (`npm run test`) but no existing service-level tests exist in the codebase.

## Verification evidence
| Check | Command | Exit code | Scope |
|---|---|---|---|
| TypeScript compile | `tsc --noEmit` | 2 (pre-existing errors only) | All files; 0 new errors in my 3 files |
| File existence | `glob` | — | 3 files confirmed at `src/services/{aiRouter,geminiService,webLLM}.ts` |
| Named exports | `grep` | — | `aiRouterService`, `geminiService`, `webLLMService` confirmed |
| Placeholder responses | `grep` | — | All 3 files contain Vietnamese placeholder text |

**Note:** The `tsc --noEmit` exit code 2 is due to pre-existing errors across App.tsx, stores, and UI components — none of which were modified. My 3 files only have `TS6133` (unused parameter) warnings, matching the existing `aiService.ts` stub pattern.

## Known limitations / mismatches
- **All methods are stubs** — no real AI integration yet. The existing `aiService.ts` follows the same stub pattern, so this is consistent.
- **Unused parameter warnings (TS6133)** — all stub methods accept the same parameter signatures as their future real implementations for wiring compatibility. This matches the existing `aiService.ts` exactly.
- **Not barrel-exported** — the files are not yet added to `src/services/index.ts`. This is intentional; they can be imported individually (`import { aiRouterService } from '@/services/aiRouter'`) as needed.
- **No Zustand store integration** — the stubs use plain module-level state (`_isConfigured`, `_isLoaded`, etc.) matching the existing `aiService.ts` pattern.
- **QA probe points**: When wired to real backends, verify: (1) routing logic dispatches correctly to local vs cloud, (2) WebLLM model loading progress is tracked, (3) Gemini API key configuration is validated.

## Dependencies
The project already has `@google/genai` and `@mlc-ai/web-llm` in `package.json` — no new dependencies added.

<verdict_envelope>
  <verdict>Pass</verdict>
  <confidence>high</confidence>
  <structured_summary>
    <key_findings>
      <item>3 stub service files created following existing aiService.ts pattern</item>
      <item>All files have correct named exports (aiRouterService, geminiService, webLLMService)</item>
      <item>0 new TypeScript errors introduced (only TS6133 unused-param warnings, matching existing stub pattern)</item>
      <item>Existing @google/genai and @mlc-ai/web-llm dependencies already present</item>
      <item>No barrel export changes needed — individual imports work</item>
    </key_findings>
    <artifacts_produced>
      <item>src/services/aiRouter.ts</item>
      <item>src/services/geminiService.ts</item>
      <item>src/services/webLLM.ts</item>
    </artifacts_produced>
  </structured_summary>
  <blockers>
  </blockers>
</verdict_envelope>
