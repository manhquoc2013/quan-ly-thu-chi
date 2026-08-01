# Order platform catalog (Kênh đặt hàng)

**Date:** 2026-08-01  
**Status:** Implemented  
**Approach:** C — manageable catalog

## Model

`OrderPlatform`: id, name, code?, active, createdAt  
`Revenue.platformId?` FK  

Seed: Trực tiếp (default), Facebook, Zalo, Shopee, TikTok, Website, Khác.

## UI

- Nav **Kênh** → `/platforms` CRUD (cannot delete Trực tiếp or platforms in use)
- OrderDialog: dropdown active platforms
- Revenue grid: platform name under order code

## AI

Resolve platform like product/customer; default Trực tiếp when omitted; detect Shopee/FB/… from text.
