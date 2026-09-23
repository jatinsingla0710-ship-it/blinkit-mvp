# GroAurum Admin ERP — Implementation Audit

**Date:** 2026-07-18  
**Scope:** Read-only inspection of `apps/admin-web` + `@groaurum/api` repositories  
**Rule:** No code changes; compare intended ERP modules vs current implementation  

**Adapter note:** Live path requires `VITE_DATA_ADAPTER=supabase` + URL/anon. Mock path uses fixtures (dev only). Ratings below assume **live/supabase** mode.

### Rating legend
| Rating | Meaning |
|--------|---------|
| **PASS** | Meets criterion for pilot use |
| **PARTIAL** | Present but incomplete or stubbed |
| **FAIL** | Present but not usable for intended ops |
| **MISSING** | Not implemented |

---

## Executive scorecard

| Module | UI | Nav | API/RPC | Supabase CRUD | Realtime | Loading/Error | Production-ready |
|--------|----|-----|---------|---------------|----------|---------------|------------------|
| Dashboard | PASS | PASS | PASS | N/A (read) | PARTIAL | PASS | **PARTIAL** |
| Categories | PASS | PASS | PASS | PASS | MISSING | PASS | **PASS** (pilot) |
| Products | PASS | PASS | PASS | PARTIAL | MISSING | PASS | **PARTIAL** |
| Inventory | PASS | PASS | PASS | PARTIAL | PASS | PASS | **PARTIAL** |
| Pricing | PASS | PASS | PASS | PASS | MISSING | PASS | **PASS** (pilot) |
| Orders | PASS | PASS | PASS | PASS | PASS | PASS | **PASS** (pilot) |
| Customers | PASS | PASS | PASS | PARTIAL | MISSING | PASS | **PARTIAL** |
| Reports | PASS | PASS | PARTIAL | MISSING | MISSING | PASS | **FAIL** |
| Settings | PASS | PASS | PARTIAL | PARTIAL | MISSING | PASS | **PARTIAL** |

**Also in nav (out of requested nine):** Salesmen PARTIAL · Delivery PARTIAL · Service Areas **MISSING** (placeholder page only)

---

## Shared platform findings

| Area | Status | Evidence |
|------|--------|----------|
| Auth + module guards | PASS | `ProtectedAdminRoute`, `AdminModuleGuard`, `App.tsx` |
| Sidebar nav | PASS | `apps/admin-web/src/data/nav.ts` |
| Query loading/error/empty | PASS | `QueryStateGate` on all module pages |
| CrudServices → Supabase repos | PASS | `packages/api/src/services/crud-services.ts` |
| Order status RPC | PASS | `update_order_status_admin` via `ops-repositories.ts` |
| Realtime bus | PARTIAL | Only `orders`, `inventory`, `delivery` in `AdminDataProviders.tsx` |

---

## 1. Dashboard

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | KPIs, daily focus, low stock, sales team, recent orders, quick actions |
| 2. Navigation | **PASS** | `/` indexed, sidebar Dashboard |
| 3. Backend API | **PASS** | `LiveAdminApi.dashboardSnapshot()` aggregates orders/shops/inventory/routes/payments |
| 4. Supabase CRUD | **N/A → PASS** | Read-only by design; quick actions are no-ops |
| 5. Realtime | **PARTIAL** | Dashboard keys invalidated on orders/inventory/delivery changes only — not shops/products |
| 6. Loading/error | **PASS** | `QueryStateGate` |
| 7. Production-ready | **PARTIAL** | Live KPIs OK for pilot; quick actions non-functional; focus/sales widgets thinner than fixture UX |

### Gaps (PARTIAL)
| Gap | Files | Effort |
|-----|-------|--------|
| Quick actions do nothing | `DashboardPage.tsx` | S (~2–4h) wire to routes/mutations |
| Realtime incomplete for customer/sales KPIs | `AdminDataProviders.tsx` | S (~2h) add shops subscription |
| Sales team / recent orders depth vs ops needs | `LiveAdminApi.ts` `dashboardSnapshot` | M (~1–2d) richer queries |

---

## 2. Categories

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | List + create form + activate/deactivate/soft-delete actions |
| 2. Navigation | **PASS** | `/categories` |
| 3. Backend API | **PASS** | Categories repository via hooks |
| 4. Supabase CRUD | **PASS** | `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useSoftDeleteCategoryMutation` wired on page |
| 5. Realtime | **MISSING** | Not in `ADMIN_REALTIME_SPECS` |
| 6. Loading/error | **PASS** | Gate + inline create error |
| 7. Production-ready | **PASS** | Suitable for pilot taxonomy ops |

### Gaps
| Gap | Files | Effort |
|-----|-------|--------|
| No realtime invalidation | `AdminDataProviders.tsx` | S (~1h) |
| No display_order / nested taxonomy UX | `CategoriesListPage.tsx` | M if required |

