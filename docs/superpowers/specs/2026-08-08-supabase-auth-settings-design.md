# Supabase Auth + Cloud Settings + Offline Sync — Design

**Date:** 2026-08-08  
**Status:** Approved (offline + pull-on-login; ready for implementation plan)  
**Builds on:** `2026-08-08-supabase-shared-ledger-design.md`  
**Approach:** Phased cutover (**B**) — Auth + settings + outbox first; harden ledger sync next

## Goal

- **Supabase Auth only** (remove local email/password + encryption-as-login gate).
- Persist **profile + Settings (including API keys)** per user in Postgres (`profiles`, `user_settings`) with RLS.
- **Offline-capable:** after at least one successful login, user can use cached data offline; mutations go to a local **outbox** and **sync to Supabase when online**.
- **Pull on login success:** after Auth succeeds, download selected cloud config into local cache so the device matches the user’s cloud state before the UI proceeds.
- Keep **household shared ledger**; membership create/invite still requires online (cannot join/create household offline).

## Decisions (locked)

| Topic | Choice |
|---|---|
| Offline | **Supported** — local cache + outbox; sync on reconnect |
| Login hydrate | **Pull cloud → local** for config listed below (blocking until done or soft-fail with retry) |
| First-time auth | Must be **online** (sign up / sign in once to obtain session) |
| Local auth | Removed (Supabase Auth only) |
| API keys | In `user_settings` with RLS `auth.uid()`; also cached locally for offline AI |
| Conflicts | **Last-write-wins** on `updated_at` (no merge UI in Phase 1) |
| Rollout | Phase 1: Auth + settings cloud + settings/profile outbox; ledger dual-write/outbox incremental. Phase 2: full ledger outbox + Realtime pull |

## Non-goals (Phase 1)

- Full CRDT / field-level merge UI.
- Creating or redeeming household invites while offline.
- GitHub OAuth (follow-up).
- Encrypting API keys beyond Postgres RLS + local persisted store.
- Auto-migrate old IndexedDB local-auth accounts.

## Architecture

```text
                    ┌─────────────────────┐
  UI / stores  ────►│ Local cache         │  (IndexedDB / existing stores)
                    │ + sync_outbox       │
                    └─────────┬───────────┘
                              │ online?
                    ┌─────────▼───────────┐
                    │ Sync engine         │  push outbox → pull remote
                    └─────────┬───────────┘
                              ▼
                         Supabase
              Auth · profiles · user_settings
              households · ledger tables
```

```text
AuthGate
  • No persisted Supabase session → AuthScreen (requires network)
  • Session present (possibly stale JWT) → enter app with cache
  • navigator.onLine false → badge “Offline”; queue writes
  • online again → flush outbox, then pull
```

Env: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only in browser.

## Data model (cloud)

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid pk fk → `auth.users` on delete cascade | |
| `store_name` | text not null default '' | |
| `phone` | text null | |
| `address` | text null | |
| `email` | text null | denormalized for display |
| `created_at` | timestamptz not null default now() | |
| `updated_at` | timestamptz not null default now() | trigger |

### `user_settings`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid pk fk → `auth.users` on delete cascade | |
| `gemini_api_key` | text null | |
| `groq_api_key` | text null | |
| `kilo_api_key` | text null | |
| `enable_web_llm` | boolean not null default true | |
| `enable_kilo_free` | boolean not null default true | |
| `enable_groq` | boolean not null default true | |
| `ai_priority` | jsonb not null default `["kilo","groq","gemini","webllm"]` | |
| `created_at` | timestamptz not null default now() | |
| `updated_at` | timestamptz not null default now() | trigger |

### RLS

- `profiles` / `user_settings`: CRUD only when `user_id = auth.uid()`.

### Bootstrap

Trigger on `auth.users` insert (preferred) or client upsert after first login: create empty `profiles` + `user_settings` rows.

## Local persistence & outbox

### Cache

- Persist Supabase session (supabase-js default).
- Persist hydrated `profiles` + `user_settings` snapshot keyed by `user_id`.
- Persist household ledger entities in existing local stores/DB as **cache** (not a second login system).

### `sync_outbox` (local only)

