# RichlyBook progress

Updated: 2026-10-19

This checkout is `origin/main` plus the work on this branch. It does not contain uncommitted Inventory or Product edits from another machine. `apps/admin-web/src/data/live/LiveAdminApi.ts` matches `origin/main` except where this branch does not touch it. Do not treat a cloud workspace as a copy of a developer’s dirty tree.

## Completed in this pass

Cash & Bank now shows a read-only Books check. It calls the existing `LiveAdminApi.arApReconciliation` method and displays Money Due and Money to Pay against Books. Match rules stay in `buildArApReconciliation`. The panel does not post journals or change balances.

- A match says both sides match within the configured tolerance.
- A difference shows domain minus Books, with a plus sign when the business total is higher.
- An incomplete check, including supplier payments that still need a Books journal, is labeled “Not compared” and does not say the books match.
- Non-finite amounts render as an em dash.
- The query key sits under `['groaurum', 'cash-bank']`, so existing cash and bank saves refresh it.
- Mock mode hides the check because there is no live API.

## Test evidence

Command:

```bash
pnpm --filter @groaurum/admin-web exec vitest run \
  src/data/ar-ap-reconciliation-view.test.ts \
  src/components/cash-bank/ArApReconciliationPanel.test.tsx \
  src/data/ar-ap-reconciliation.test.ts \
  src/data/ar-ap-reconciliation-load.test.ts
```

Result: 4 files, 28 tests passed (view 4, panel 1, comparison 13, load 10).

```bash
pnpm --filter @groaurum/admin-web exec tsc -b --pretty false
pnpm --filter @groaurum/admin-web exec eslint \
  src/data/ar-ap-reconciliation-view.ts \
  src/data/ar-ap-reconciliation-view.test.ts \
  src/components/cash-bank/ArApReconciliationPanel.tsx \
  src/components/cash-bank/ArApReconciliationPanel.test.tsx \
  src/pages/cash-bank/CashBankPage.tsx \
  src/data/hooks.ts \
  --config ../../packages/config/eslint.config.mjs
```

Both exited 0.

Not run: workspace-wide `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Those already fail on `main` outside this change (validation typecheck, api-client lint, empty `@groaurum/data` test script). Passing these admin tests is not production readiness. No migration was applied.

## Remaining issues

- Admin still maps `AWAITING_CUSTOMER_CONFIRMATION` to fulfillment status `CONFIRMED` (`order-helpers.ts`, recorded in `phase26-integration-audit.ts`).
- Admin has `recordCustomerAppLinkSent` and no share control on the customer page.
- Customer GST/license documents are still described as unavailable. Bill photos are a separate, already wired path. OCR is not implemented.
- Inventory and product lifecycle gaps in `docs/admin-erp-implementation-audit.md` (July 2026) are older than the current purchase and accounting work. Re-check that audit against `main` before building inventory features. This environment has no extra local inventory diff to preserve.

## Recommended next task

Show `AWAITING_CUSTOMER_CONFIRMATION` as its own admin order state instead of `CONFIRMED`, and update the Phase 26 test that currently locks in the collapsed mapping. Keep pack/deliver/convert RPCs unchanged. Review the order-list filters before shipping, because a new status changes which orders look ready to pack.