---

## 3. Products

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | List + detail tabs (overview, SKUs, price history, inventory, images) |
| 2. Navigation | **PASS** | `/products`, `/products/:productId` |
| 3. Backend API | **PASS** | Live product list/detail via repositories + LiveAdminApi |
| 4. Supabase CRUD | **PARTIAL** | Update/publish + soft-delete on detail; **no create product UI**; list quick actions stubbed; SKU create/update/delete mutations exist in `mutations.ts` but **not used on pages** |
| 5. Realtime | **MISSING** | Products not subscribed |
| 6. Loading/error | **PASS** | `QueryStateGate` |
| 7. Production-ready | **PARTIAL** | Can view/publish/archive existing products; cannot fully manage catalogue lifecycle from UI |

### Gaps (PARTIAL)
| Gap | Files | Effort |
|-----|-------|--------|
| Create product UI missing (`useCreateProductMutation` unused) | `ProductListPage.tsx`, `mutations.ts` | M (~1–2d) |
| SKU CRUD UI missing (`useCreateSkuMutation` / update / soft-delete unused) | `ProductDetailPage.tsx`, `ProductSkusTab` | M (~1–2d) |
| List quick actions: “No backend CRUD in v1” | `ProductListPage.tsx` | S once create exists |
| Product images upload may be incomplete vs storage | `ProductImagesTab`, LiveAdminApi | M |
| Realtime | `AdminDataProviders.tsx` | S |

---

## 4. Inventory

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | Snapshot list + detail with on-hand adjust |
| 2. Navigation | **PASS** | `/inventory`, `/inventory/:skuId` |
| 3. Backend API | **PASS** | Live balances via snapshot/detail |
| 4. Supabase CRUD | **PARTIAL** | `useUpdateInventoryMutation` on detail; list comment says “append-only ledger mutations deferred”; no movement ledger UX |
| 5. Realtime | **PASS** | `inventory` → query invalidation |
| 6. Loading/error | **PASS** | Gate |
| 7. Production-ready | **PARTIAL** | Adjust OK for pilot; not full WMS (transfers, multi-location UX, movement audit UI) |

### Gaps
| Gap | Files | Effort |
|-----|-------|--------|
| Inventory movements UI / append-only ledger | `InventoryListPage.tsx`, `InventoryDetailPage.tsx`, repos | L (~3–5d) |
| Reservation visibility / expire ops surface | LiveAdminApi / new UI | M |

---

## 5. Pricing

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | SKU price list + detail with create/close price |
| 2. Navigation | **PASS** | `/pricing`, `/pricing/:skuId` |
| 3. Backend API | **PASS** | Prices repository |
| 4. Supabase CRUD | **PASS** | `useCreatePriceMutation` + `useClosePriceMutation` on detail (append-only close pattern) |
| 5. Realtime | **MISSING** | Not subscribed |
| 6. Loading/error | **PASS** | Gate |
| 7. Production-ready | **PASS** | Pilot-ready for trade price maintenance |

### Gaps
| Gap | Files | Effort |
|-----|-------|--------|
| List page comment still says mutations deferred (detail has them) | `PricingListPage.tsx` | S cosmetic |
| Scheduled future prices UX | Pricing components | M if required |
| Realtime | `AdminDataProviders.tsx` | S |

---

## 6. Orders

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | List + detail timeline / status actions |
| 2. Navigation | **PASS** | `/orders`, `/orders/:orderId` |
| 3. Backend API / RPC | **PASS** | Live reads; status via `update_order_status_admin` SECURITY DEFINER RPC |
| 4. Supabase CRUD | **PASS** | Status update + cancel path through repository RPC (not raw trusted client update) |
| 5. Realtime | **PASS** | Orders + dashboard invalidation |
| 6. Loading/error | **PASS** | Gate |
| 7. Production-ready | **PASS** | Strongest write module for pilot ops |

### Gaps (minor)
| Gap | Files | Effort |
|-----|-------|--------|
| Create order from Admin is secondary (mutation exists; list may not expose full wizard) | `mutations.ts`, orders pages | M for full assisted create UX |
| Bulk status / filters polish | Orders list components | S–M |

---

## 7. Customers

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | List KPIs/table + detail |
| 2. Navigation | **PASS** | `/customers`, `/customers/:customerId` |
| 3. Backend API | **PASS** | Live shops snapshot/detail |
| 4. Supabase CRUD | **PARTIAL** | Create + update wired; create uses **hardcoded seed** service area + salesman IDs; detail activity/documents empty arrays |
| 5. Realtime | **MISSING** | Shops not in realtime specs |
| 6. Loading/error | **PASS** | Gate |
| 7. Production-ready | **PARTIAL** | Usable but create flow not production-grade; incomplete CRM tabs |

