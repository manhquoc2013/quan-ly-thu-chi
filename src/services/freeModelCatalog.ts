/**
 * Dynamic free-model catalogs for OpenRouter & SiliconFlow.
 * Refreshes from provider `/models` APIs with TTL cache + seed fallback.
 */

import { cacheGet, cacheSet } from './cacheManager';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const MAX_MODELS = 12;
const FETCH_TIMEOUT_MS = 15_000;

export const OPENROUTER_FREE_SEED = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'inclusionai/ling-3.0-tiny:free',
] as const;

/** Seed of historically free SiliconFlow chat models (intersected with live list). */
export const SILICONFLOW_FREE_SEED = [
  'Qwen/Qwen3-8B',
  'Qwen/Qwen2.5-7B-Instruct',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
  'Qwen/Qwen2-7B-Instruct',
  'Qwen/Qwen2-1.5B-Instruct',
  'THUDM/glm-4-9b-chat',
  'THUDM/chatglm3-6b',
  'nex-agi/Nex-N2-Pro',
  'internlm/internlm2_5-7b-chat',
  'mistralai/Mistral-7B-Instruct-v0.2',
] as const;

interface CatalogEntry {
  models: string[];
  fetchedAt: number;
}

const memory = new Map<string, CatalogEntry>();

function now(): number {
  return Date.now();
}

function isFresh(entry: CatalogEntry | undefined): entry is CatalogEntry {
  return Boolean(entry && now() - entry.fetchedAt < CACHE_TTL_MS && entry.models.length > 0);
}

