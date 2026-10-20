# RichlyBook progress

Updated: 2026-10-20

Branch `cursor/arap-books-check-9515` tracks `origin/cursor/arap-books-check-9515`. It is `origin/main` (`e8243dd`) plus the commits on this branch. The working tree was clean at the 2026-10-20 checkpoint. This environment has no stash and no extra worktree.

`apps/admin-web/src/data/live/LiveAdminApi.ts` differs from `origin/main` only in the order-status work below: processing counts, status-filter labels, and the Confirmed timeline stamp. There is no Inventory or Product diff in that file on this branch. Uncommitted Inventory or Product edits from another machine are not in this checkout, this branch, or `origin/main`. Do not treat a cloud workspace as a copy of a developer’s dirty tree.

## Completed in this pass

### Cash & Bank Books check

Cash & Bank shows a read-only Books check. It calls the existing `LiveAdminApi.arApReconciliation` method and displays Money Due and Money to Pay against Books. Match rules stay in `buildArApReconciliation`. The panel does not post journals or change balances.

- A match says both sides match within the configured tolerance.
- A difference shows domain minus Books, with a plus sign when the business total is higher.
- An incomplete check, including supplier payments that still need a Books journal, is labeled “Not compared” and does not say the books match.
- Non-finite amounts render as an em dash.
- The query key sits under `['groaurum', 'cash-bank']`, so existing cash and bank saves refresh it.
- Mock mode hides the check because there is no live API.

### Admin pre-approval order statuses

`AWAITING_CUSTOMER_CONFIRMATION` and `DRAFT_ASSISTED` are their own admin fulfillment statuses. They no longer use the Confirmed badge.

- Labels are “Awaiting customer confirmation” and “Draft”.
- Pending and Processing lists exclude both. The Awaiting Approval list still includes them by database status.
- The detail timeline stays on Order Received. Confirmed stays upcoming, and the detail loader does not invent a Confirmed timestamp from `created_at`.
- The next action remains Approve Order. Pack, deliver, and convert RPCs are unchanged.
- Live status filter options use `fulfillmentStatusLabel`.

### Customer document empty state

`CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL` no longer says the schema has no document store. The unused documents tab says GST and other uploads are not offered, and points at bill photos. No upload flow was added. The view-model comment in `customer-documents.ts` now says bill photos upload from the customer page.

### Sales list price vs server preview

The salesman catalogue still shows the current trade price before a quantity is chosen. After a successful server preview, if that preview’s pack price differs from the list pack price by at least ₹0.01, the card says this quantity uses a different price than the list price. The note does not load tiers, pick a “from” price, or recompute the line total.

## July 2026 audit vs this branch

`docs/admin-erp-implementation-audit.md` (2026-07-18) is not a current gap list. Checked on this branch, which matches `origin/main` for these modules:

- Product create and SKU create are used (`ProductFormModal`, `ProductSkusTab`). The audit said those hooks were unused.
- Inventory adjustment and a movement timeline exist (`InventoryAdjustForm`, `MovementHistoryTimeline`, `inventory_movements` reads). The audit said there was no movement ledger UX.
- Customer create uses the service-area form (`CustomerFormModal`), not a hardcoded seed UUID.
- Service Areas is `ServiceAreasListPage` at `/service-areas`, not `PlaceholderPage`.
- Reports are separate live pages (sales, stock valuation, P&L, balance sheet, and others). The audit’s “all charts are placeholder” verdict does not describe this tree.
- `useCreateSalesmanMutation` throws on purpose and tells the caller to use provision. That is not an unfinished insert button.

Inventory code was not changed. The missing desktop diff is still unknown, so this reconciliation does not authorize new inventory behavior.

## Test evidence

Books check:

```bash
pnpm --filter @groaurum/admin-web exec vitest run \
  src/data/ar-ap-reconciliation-view.test.ts \
  src/components/cash-bank/ArApReconciliationPanel.test.tsx \
  src/data/ar-ap-reconciliation.test.ts \
  src/data/ar-ap-reconciliation-load.test.ts
```

Result: 4 files, 28 tests passed (view 4, panel 1, comparison 13, load 10).

Order status, then the full admin suite after both changes:

