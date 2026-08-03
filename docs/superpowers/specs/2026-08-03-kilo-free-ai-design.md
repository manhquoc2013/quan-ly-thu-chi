# Kilo Free cloud AI (auto model)

**Date:** 2026-08-03  
**Status:** Implemented  
**Choice:** Online priority = `kilo-auto/free` → Gemini (if key) → WebLLM

## Summary

Integrate [Kilo AI Gateway](https://kilo.ai/docs/gateway) free tier so chat works online without Gemini key. Use virtual model `kilo-auto/free` so Kilo picks the best free model server-side.

## Routing

1. Kilo Free (`enableKiloFree`, default on) when `navigator.onLine`
2. Gemini if API key configured and Kilo fails
3. WebLLM when offline / both clouds fail

## Privacy

Auto Free may route to providers that log prompts (e.g. NVIDIA free endpoints). Settings shows a warning; users should not send secrets.

## Files

- `src/services/kiloService.ts`
- `src/services/llmCall.ts`
- Settings toggle + test button
- `authStore.enableKiloFree`