function uniquePreserve(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cap(ids: string[], max = MAX_MODELS): string[] {
  return ids.slice(0, max);
}

async function readPersist(key: string): Promise<CatalogEntry | undefined> {
  try {
    return await cacheGet<CatalogEntry>(key);
  } catch {
    return undefined;
  }
}

async function writePersist(key: string, entry: CatalogEntry): Promise<void> {
  try {
    await cacheSet(key, entry);
  } catch {
    // ignore
  }
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ── OpenRouter ──────────────────────────────────────────────────────────── */

interface OpenRouterModel {
  id?: string;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

export function isOpenRouterFreeTextChat(model: OpenRouterModel): boolean {
  const id = model.id?.trim();
  if (!id || id === 'openrouter/free') return false;

  const pricing = model.pricing ?? {};
  const prompt = String(pricing.prompt ?? '1');
  const completion = String(pricing.completion ?? '1');
  const zeroPrice = (prompt === '0' || prompt === '0.0') && (completion === '0' || completion === '0.0');
  const freeSuffix = id.endsWith(':free');
  if (!zeroPrice && !freeSuffix) return false;

  const arch = model.architecture ?? {};
  const modality = String(arch.modality ?? '');
  const inputs = arch.input_modalities ?? [];
  const outputs = arch.output_modalities ?? [];
  const textIn = modality.includes('text') || inputs.includes('text');
  const textOut = modality.includes('text->text') || modality.endsWith('->text') || outputs.includes('text');
  // Skip pure audio / image generators
  if (/audio|image|video|speech|lyria|tts|whisper|kolors|flux|sdxl/i.test(id)) return false;
  return textIn && textOut;
}

export function rankOpenRouterFreeIds(ids: string[]): string[] {
  const score = (id: string): number => {
    let s = 0;
    if (id.includes('gemma')) s += 50;
    if (id.includes('gpt-oss')) s += 45;
    if (id.includes('nemotron-nano')) s += 40;
    if (id.includes('qwen') || id.includes('llama') || id.includes('ling')) s += 30;
    if (id.includes('ultra') || id.includes('550b') || id.includes('120b')) s -= 20;
    return s;
  };
  return [...ids].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

export function buildOpenRouterFreeList(liveIds: string[]): string[] {
  const ranked = rankOpenRouterFreeIds(liveIds.filter((id) => id !== 'openrouter/free'));
  // Prefer live catalog; always try free router first
  return cap(uniquePreserve(['openrouter/free', ...ranked]));
}

async function fetchOpenRouterFreeIds(): Promise<string[] | null> {
  const json = await fetchJson('https://openrouter.ai/api/v1/models');
  if (!json || typeof json !== 'object') return null;
  const data = (json as { data?: OpenRouterModel[] }).data;
  if (!Array.isArray(data)) return null;
  return data.filter(isOpenRouterFreeTextChat).map((m) => m.id!.trim());
}

export async function resolveOpenRouterFreeModels(options?: {
  forceRefresh?: boolean;
}): Promise<string[]> {
  const cacheKey = 'free_models_openrouter';
  if (!options?.forceRefresh) {
    const mem = memory.get(cacheKey);
    if (isFresh(mem)) return mem.models;
    const persisted = await readPersist(cacheKey);
    if (isFresh(persisted)) {
      memory.set(cacheKey, persisted);
      return persisted.models;
    }
  }

  const live = await fetchOpenRouterFreeIds();
  const models = live && live.length > 0
    ? buildOpenRouterFreeList(live)
    : [...OPENROUTER_FREE_SEED];

  const entry: CatalogEntry = { models, fetchedAt: now() };
  memory.set(cacheKey, entry);
  void writePersist(cacheKey, entry);
  return models;
}

/* ── SiliconFlow ─────────────────────────────────────────────────────────── */

/** Heuristic: likely free chat model id (SiliconFlow has no is_free flag). */
export function isLikelySiliconFlowFreeChat(id: string): boolean {
  if (!id || id.startsWith('Pro/')) return false;
  if (/embedding|rerank|tts|whisper|sdxl|kolors|flux|ocr|video|audio|speech|vl-|vision/i.test(id)) {
    return false;
  }
  // Prefer documented free / small instruct sizes
  if (SILICONFLOW_FREE_SEED.includes(id as (typeof SILICONFLOW_FREE_SEED)[number])) return true;
  if (/\b(1\.5B|1B|3B|7B|8B|9B|14B)\b/i.test(id)) return true;
  if (/Nex-N2-Pro|Distill|Instruct|Chat|Qwen3-8B/i.test(id) && !/\b(32B|72B|70B|120B|235B|300B|480B|550B)\b/i.test(id)) {
    return true;
  }
  return false;
}

export function buildSiliconFlowFreeList(liveIds: string[]): string[] {
  const liveSet = new Set(liveIds);
  const seedAlive = SILICONFLOW_FREE_SEED.filter((id) => liveSet.has(id));
  const heuristic = liveIds.filter(isLikelySiliconFlowFreeChat);
  // Only IDs that exist live — seed order first, then other likely-free chat models
  return cap(uniquePreserve([...seedAlive, ...heuristic]));
}

async function fetchSiliconFlowChatIds(
  apiKey: string,
  bases: readonly string[],
): Promise<string[] | null> {
  for (const base of bases) {
    const json = await fetchJson(`${base}/models?type=text&sub_type=chat`, {
      Authorization: `Bearer ${apiKey}`,
    });
    if (!json || typeof json !== 'object') continue;
    const data = (json as { data?: Array<{ id?: string }> }).data;
    if (!Array.isArray(data) || data.length === 0) continue;
    const ids = data.map((m) => m.id?.trim()).filter((id): id is string => Boolean(id));
    if (ids.length > 0) return ids;
  }
  return null;
}

export async function resolveSiliconFlowFreeModels(
  apiKey: string,
  bases: readonly string[],
  options?: { forceRefresh?: boolean },
): Promise<string[]> {
  const cacheKey = 'free_models_siliconflow';
  if (!options?.forceRefresh) {
    const mem = memory.get(cacheKey);
    if (isFresh(mem)) return mem.models;
    const persisted = await readPersist(cacheKey);
    if (isFresh(persisted)) {
      memory.set(cacheKey, persisted);
      return persisted.models;
    }
  }

  const live = apiKey ? await fetchSiliconFlowChatIds(apiKey, bases) : null;
  const models = live && live.length > 0
    ? buildSiliconFlowFreeList(live)
    : [...SILICONFLOW_FREE_SEED];

  const entry: CatalogEntry = { models, fetchedAt: now() };
  memory.set(cacheKey, entry);
  void writePersist(cacheKey, entry);
  return models;
}

/* ── Gemini ──────────────────────────────────────────────────────────────── */

export const GEMINI_MODEL_SEED = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;

function stripGeminiPrefix(id: string): string {
  return id.replace(/^models\//, '').trim();
}

export function isGeminiGenerateFlash(id: string): boolean {
  const name = stripGeminiPrefix(id);
  if (!/^gemini-/i.test(name)) return false;
  if (/embedding|imagen|image|tts|audio|veo|lyria|robotics|computer|native-audio/i.test(name)) {
    return false;
  }
  if (/-pro\b/i.test(name)) return false;
  return /flash/i.test(name);
}

export function isGeminiFlashLite(id: string): boolean {
  return /flash-lite/i.test(stripGeminiPrefix(id));
}

function geminiVersionScore(id: string): number {
  const name = stripGeminiPrefix(id);
  const match = name.match(/gemini-(\d+)(?:\.(\d+))?/i);
  if (!match) return 0;
  let score = Number(match[1]) * 100 + Number(match[2] ?? 0);
  if (/preview|exp/i.test(name)) score -= 5;
  return score;
}

function rankGeminiIds(ids: string[]): string[] {
  return [...ids].sort(
    (a, b) => geminiVersionScore(b) - geminiVersionScore(a) || a.localeCompare(b),
  );
}

export function buildGeminiTaskModels(
  liveIds: string[],
  task: 'extract' | 'chat' | 'vision',
): string[] {
  const usable = uniquePreserve(
    liveIds.map(stripGeminiPrefix).filter(isGeminiGenerateFlash),
  );
  const lite = rankGeminiIds(usable.filter(isGeminiFlashLite));
  const flash = rankGeminiIds(usable.filter((id) => !isGeminiFlashLite(id)));
  const ordered = task === 'chat' ? [...lite, ...flash] : [...flash, ...lite];
  if (ordered.length > 0) return cap(ordered, 6);
  return task === 'chat'
    ? [GEMINI_MODEL_SEED[1], GEMINI_MODEL_SEED[0]]
    : [...GEMINI_MODEL_SEED];
}

async function fetchGeminiModelIds(apiKey: string): Promise<string[] | null> {
  const json = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
  );
  if (!json || typeof json !== 'object') return null;
  const models = (json as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models;
  if (!Array.isArray(models)) return null;
  const ids = models
    .filter((row) => (row.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((row) => stripGeminiPrefix(row.name ?? ''))
    .filter(Boolean);
  return ids.length ? ids : null;
}

export async function resolveGeminiModels(
  apiKey: string,
  options?: { forceRefresh?: boolean },
): Promise<string[]> {
  const cacheKey = 'free_models_gemini';
  if (!options?.forceRefresh) {
    const mem = memory.get(cacheKey);
    if (isFresh(mem)) return mem.models;
    const persisted = await readPersist(cacheKey);
    if (isFresh(persisted)) {
      memory.set(cacheKey, persisted);
      return persisted.models;
    }
  }

  const live = apiKey ? await fetchGeminiModelIds(apiKey) : null;
  const models =
    live && live.length > 0
      ? uniquePreserve([...live.filter(isGeminiGenerateFlash), ...GEMINI_MODEL_SEED])
      : [...GEMINI_MODEL_SEED];

  const entry: CatalogEntry = { models, fetchedAt: now() };
  memory.set(cacheKey, entry);
  void writePersist(cacheKey, entry);
  return models;
}

/* ── Groq ────────────────────────────────────────────────────────────────── */

export const GROQ_CHAT_SEED = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'qwen/qwen3-32b',
] as const;

export function isGroqChatModel(id: string): boolean {
  if (!id) return false;
  if (/whisper|tts|guard|prompt-guard|allam|speech|audio/i.test(id)) return false;
  return /llama|gemma|mixtral|qwen|gpt-oss|deepseek|kimi|moonshot|mistral|compound/i.test(id);
}

function groqSizeScore(id: string, task: 'extract' | 'chat'): number {
  let score = 0;
  if (/70b|72b|32b/i.test(id)) score += task === 'extract' ? 50 : 10;
  if (/instant/i.test(id)) score += task === 'chat' ? 70 : 20;
  else if (/8b|9b|lite/i.test(id)) score += task === 'chat' ? 50 : 15;
  if (/3b|1b/i.test(id)) score += task === 'chat' ? 20 : 0;
  if (/llama-3\.3/i.test(id)) score += 8;
  if (/preview|exp/i.test(id)) score -= 10;
  return score;
}

export function buildGroqTaskModels(
  liveIds: string[],
  task: 'extract' | 'chat' = 'chat',
): string[] {
  const pool =
    liveIds.length > 0
      ? liveIds.filter(isGroqChatModel)
      : [...GROQ_CHAT_SEED];
  const ranked = uniquePreserve(pool).sort(
    (a, b) => groqSizeScore(b, task) - groqSizeScore(a, task) || a.localeCompare(b),
  );
  return cap(ranked.length ? ranked : [...GROQ_CHAT_SEED]);
}

async function fetchGroqModelIds(apiKey: string): Promise<string[] | null> {
  const json = await fetchJson('https://api.groq.com/openai/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });
  if (!json || typeof json !== 'object') return null;
  const data = (json as { data?: Array<{ id?: string }> }).data;
  if (!Array.isArray(data)) return null;
  const ids = data.map((row) => row.id?.trim()).filter((id): id is string => Boolean(id));
  return ids.length ? ids : null;
}

export async function resolveGroqChatModels(
  apiKey: string,
  options?: { forceRefresh?: boolean },
): Promise<string[]> {
  const cacheKey = 'free_models_groq';
  if (!options?.forceRefresh) {
    const mem = memory.get(cacheKey);
    if (isFresh(mem)) return mem.models;
    const persisted = await readPersist(cacheKey);
    if (isFresh(persisted)) {
      memory.set(cacheKey, persisted);
      return persisted.models;
    }
  }

  const live = apiKey ? await fetchGroqModelIds(apiKey) : null;
  const models = live && live.length > 0 ? live.filter(isGroqChatModel) : [...GROQ_CHAT_SEED];
  const entry: CatalogEntry = { models: models.length ? models : [...GROQ_CHAT_SEED], fetchedAt: now() };
  memory.set(cacheKey, entry);
  void writePersist(cacheKey, entry);
  return entry.models;
}

/** Invalidate in-memory cache (tests / after provider key change). */
export function clearFreeModelCatalogMemory(): void {
  memory.clear();
}