```bash
pnpm --filter @groaurum/admin-web exec vitest run \
  src/data/orders-awaiting-status.test.ts \
  src/data/phase26-integration-audit.test.ts \
  src/data/orders-h1-workflow.test.ts \
  src/data/order-lifecycle-next-action.test.ts \
  src/data/order-attention.test.ts \
  src/data/orders-h1-create-contract.test.ts \
  src/data/order-lifecycle-api.test.ts
```

Result: 7 files, 46 tests passed.

```bash
pnpm --filter @groaurum/admin-web exec tsc -b --pretty false
pnpm --filter @groaurum/admin-web exec eslint \
  src/data/orders-types.ts \
  src/data/order-helpers.ts \
  src/data/orders-awaiting-status.test.ts \
  src/data/phase26-integration-audit.ts \
  src/data/phase26-integration-audit.test.ts \
  src/components/orders/OrderStatusBadges.tsx \
  src/data/live/LiveAdminApi.ts \
  src/data/ar-ap-reconciliation-view.ts \
  src/data/ar-ap-reconciliation-view.test.ts \
  src/components/cash-bank/ArApReconciliationPanel.tsx \
  src/components/cash-bank/ArApReconciliationPanel.test.tsx \
  src/pages/cash-bank/CashBankPage.tsx \
  src/data/hooks.ts \
  --config ../../packages/config/eslint.config.mjs
pnpm --filter @groaurum/admin-web exec vitest run
```

`tsc` and `eslint` exited 0. Admin vitest: 122 files, 675 tests passed.

Not run: workspace-wide `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Those already fail on `main` outside this change (validation typecheck, api-client lint, empty `@groaurum/data` test script). Passing these admin tests is not production readiness. No migration was applied. No shared or production Supabase was contacted.

## Remaining issues

- Admin share of the customer app still has no page control. `buildCustomerAppWhatsappMessage` requires a real app URL. This repo does not define one. Do not invent a production URL.
- `customer_documents` allows `BILL_PHOTO`, `GST`, and `OTHER`. Admin only offers bill photos. `CustomerDocumentsTab` is unused; its empty state no longer claims the schema has no document store. OCR is not implemented. Choosing a GST upload flow still needs a product decision.
- Canonical primary staff role when a profile has several roles is still a Phase 26 P0 and needs a business rule before code changes.
- `PACKING` in the admin view and `PROCESSING` in the database remain different words for the same stage.
- The July 2026 audit is reconciled above and is not a build list. Inventory behavior on this branch is still `origin/main`. The earlier desktop Inventory/Product diff is not here.

## Test evidence for the document copy

```bash
pnpm --filter @groaurum/admin-web exec vitest run \
  src/data/customers-h1-honesty.test.ts \
  src/pages/customers/CustomerDetailPage.test.tsx
pnpm --filter @groaurum/admin-web exec eslint \
  src/data/customers-helpers.ts \
  src/data/customers-h1-honesty.test.ts \
  src/components/customers/CustomerDocumentsTab.tsx \
  --config ../../packages/config/eslint.config.mjs
```

Result: 2 files, 16 tests passed. eslint exited 0. Full admin vitest was not re-run after this copy-only change. The earlier full run was 122 files, 675 tests, before this copy edit.

## Test evidence for the sales price note

```bash
pnpm --filter @groaurum/sales-pwa exec vitest run
pnpm --filter @groaurum/sales-pwa exec tsc -b --pretty false
pnpm --filter @groaurum/sales-pwa exec eslint \
  src/data/catalogue-price-note.ts \
  src/data/catalogue-price-note.test.ts \
  src/pages/create-order/CatalogueList.tsx \
  src/pages/CreateOrderPage.test.tsx \
  --config ../../packages/config/eslint.config.mjs
```

Result: 39 files, 258 tests passed. `tsc` and eslint exited 0. The catalogue cases include a ₹165.50 preview against a ₹166 list price, and a ₹166 preview that stays quiet.

## Recommended next task

Leave these for a person: a real customer-app URL, the primary role when a profile has several staff roles, and which non-bill document types Admin should upload. Do not edit inventory behavior until the owner confirms the missing desktop diff is abandoned or restored. `PACKING` versus `PROCESSING` is still a vocabulary split. Do not apply migrations or deploy from this branch.
