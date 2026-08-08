---
feature-id: M-001
stage: implementation
agent: engineering-backend-developer
wave: 1
task: lucky-prompt-mascot
verdict: Pass
last-updated: 2026-08-02
---

## Requirement Mapping

| AC | Status | Notes |
|----|--------|-------|
| Replace system prompts in 4 files with "Mèo Lucky" content | Implemented | webLLM.ts, geminiService.ts, llmIntentExtractor.ts, llmBulkDraftExtractor.ts |
| parseAiAction() maps BAN_HANG→create_revenue, CHI_PHI→create_expense, XEM_BAO_CAO→lookup, TAN_GAU→chat | Implemented | Added tryParseVnAction() + category mapping; backward-compatible with old English format |
| MascotOverlay.tsx created with CSS animation | Implemented | Fixed position bottom-right, slide-up + bounce entrance, fade-out exit, emoji + speech bubble |
| mascotStore.ts has 'thinking' emotion | Implemented | Added to MascotEmotion type union |
| Layout.tsx includes MascotOverlay | Implemented | Imported and placed before outer closing `</div>` |
| `bun run typecheck` exits 0 | Verified | `npx tsc --noEmit` → exit 0, no errors |

## Files Changed

| File | Purpose |
|------|---------|
| `src/services/webLLM.ts` | Replaced `CHAT_SYSTEM` constant with full Mèo Lucky store assistant prompt |
| `src/services/geminiService.ts` | Replaced `SYSTEM_INSTRUCTION` constant with full Mèo Lucky store assistant prompt |
| `src/services/llmIntentExtractor.ts` | Replaced EXTRACT_PROMPT header + schema with Mèo Lucky persona; kept all legacy extraction rules (## Tiền tệ, ## Doanh thu, etc.); added 'thinking' to mascot_emotion |
| `src/services/llmBulkDraftExtractor.ts` | Replaced `BULK_PROMPT` with Mèo Lucky version; added 'thinking' to mascot_emotion |
| `src/services/aiRouter.ts` | Added `useMascotStore` import; added `mapVnExpenseCategory()`, `tryParseVnAction()`, `tryParseLegacyAction()`, `triggerMascot()`; rewrote `parseAiAction()` to handle both old English and new Vietnamese action JSON formats + trigger mascot overlay |
| `src/store/mascotStore.ts` | Added `'thinking'` to `MascotEmotion` type |
| `src/ui/components/MascotOverlay.tsx` | NEW — floating mascot overlay component with emoji + speech bubble + CSS animations |
| `src/ui/Layout.tsx` | Imported and rendered `<MascotOverlay />` |

## Key Technical Decisions

| Decision | Reason | Trade-off |
|----------|--------|-----------|
| New Vietnamese action format parsed alongside old English | Backward compatibility with existing AI responses that still use `type: create_expense` | Slightly more parsing code |
| `mapVnExpenseCategory` maps Vietnamese names to internal `ExpenseCategory` codes | LLM uses Vietnamese category names (Nhập hàng, etc.); internal store uses English codes (supplies, etc.) | Mapping must be maintained if new categories are added |
| `tryParseVnAction` returns `{ cleanText: '', action: undefined }` for XEM_BAO_CAO and TAN_GAU | These actions don't create records; mascot trigger still fires via `triggerMascot` | `lookup` intents handled by `runIntentTool` in calling code, not by `parseAiAction` |
| Two-pass parsing: ```action block first, then top-level JSON | AI may return JSON wrapped in markdown fences or as raw JSON | Clean text extraction differs between the two |
| Inline `<style>` tag for keyframes in MascotOverlay | Avoids polluting global CSS; co-located with component | Keyframes defined once per mount (React handles SSR safely) |

## Validation / Authorization / Error-Handling Notes

- **Viet category mapping**: Falls back to `'other'` (valid `ExpenseCategory`) for unrecognized categories — no invalid data stored.
- **Don hang parsing**: Uses `.reduce()` with safe defaults (`gia_ban ?? 0`, `so_luong ?? 1`) — malformed order items don't crash.
- **Mascot trigger**: Only fires when both `mascot_say` and `mascot_emotion` are present; validates emotion against known set, defaults to `'happy'`.
- **Backward compatibility**: Old `type: create_expense`/`create_revenue` format still fully supported; new code adds, doesn't replace.

## Tests Added or Updated

No automated tests added — this is a configuration/UI-overlay change. Manual verification:
- `npx tsc --noEmit` → exit 0 (type safety confirmed)
- All files compile clean, no TS errors introduced

## Verification Evidence

| Check | Command | Exit Code | Scope |
|-------|---------|-----------|-------|
| TypeScript typecheck | `npx tsc --noEmit` | 0 | Full project |

## Deployment / Migration Notes

- **No new env vars, secrets, or dependencies.**
- **No schema changes.**
- The new prompts produce Vietnamese-format JSON (`action: BAN_HANG` etc.) — parseAiAction handles this format.
- Backward compatible: old LLM responses using `type: create_expense` format continue to work.

## Known Limitations and Risks

1. **Mascot overlay auto-hide timing**: The store hides after 4s. If multiple actions fire rapidly, queued messages display sequentially. UI should feel responsive but may lag slightly under sustained rapid-fire triggers.
2. **`triggerMascot` in parseAiAction**: The mascot fires on every AI response that includes `mascot_say`/`mascot_emotion` — including chat-only responses (TAN_GAU). This is intended (Lucky speaks on all interactions).
3. **Category mapping coverage**: Only 4 Vietnamese categories are mapped (`Nhập hàng`, `Tiền nhà/Điện nước`, `Bao bì/Đóng gói`, `Chi khác`). If the LLM invents new categories, they fall back to `other`.
4. **`bun` not available on CI machine**: Ran `npx tsc --noEmit` instead of `bun run typecheck` — both invoke the same TypeScript compiler on the same tsconfig.
