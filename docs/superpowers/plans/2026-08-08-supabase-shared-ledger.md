# Supabase Shared Ledger Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Google Drive as primary cloud sync with a Supabase household-scoped Postgres ledger (shared CRUD + invites + product images).

**Architecture:** Keep existing local auth + IndexedDB as app gate/cache. When `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set and user links a Supabase session + household, dual-write CRUD to Supabase and hydrate stores from cloud. Schema/RLS/RPCs live in `supabase/migrations/`.

**Tech Stack:** `@supabase/supabase-js`, Postgres (Supabase), React stores/services existing patterns.

## Global Constraints

- Browser never receives Postgres URI or `service_role` key — only anon key.
- No invoice image persistence; product images only (`product-images` bucket).
- One household per user (phase 1).
- Money as bigint VND; snake_case DB ↔ camelCase TS mappers.
- Do not commit secrets; user supplies anon URL/key in `.env.local`.

## File map

| Path | Role |
|---|---|
| `supabase/migrations/20260808170000_shared_ledger.sql` | Full schema, RLS, RPCs, storage policies |
| `src/services/supabaseClient.ts` | Client singleton + `isSupabaseConfigured()` |
| `src/services/supabaseMappers.ts` | Row ↔ domain mappers |
| `src/services/supabaseMappers.test.ts` | Mapper unit tests |
| `src/services/householdService.ts` | create/redeem invite, current membership |
| `src/services/ledgerRepository.ts` | CRUD load/save for all entities |
| `src/services/cloudSync.ts` | Hydrate stores, dual-write helpers, realtime |
| `src/services/productImageStorage.ts` | Upload/remove product image |
| `src/models/product.ts` | Add optional `imagePath` |
| `src/store/authStore.ts` | `householdId`, supabase session flags |
| `src/ui/screens/settings/SettingsScreen.tsx` | Household connect UI |
| `.env.example` | Document Supabase env vars |
| `src/vite-env.d.ts` | Env typings |

### Task 1: SQL migration

- [ ] Add migration file with households, members, invites, customers, products, order_platforms, expenses, revenues, revenue_items, helper `is_household_member`, RLS, RPCs `create_household`, `create_invite`, `redeem_invite`, `upsert_revenue_with_items`, storage bucket policies, platform seed inside `create_household`.

### Task 2: Client + mappers + tests

- [ ] `npm i @supabase/supabase-js`
- [ ] Client, mappers, mapper tests green

### Task 3: Household + ledger repository + cloudSync

- [ ] Services above; authStore fields; hydrate + dual-write hooks in expense/revenue/customer/product/platform services

### Task 4: Settings UI + product image

- [ ] Settings section; product `imagePath` + storage helper

### Task 5: Verify

- [ ] `npm run typecheck` + `npm run test` pass
- [ ] Document: run SQL in Supabase SQL editor; set env; link account in Settings
