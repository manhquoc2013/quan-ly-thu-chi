# Supabase Auth + Settings Sync + Offline Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local IndexedDB login with Supabase Auth; store profile + Settings (including API keys) in Postgres; pull config to local on login; queue offline edits and flush when online.

**Architecture:** Supabase session is the app gate. Local stores remain a cache. A small IndexedDB/localStorage outbox coalesces `profiles` / `user_settings` upserts (Phase 1 minimum). On login: ensure rows → pull profile/settings/household → hydrate ledger if local cache empty. Auth ops and household create/invite stay online-only.

**Tech Stack:** `@supabase/supabase-js` (already in repo), Vitest, Zustand authStore, React AuthScreen/AuthGuard, Postgres migrations under `supabase/migrations/`.

## Global Constraints

- Browser never receives Postgres URI or `service_role` — only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Spec: `docs/superpowers/specs/2026-08-08-supabase-auth-settings-design.md`.
- Conflicts: last-write-wins on `updated_at` / client `mutated_at`.
- Phase 1 outbox **must** cover `profiles` + `user_settings`; ledger outbox is optional incremental (existing dual-write when online is OK).
- Do not commit secrets; do not put connection strings in SPA env.
- User rule: only `git commit` when the human explicitly asks (skip commit steps unless told).

---

## File map

| Path | Role |
|---|---|
| `supabase/migrations/20260808183000_user_profiles_settings.sql` | `profiles`, `user_settings`, RLS, `updated_at` trigger, `handle_new_user` |
| `src/services/syncOutbox.ts` | Local outbox CRUD + coalesce |
| `src/services/syncOutbox.test.ts` | Coalesce / FIFO unit tests |
| `src/services/syncEngine.ts` | flush outbox, online/visibility hooks |
| `src/services/userSettingsService.ts` | load/upsert settings + apply to authStore |
| `src/services/profileService.ts` | load/upsert profile |
| `src/services/sessionBootstrap.ts` | post-login hydrate (profile, settings, household, optional ledger) |
| `src/store/authStore.ts` | Drive auth from Supabase session; drop local credential login; settings apply helpers |
| `src/ui/screens/auth/AuthScreen.tsx` | Supabase signUp / signInWithPassword only |
| `src/ui/components/AuthGuard.tsx` | Session from supabase; block if unconfigured |
| `src/ui/components/AuthProvider.tsx` | `onAuthStateChange` instead of local tokenService |
| `src/ui/screens/settings/SettingsScreen.tsx` | Membership-only cloud card; settings → outbox; sync badge/button |
| `src/ui/screens/settings/ChangePasswordDialog.tsx` | `supabase.auth.updateUser` |
| `src/ui/Layout.tsx` | Offline badge + pending outbox count |
| `.ai-context.md` | Note new auth/settings sync state |

---

### Task 1: SQL — profiles + user_settings

**Files:**
- Create: `supabase/migrations/20260808183000_user_profiles_settings.sql`

**Interfaces:**
- Produces: tables `public.profiles`, `public.user_settings`; trigger `on_auth_user_created`

- [x] **Step 1: Write migration**

```sql
-- profiles + user_settings (RLS by auth.uid())
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  store_name text not null default '',
  phone text,
  address text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gemini_api_key text,
  groq_api_key text,
  kilo_api_key text,
  enable_web_llm boolean not null default true,
  enable_kilo_free boolean not null default true,
  enable_groq boolean not null default true,
  ai_priority jsonb not null default '["kilo","groq","gemini","webllm"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (user_id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete using (user_id = auth.uid());

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
  for select using (user_id = auth.uid());
drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
  for insert with check (user_id = auth.uid());
drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_delete_own on public.user_settings
  for delete using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, store_name)
  values (new.id, new.email, '')
  on conflict (user_id) do nothing;
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Document for human**

Tell the user to paste/run this SQL in Supabase SQL Editor (same as shared ledger migration). No automated DB apply from CI assumed.

- [ ] **Step 3: Skip commit unless user asks**

---

### Task 2: syncOutbox (local) + unit tests

**Files:**
- Create: `src/services/syncOutbox.ts`
- Create: `src/services/syncOutbox.test.ts`

**Interfaces:**
- Produces:
  - `export type OutboxEntity = 'profiles' | 'user_settings'`
  - `export type OutboxOp = 'upsert' | 'delete'`
  - `export interface OutboxItem { id: string; userId: string; entity: OutboxEntity; entityId: string; op: OutboxOp; payload: Record<string, unknown>; mutatedAt: string; tries: number; lastError: string | null }`
  - `enqueueOutbox(item: Omit<OutboxItem,'id'|'tries'|'lastError'> & { id?: string }): OutboxItem`
  - `listOutbox(userId: string): OutboxItem[]`
  - `removeOutbox(id: string): void`
  - `clearOutbox(userId: string): void`
  - `pendingCount(userId: string): number`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueueOutbox,
  listOutbox,
  clearOutbox,
  pendingCount,
} from './syncOutbox';

describe('syncOutbox', () => {
  beforeEach(() => {
    clearOutbox('user-1');
    localStorage.clear();
  });

  it('coalesces upserts for same entityId keeping newest payload', () => {
    enqueueOutbox({
      userId: 'user-1',
      entity: 'user_settings',
      entityId: 'user-1',
      op: 'upsert',
      payload: { enable_web_llm: true },
      mutatedAt: '2026-08-08T10:00:00.000Z',
    });
    enqueueOutbox({
      userId: 'user-1',
      entity: 'user_settings',
      entityId: 'user-1',
      op: 'upsert',
      payload: { enable_web_llm: false },
      mutatedAt: '2026-08-08T10:01:00.000Z',
    });
    const items = listOutbox('user-1');
    expect(items).toHaveLength(1);
    expect(items[0].payload.enable_web_llm).toBe(false);
    expect(pendingCount('user-1')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/services/syncOutbox.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `syncOutbox.ts`**

Persist under key `ql-tc-sync-outbox` in `localStorage` as `Record<userId, OutboxItem[]>`. On enqueue upsert with same `(entity, entityId)`, replace existing pending upsert. Generate `id` via `crypto.randomUUID()`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/services/syncOutbox.test.ts`  
Expected: PASS

