# RichlyBook progress

Updated: 2026-10-20

Branch `cursor/agent-development-process-03c8` is based on `cursor/arap-books-check-9515` (itself `origin/main` `e8243dd` plus earlier work on this line). This pass added a supplier outstanding report. No Inventory or Product behavior was changed. Uncommitted Inventory or Product edits from another machine are not in this checkout. Do not treat a cloud workspace as a copy of a developer’s dirty tree.

## Completed in this pass

### Supplier Outstanding report

Reports now has **Supplier Outstanding** at `/reports/supplier-outstanding`. It reads the existing `useSupplierPayablesSnapshotQuery` / supplier ledger snapshot. It does not post journals, change balances, or invent a second payable total.

- Filtered **To pay** is the sum of positive outstanding only, matching Money to Pay snapshot semantics.
- Supplier credit is shown separately and is not treated as cash to recover.
- Ageing buckets reuse `summarizeAgeingOutstanding` on the full snapshot rows (same calendar-day buckets as customer AR).
- CSV export uses the filtered table rows, including signed outstanding and supplier credit.
- The hub card and route sit next to Customer Outstanding. Mock vs live follows the existing payables query.

### Earlier work on this line (unchanged)

- Cash & Bank read-only Books check (`buildArApReconciliation`).
- Admin pre-approval order statuses kept out of Confirmed.
- Customer document empty-state copy.
- Sales list vs server preview price note.

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

Supplier outstanding:

```bash
pnpm --filter @groaurum/admin-web exec vitest run \
  src/data/financial-reports.test.ts \
  src/pages/reports/SupplierOutstandingReportPage.test.tsx
pnpm --filter @groaurum/admin-web exec tsc -b --pretty false
pnpm --filter @groaurum/admin-web exec eslint \
  src/data/financial-reports.ts \
  src/data/financial-reports.test.ts \
  src/pages/reports/SupplierOutstandingReportPage.tsx \
  src/pages/reports/SupplierOutstandingReportPage.test.tsx \
  src/App.tsx \
  --config ../../packages/config/eslint.config.mjs
pnpm --filter @groaurum/admin-web exec vitest run
```

Result: targeted tests 2 files, 20 tests passed. `tsc` and `eslint` exited 0. Full admin vitest: 123 files, 678 tests passed.

Not run: workspace-wide `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Those already fail on `main` outside this change (validation typecheck, api-client lint, empty `@groaurum/data` test script). Passing these admin tests is not production readiness. No migration was applied. No shared or production Supabase was contacted.

Changed files:

- `apps/admin-web/src/data/financial-reports.ts`
- `apps/admin-web/src/data/financial-reports.test.ts`
- `apps/admin-web/src/pages/reports/SupplierOutstandingReportPage.tsx`
- `apps/admin-web/src/pages/reports/SupplierOutstandingReportPage.test.tsx`
- `apps/admin-web/src/App.tsx`
- `docs/richlybook-progress.md`

## Remaining issues

- Admin share of the customer app still has no page control. `buildCustomerAppWhatsappMessage` requires a real app URL. This repo does not define one. Do not invent a production URL.
- `customer_documents` allows `BILL_PHOTO`, `GST`, and `OTHER`. Admin only offers bill photos. `CustomerDocumentsTab` is unused; its empty state no longer claims the schema has no document store. OCR is not implemented. Choosing a GST upload flow still needs a product decision.
- Canonical primary staff role when a profile has several roles is still a Phase 26 P0 and needs a business rule before code changes.
- `PACKING` in the admin view and `PROCESSING` in the database remain different words for the same stage.
- The July 2026 audit is reconciled above and is not a build list. Inventory behavior on this branch is still `origin/main`. The earlier desktop Inventory/Product diff is not here.

## Recommended next task

Leave these for a person: a real customer-app URL, the primary role when a profile has several staff roles, and which non-bill document types Admin should upload. Do not edit inventory behavior until the owner confirms the missing desktop diff is abandoned or restored. `PACKING` versus `PROCESSING` is still a vocabulary split. Do not apply migrations or deploy from this branch.

A later low-risk reporting pass could add a Books check note on Receivables/Payables (read-only, same `arApReconciliation` query already used on Cash & Bank), without changing match rules.