### Gaps
| Gap | Files | Effort |
|-----|-------|--------|
| Replace seed UUID create with form (area, salesman, address) | `CustomersListPage.tsx` | M (~1d) |
| Activity / documents empty | `LiveAdminApi.ts` (~1085) | M–L |
| Soft-delete / lifecycle transitions UX | Customer detail | M |
| Realtime shops | `AdminDataProviders.tsx` | S |

---

## 8. Reports

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | Tabs, filters, KPI strip, section grid |
| 2. Navigation | **PASS** | `/reports` |
| 3. Backend API | **PARTIAL** | `reportsSnapshot()` loads some aggregates for KPIs but **all chart/table reports are `placeholder: true` with empty rows** |
| 4. Supabase CRUD | **MISSING** | Read-only analytics; exports stubbed (`/* Export stubs */`) |
| 5. Realtime | **MISSING** | Not needed for static reports; no refresh strategy beyond query |
| 6. Loading/error | **PASS** | Gate |
| 7. Production-ready | **FAIL** | Shell only — not decision-ready analytics |

### Gaps (FAIL / PARTIAL)
| Gap | Files | Effort |
|-----|-------|--------|
| Implement real report series/tables per section | `LiveAdminApi.reportsSnapshot`, `ReportsSectionGrid` | L (~1–2 weeks) |
| Export CSV/PDF | `ReportsExportActions`, `ReportsPage.tsx` | M |
| Filter options actually drive queries | `ReportsFilters` + API | M |

---

## 9. Settings

| Criterion | Rating | Notes |
|-----------|--------|-------|
| 1. UI | **PASS** | Multi-tab settings shell |
| 2. Navigation | **PASS** | `/settings` |
| 3. Backend API | **PARTIAL** | Snapshot merges `settings` table + live warehouses (`operational_locations`) + service areas; notifications/taxes/roles **empty**; delivery slots **hardcoded** |
| 4. Supabase CRUD | **PARTIAL** | Only company upsert via `useUpsertSettingMutation`; warehouses/areas add/edit/disable handlers are `/* Mutation deferred */` |
| 5. Realtime | **MISSING** | N/A for most settings |
| 6. Loading/error | **PASS** | Gate |
| 7. Production-ready | **PARTIAL** | Company flag OK; rest is display / deferred |

### Gaps
| Gap | Files | Effort |
|-----|-------|--------|
| Warehouse CRUD | `SettingsPage.tsx`, repos | M |
| Service area CRUD (also nav placeholder page) | `SettingsPage.tsx`, `App.tsx` service-areas route | M |
| Persist payments/preferences/slots | Settings sections + upsert keys | M |
| Notifications / taxes / roles data | `LiveAdminApi.settingsSnapshot` | L |
| Service Areas dedicated page is PlaceholderPage | `App.tsx`, `PlaceholderPage.tsx` | M (or link to Settings tab) |

---

## Cross-cutting work to raise readiness

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Keep Orders/Categories/Pricing as-is for pilot | — |
| P1 | Product create + SKU CRUD UI | M–L |
| P1 | Customer create form (no seed UUIDs) | M |
| P1 | Settings deferred mutations for warehouse/area | M |
| P2 | Expand realtime (products, shops, categories, prices) | S–M |
| P2 | Inventory movements UI | L |
| P3 | Reports real queries + export | L |
| P3 | Service Areas real page | M |

---

## Unused / deferred mutation inventory

| Hook / path | Defined | Used by page? |
|-------------|---------|---------------|
| `useCreateProductMutation` | Yes | **No** |
| `useCreateSkuMutation` / update / soft-delete | Yes | **No** |
| `useCreateSalesmanMutation` | Yes | **No** |
| `useCreateCategoryMutation` (+ update/delete) | Yes | **Yes** |
| `useCreatePriceMutation` / close | Yes | **Yes** (detail) |
| `useUpdateInventoryMutation` | Yes | **Yes** (detail) |
| `useUpdateOrderStatusMutation` | Yes | **Yes** |
| `useCreateCustomerMutation` / update | Yes | **Yes** (seeded create) |
| `useCreateDeliveryRouteMutation` / update | Yes | **Yes** (list) |
| `useUpsertSettingMutation` | Yes | **Yes** (company only) |
| Delivery detail mutations | — | Deferred comments |
| Salesman detail mutations | — | Deferred comments |

---

## Verdict

Admin ERP is a **working operational shell with several production-capable modules** (Orders, Categories, Pricing; Inventory/Customers/Products/Dashboard usable with gaps). It is **not fully production-ready as a complete ERP**: Reports are placeholder analytics (**FAIL**), Settings mostly deferred writes (**PARTIAL**), Products lack create/SKU management UI (**PARTIAL**), Service Areas route is still a placeholder (**MISSING**).

**Recommended pilot stance:** Operate with live Orders + Catalogue taxonomy/pricing + limited inventory adjust; treat Reports as non-authoritative; avoid relying on Settings beyond company profile until CRUD is finished.
