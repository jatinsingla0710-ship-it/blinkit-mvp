# RichlyBook progress

Updated: 2026-10-19

This checkout is `origin/main` plus the work on `cursor/arap-books-check-9515`. It does not contain uncommitted Inventory or Product edits from another machine. `apps/admin-web/src/data/live/LiveAdminApi.ts` matches `origin/main` except for the Cash & Bank query wiring already on this branch and the order-status label/count changes below. Do not treat a cloud workspace as a copy of a developer’s dirty tree.

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
- `CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL` still says no document store exists. `customer_documents` and bill photos are already wired. `CustomerDocumentsTab` is unused. GST and license upload UI is still absent. OCR is not implemented.
- Canonical primary staff role when a profile has several roles is still a Phase 26 P0 and needs a business rule before code changes.
- `PACKING` in the admin view and `PROCESSING` in the database remain different words for the same stage.
- Inventory and product lifecycle gaps in `docs/admin-erp-implementation-audit.md` (July 2026) are older than the current purchase and accounting work. Re-check that audit against `main` before building inventory features. This environment has no extra local inventory diff to preserve.

## Recommended next task

Replace the unused customer-documents empty state so it no longer claims the schema has no document store. Keep GST and license upload unwired until someone chooses which document types Admin should accept. Leave the customer-app share button until an app URL is provided.