---

### Task 3: profile + userSettings services

**Files:**
- Create: `src/services/profileService.ts`
- Create: `src/services/userSettingsService.ts`
- Modify: `src/services/index.ts` (export new services)

**Interfaces:**
- Consumes: `getSupabase()` from `supabaseClient.ts`
- Produces:
  - `fetchProfile(): Promise<ProfileRow | null>`
  - `upsertProfile(patch: Partial<ProfileRow>): Promise<void>` — writes remote when online; caller also enqueues
  - `ensureProfileSettingsRows(): Promise<void>` — upsert empty rows if trigger missed
  - `fetchUserSettings(): Promise<UserSettingsRow | null>`
  - `upsertUserSettings(patch: Partial<UserSettingsRow>): Promise<void>`
  - `applyUserSettingsToStore(row: UserSettingsRow): void` — sets gemini/groq/kilo/toggles/aiPriority + syncs services
  - Types mirror DB snake_case fields

```ts
export interface ProfileRow {
  user_id: string;
  store_name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  updated_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  gemini_api_key: string | null;
  groq_api_key: string | null;
  kilo_api_key: string | null;
  enable_web_llm: boolean;
  enable_kilo_free: boolean;
  enable_groq: boolean;
  ai_priority: string[];
  updated_at: string;
}
```

- [ ] **Step 1: Implement services** using `.from('profiles')` / `.from('user_settings')` select/upsert with `onConflict: 'user_id'`. Map `ai_priority` JSON to `LlmSource[]` with fallback to `AI_PRIORITY_DEFAULT`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: PASS (or only pre-existing unrelated errors — fix any introduced)

---

### Task 4: syncEngine + sessionBootstrap

**Files:**
- Create: `src/services/syncEngine.ts`
- Create: `src/services/sessionBootstrap.ts`
- Modify: `src/services/cloudSync.ts` — export/reuse `hydrateStoresFromCloud` / `refreshHouseholdFromCloud`

**Interfaces:**
- Produces:
  - `startSyncEngine(): () => void` — subscribe `online`, `visibilitychange`, 30s interval; returns unsubscribe
  - `flushOutbox(userId: string): Promise<{ flushed: number; failed: number }>`
  - `bootstrapSessionAfterAuth(): Promise<{ hasHousehold: boolean; storeName: string }>`  
    Order: `ensureProfileSettingsRows` → if `pendingCount>0` then `flushOutbox` → `fetchProfile` + `fetchUserSettings` → apply to authStore → `refreshHouseholdFromCloud` → if household and local ledger empty, `hydrateStoresFromCloud`

- [ ] **Step 1: Implement flush**

For each outbox item:
- `profiles` upsert → `upsertProfile(payload)`
- `user_settings` upsert → `upsertUserSettings(payload)`
On success `removeOutbox(id)`; on failure increment `tries` / `lastError` and keep item.

- [ ] **Step 2: Implement bootstrap** as specified in Interfaces.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

---

### Task 5: Wire Auth to Supabase (AuthScreen, AuthGuard, AuthProvider, authStore)

**Files:**
- Modify: `src/store/authStore.ts`
- Modify: `src/ui/screens/auth/AuthScreen.tsx`
- Modify: `src/ui/components/AuthGuard.tsx`
- Modify: `src/ui/components/AuthProvider.tsx`
- Modify: `src/ui/screens/onboarding/OnboardingScreen.tsx` (profile write via `profileService` + outbox)

**Interfaces:**
- Consumes: `signInSupabase` / `signUpSupabase` / `signOutSupabase` from `householdService` (or move to `supabaseAuth.ts` if cleaner)
- Produces: `isAuthenticated` true iff Supabase session exists; `login`/`register` call Supabase then `bootstrapSessionAfterAuth`

- [ ] **Step 1: authStore changes**

