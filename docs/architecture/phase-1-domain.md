# Phase 1: GroAurum B2B Domain and Service Boundaries

Phase 1 introduces the target B2B domain model and service adapter contracts while preserving the runnable consumer MVP.

**Checkpoint preserved:** `18ee50a`

## What Phase 1 adds

### Domain model (`domain/`)

Domain-focused modules replace a single monolithic types file:

| Module | Purpose |
|--------|---------|
| `enums.ts` | Extensible product types, selling units, lifecycle, roles |
| `service-area.ts` | ServiceArea + extensible ServiceabilityRule configs |
| `operational-location.ts` | Ops base / warehouse locations |
| `shop.ts` | Shop, contacts, invitations, auth links |
| `staff.ts` | Staff profiles and roles |
| `catalog.ts` | Category, Product, Sku, pricing + SKU config helpers |
| `inventory.ts` | Balance, movement ledger, reservations |
| `order.ts` | Order states, snapshot OrderLine, events, assisted challenge |
| `payment.ts` | Payment states and events (separate from order status) |
| `delivery.ts` | Routes, stops, delivery attempts |
| `audit.ts` | Append-only audit log |
| `policies/` | Testable order and payment transition policies |

### Service areas (extensible membership)

`ServiceArea` is the primary business entity. Membership rules are modeled separately via `ServiceabilityRule` with extensible `config`:

- `PIN_CODE` — initial Gurugram cluster expansion
- `ADMIN_AREA` — future administrative mapping
- `POLYGON` — future geofence reference (not implemented in Phase 1)

### Catalogue (SKU-driven configuration)

Launch examples `PACKED` / `BULK` and `CARTON` / `KG` are domain values on `Sku`. UI and services should reason from `Sku` configuration via helpers such as `getSkuOrderConstraints()` rather than scattering product-type conditionals.

### Inventory ledger (types only)

- `InventoryBalance` — on-hand, reserved, available (derived)
- `InventoryMovement` — append-only ledger
- `StockReservation` — order-linked reservations

No inventory persistence is implemented in Phase 1.

### Transition policies

Pure domain logic in `domain/policies/`:

- `canTransitionOrder(from, to, context)`
- `canTransitionPayment(from, to, context)`

Critical invariant: **DELIVERED requires payment status PAID**.

Clients must not set `isTrustedServerAction: true`. Trusted transitions will be enforced server-side in later phases.

### Service contracts (`services/contracts/`)

Interfaces for future Supabase/Edge Function implementations:

- Catalogue, ServiceArea, Shop, Auth/shop linking
- Order, Assisted order confirmation, Payment
- Inventory, Delivery route

### Adapter boundary (`services/`)

```
services/
  contracts/          # B2B interfaces
  adapters/
    legacy-mvp/       # documents current mock port (screens still use services/mock)
    not-implemented.ts
  mock/               # unchanged runnable consumer MVP mock
  index.ts            # b2b.* contracts + legacyMvp port
```

Current screens continue importing `@/services/mock` directly. The boundary is ready for Phase 3 cutover.

### Legacy MVP types (`types/index.ts`)

Unchanged consumer types remain for runnable screens. New B2B types live in `domain/`.

## What Phase 1 does not do

- No monorepo move
- No Supabase provisioning or connection
- No UI redesign
- No removal of mock implementation
- No Sales/Delivery/Admin apps
- No hard-coded launch products

## Tests

```bash
npm run test
```

Covers order/payment transition policies and SKU configuration helpers.

## Next step (Phase 2+)

After approval: monorepo scaffold, Supabase migrations, then replace `not-implemented` adapters with database-backed implementations.
