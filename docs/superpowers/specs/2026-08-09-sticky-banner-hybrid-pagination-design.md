# Sticky bulk bar + hybrid Supabase pagination

**Date:** 2026-08-09  
**Status:** Implemented

## Goals

1. Selection bulk bar stays viewport-sticky while scrolling list content.
2. Five CRUD lists paginate with Supabase `.range` + exact count when a household is online; fall back to IndexedDB filter/sort/slice offline or on cloud failure.
3. Reports/dashboard keep full local ledger hydrate.

## Design

- **StickyBulkBar:** `createPortal` to `document.body`, `fixed` above status bar; `md:left` from `--layout-sidebar-offset` set by Layout.
- **listQuery:** `query*Page` per entity; cloud path uses PostgREST filters + `.range`; revenues fetch `revenue_items` only for page IDs.
- **usePagedList + PaginationBar:** page sizes 10/20/50/100 (default 20); reset page on filter/pageSize; invalidate via `ledger-list-invalidate` (mutations + realtime).
- **Selection:** current page only; cleared when page row IDs change.

## Out of scope

Report tables, column pinning, stopping full ledger hydrate.