- Remove dependency on local `initDatabase` / `getOrCreateEncryptionKey` for **login success** (Phase 1 may still open local DB as cache with a device key or lazy-init — do **not** block Auth on decrypt failure).
- `login`/`register`: call Supabase → `bootstrapSessionAfterAuth` → set `isAuthenticated`, `userProfile` from profile row, household fields, apply settings.
- `logout`: if `pendingCount(userId)>0`, UI must confirm (handle in Settings/AuthGuard caller); then `signOutSupabase`, `clearOutbox`, clear store flags.
- Keep zustand persist for non-secret UI if useful, but **source of truth after login is cloud pull**; do not treat localStorage secrets as newer than pulled `user_settings` on bootstrap.

- [ ] **Step 2: AuthScreen**

Replace `registerUser` / local password hash flows with:

```ts
await signUpSupabase(email, password);
// or
await signInSupabase(email, password);
await bootstrapSessionAfterAuth();
```

Map errors:
- `invalid_credentials` → `Sai email/mật khẩu hoặc chưa đăng ký`
- email not confirmed → Vietnamese toast

- [ ] **Step 3: AuthGuard**

- If `!isSupabaseConfigured()` → full-page message to set env.
- Hydrate: wait for `supabase.auth.getSession()`; if session, set authenticated + run bootstrap once per session id.
- No session → `AuthScreen`.

- [ ] **Step 4: AuthProvider**

Replace local `tokenService` refresh with:

```ts
const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, session) => {
  // SYNCED / SIGNED_IN → bootstrap if needed
  // SIGNED_OUT → clear store
});
return () => subscription.unsubscribe();
```

Also call `startSyncEngine()` while authenticated.

- [ ] **Step 5: Manual smoke (dev)**

Run: `npm run dev`  
Expected: register/login against Supabase; Settings shows hydrated keys if previously saved.

- [ ] **Step 6: Typecheck + unit tests**

Run: `npm run typecheck && npm run test`

---

### Task 6: Settings UI — outbox writes, membership-only cloud card, password, sync controls

**Files:**
- Modify: `src/ui/screens/settings/SettingsScreen.tsx`
- Modify: `src/ui/screens/settings/ChangePasswordDialog.tsx`
- Modify: `src/ui/screens/settings/ProfileDialog.tsx`
- Modify: `src/ui/Layout.tsx`

**Interfaces:**
- Consumes: `enqueueOutbox`, `flushOutbox`, `pendingCount`, profile/settings upserts

- [ ] **Step 1: Helper `persistSettingsLocalThenQueue`**

On every settings change (Gemini key, Groq, toggles, aiPriority):

1. Update authStore + local AI services immediately.
2. `enqueueOutbox({ entity: 'user_settings', entityId: userId, op: 'upsert', payload: fullSettingsSnakeCase, mutatedAt: new Date().toISOString(), userId })`.
3. If `navigator.onLine`, `void flushOutbox(userId)`.

Same pattern for profile fields via `entity: 'profiles'`.

- [ ] **Step 2: Settings “Sổ chung”**

Remove email/password sign-in/up from this card (app Auth already Supabase). Keep: status, create household, invite, redeem, push/pull ledger, sign out of cloud only if still needed — prefer single Logout that signs out Supabase.

- [ ] **Step 3: ChangePasswordDialog**

```ts
const { error } = await getSupabase().auth.updateUser({ password: newPassword });
if (error) throw new Error(error.message);
```

Require online; toast if offline.

- [ ] **Step 4: Layout badge**

Show `Offline` when `!navigator.onLine`. Show `Chưa đồng bộ (N)` when `pendingCount>0`. Button/link “Đồng bộ ngay” → `flushOutbox`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

---

### Task 7: Verification checklist + context

**Files:**
- Modify: `.ai-context.md`
- Modify: `.env.example` (note Auth email must be enabled; profiles migration)

- [ ] **Step 1: Automated**

Run: `npm run typecheck && npm run test`  
Expected: PASS

- [ ] **Step 2: Manual checklist (human)**

1. Run both SQL migrations in Supabase if not already.
2. Enable Email Auth; optionally disable confirm email for dev.
3. Fresh browser profile: register → rows in `profiles` + `user_settings`.
4. Set Gemini key → reload → key restored from DB.
5. Toggle WebLLM offline (DevTools offline) → pending badge → go online → row updates.
6. Second browser: login → pull settings match.
7. Create/join household still works from Settings.

- [ ] **Step 3: Update `.ai-context.md`** with Auth=Supabase, settings outbox, pull-on-login.

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| Remove local auth / Supabase Auth gate | Task 5 |
| `profiles` + `user_settings` + RLS + bootstrap trigger | Task 1 |
| API keys in DB + RLS | Task 1, 3, 6 |
| Pull on login (profile, settings, household, ledger if empty) | Task 4 |
| Offline outbox + flush on online | Task 2, 4, 6 |
| LWW / coalesce | Task 2, 4 |
| Change password via Supabase | Task 6 |
| Settings card without duplicate Auth | Task 6 |
| Offline badge + manual sync | Task 6 |
| Phase 1 ledger dual-write remains | unchanged services; bootstrap hydrate Task 4 |
| No connection string in SPA | Global Constraints |

## Placeholder scan

No TBD/TODO steps; concrete SQL/TS and commands included. Commit steps omitted unless user requests (Global Constraints).
