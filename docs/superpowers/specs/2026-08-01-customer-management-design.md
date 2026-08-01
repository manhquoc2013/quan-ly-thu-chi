# Customer management (Quản lý khách hàng)

**Date:** 2026-08-01  
**Status:** Implemented  
**Approach:** Dedicated menu + optional phone + delete guard

## Decisions (confirmed)

| Topic | Choice |
|-------|--------|
| Phone when AI creates without SĐT | **C** — phone optional system-wide |
| Delete customer with orders | **A** — block delete |
| Scope | Menu + CRUD screen; order select from customers; AI find-or-create via service |

## Model

`Customer.phone` remains a string but **may be empty**. If non-empty, must match `^(0|\+84)[0-9]{9,10}$`.

## Service

- `createCustomer` / `updateCustomer`: validate phone only when provided
- `findOrCreateCustomerByName(name)`: case-insensitive match → else create with empty phone
- `deleteCustomer`: refuse if any revenue has `customerId === id`

## UI

- Nav tab **Khách hàng** → `/customers`
- List + search + add/edit dialog + delete with confirm
- OrderDialog quick-add uses `createCustomer` (not store stub)

## AI / intake

`persistRevenueDraft` and `ensureCustomer` call `findOrCreateCustomerByName` (silent toast).