| Field | Notes |
|---|---|
| `id` | uuid |
| `user_id` | owner |
| `entity` | e.g. `user_settings` \| `profiles` \| `expenses` \| … |
| `entity_id` | row id |
| `op` | `upsert` \| `delete` |
| `payload` | JSON body |
| `mutated_at` | client ISO time (used for LWW) |
| `tries` / `last_error` | retry bookkeeping |

Rules:

1. **Online write path:** apply local cache immediately → enqueue outbox → attempt flush now.
2. **Offline write path:** apply local cache → enqueue only; UI shows pending sync.
3. **Flush:** FIFO per entity-id (coalesce: newer upsert replaces older pending upsert for same key).
4. **After successful push:** pull remote for that scope (settings row or household tables).
5. **Auth ops** (sign up, sign in, change password, create/redeem invite): **online only**.

### Sync triggers

- `window` `online` event
- App foreground / `visibilitychange`
- Periodic timer while online (e.g. 30s) if outbox non-empty
- Manual “Đồng bộ ngay” in Settings

## App flows

### Login / register

1. `AuthScreen` → Supabase email/password only (network required).
2. Ensure profile/settings rows exist (trigger or upsert).
3. **Hydrate local from cloud (required step on success):**
   - Pull `profiles` → local user profile cache.
   - Pull `user_settings` → local AI keys/toggles/`ai_priority` (overwrite local snapshot for this `user_id`).
   - Pull household membership (`get_my_household`) → local household fields.
   - If household exists: **optionally** pull ledger snapshot (platforms/customers/products/expenses/revenues) — Phase 1 **yes for empty local / first login on device**; if local outbox has pending ledger ops, flush outbox first then pull (avoid clobbering unsynced local writes).
4. Empty `store_name` → onboarding → write profile (outbox-aware).
5. No household → online gate: create or redeem invite.
6. Logout → `signOut`, clear cache + outbox for that user (confirm if outbox pending).

**Pull-on-login scope (Phase 1 — “một số cấu hình”):**

| Pulled to local | Source |
|---|---|
| Store profile (`store_name`, phone, address, email) | `profiles` |
| AI settings + API keys + priority | `user_settings` |
| Household id / name / role | RPC `get_my_household` |
| Ledger entities (full hydrate) | household tables — on first device login or when local cache empty |

Not pulled as “config” (remain online-only actions): invite codes, password change, creating household.

### Settings

- Edits update local store immediately and enqueue `user_settings` / `profiles` upsert.
- On flush success, remote `updated_at` becomes truth.
- If pull finds remote `updated_at` > local `mutated_at`, overwrite local (LWW).

### Change password

- Online only via `supabase.auth.updateUser({ password })`.

### Ledger (Phase 1 incremental)

- Keep dual-write when online + household linked.
- When offline, mutations stay in local cache + outbox (at least for entities already wired); flush on reconnect.
- Phase 1 minimum bar for offline: **settings + profile** reliably queue/flush; ledger outbox coverage can land in same milestone if low-risk, else Phase 1.5.

## Phase 2

- Complete outbox for all ledger tables; Realtime pull while online.
- Retire any leftover local-auth / encryption-login code paths.
- Optional: conflict banner if server rejects row (RLS/network).

## Error handling

- Auth failures → Vietnamese toasts (`invalid_credentials`, email unconfirmed).
- Flush failure → keep outbox item; badge “Chưa đồng bộ (N)”; exponential backoff.
- Expired session while offline → read-only cache or block writes until re-login online.
- Missing `VITE_SUPABASE_*` → blocking config screen.

## Testing / verification

- Sign up online → rows in Auth + profiles + settings.
- Change Gemini key offline → appears in UI → go online → row updated in Supabase.
- Two devices: last writer wins on settings.
- RLS: user A cannot read user B settings.
- Outbox coalescing: 5 rapid toggles → one remote upsert.
- Logout with pending outbox → confirm discard or force sync first.

## Implementation notes

- Migration: `…_user_profiles_settings.sql`.
- Services: `userSettingsService`, `profileService`, `syncOutbox` + `syncEngine`.
- `AuthGuard` / `AuthProvider` via `onAuthStateChange`; network status in UI shell.
- Settings “Sổ chung” drops duplicate Auth once app Auth is Supabase (membership only).

## Open follow-ups

- GitHub OAuth.
- Server-held AI keys.
- One-shot migrate wizard from legacy local-auth installs.
- Richer conflict UI beyond LWW.
