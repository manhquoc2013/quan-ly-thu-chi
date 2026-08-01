# Product catalog + AI entity resolve

**Date:** 2026-08-01  
**Status:** Implemented  
**Approach:** Catalog Product + resolve-before-persist with partial-match confirm

## Decisions

| Topic | Choice |
|-------|--------|
| Match rule | **C** — any partial match → list for user; 0 matches → auto-create |
| Product fields | name, defaultUnitPrice, unit, sku?, notes? |
| Order price | Catalog price is **suggestion only**; order/AI may override |
| Delete product | Block if any order line references `productId` |

## Data

```ts
interface Product {
  id: string;
  name: string;           // 2–100
  defaultUnitPrice: number; // >= 0
  unit: string;           // e.g. cái, kg
  sku?: string;
  notes?: string;
  createdAt: string;
}

// OrderItem:
productId?: string;
```

## AI resolve flow

For create_revenue (customerName + description/product):

1. `searchCandidates(query)` — case-insensitive includes / normalized substring  
2. 0 → create entity  
3. ≥1 → pending clarify: numbered list + `0 = tạo mới`; wait for reply  
4. Persist only after customer + product resolved  
5. Unit price: from user amount/qty if present, else `defaultUnitPrice` (still overridable later in UI)

## UI

- Nav **SP** → `/products` CRUD  
- OrderDialog: searchable product pick → fill name + suggested price; price editable
