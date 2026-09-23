# GroAurum SQL Migration Index

Supabase CLI requires timestamped filenames. Logical Sprint numbers map as follows.

| No. | File | Purpose |
|-----|------|---------|
| 0001 | `20260715100000_extensions.sql` | Extensions |
| 0002 | `20260715100100_enums_and_helpers.sql` | Enums + helpers |
| 0003 | `20260715100200_profiles.sql` | `profiles` (user_profiles) |
| 0004 | `20260715100300_service_territory.sql` | `service_areas`, locations |
| 0005 | `20260715100400_shops.sql` | `shops` (customers), contacts |
| 0006 | `20260715100500_catalogue.sql` | categories, products, skus, sku_prices |
| 0007 | `20260715100600_inventory.sql` | inventory balances + movements |
| 0008 | `20260715100700_orders.sql` | orders + order_lines |
| 0009 | `20260715100800_payments.sql` | payments |
| 0010 | `20260715100900_delivery.sql` | delivery_routes + stops |
| 0011 | `20260715101000_audit.sql` | audit_logs |
| 0012 | `20260715101100_business_invariants.sql` | DB invariants |
| 0013 | `20260715101200_rls_enable.sql` | Enable RLS |
| 0014 | `20260715101300_rls_policies.sql` | Admin / Salesman / Delivery / Customer |
| 0015 | `20260715101400_sku_prices_close_open_row.sql` | Price close helper |
| 0016 | `20260715101500_api_role_grants.sql` | Grants |
| 0017 | `20260716160001_sprint4_soft_delete.sql` | Soft-delete columns |
| 0018 | `20260716160002_sprint4_product_images.sql` | `product_images` |
| 0019 | `20260716160003_sprint4_customer_addresses.sql` | `customer_addresses` |
| 0020 | `20260716160004_sprint4_settings_and_reports.sql` | `settings`, `reports_snapshot` |
| 0021 | `20260716160005_sprint4_compat_views.sql` | Alias views |
| 0022 | `20260716160006_sprint4_read_only_role.sql` | `READ_ONLY` staff role |
| 0023 | `20260716160007_sprint4_rls_extensions.sql` | RLS for new tables + read-only |
| 0024 | `20260716170001_sprint51_admin_write_policies.sql` | Admin write policies for ERP CRUD |
| 0025 | `20260716180001_sprint6_customer_rpcs.sql` | Customer invitation accept + place order RPCs |
| 0026 | `20260716190001_sprint7_salesman_visits_and_rpcs.sql` | Sales visits + salesman create/invite/assisted-order RPCs |
| 0027 | `20260716200001_sprint8_delivery_rpcs.sql` | Delivery confirmation fields + start/complete/fail/COD/close RPCs |
| 0028 | `20260716210001_sprint9_production_services.sql` | Payments webhook RPCs, notification outbox, jobs, logs, audit helpers |
| 0029 | `20260716220001_sprint91_blocker_closure.sql` | pg_cron schedules, admin order status RPC, enqueue tighten, realtime publication |
| 0030 | `20260716220002_sprint91_place_order_trusted_guc.sql` | place_customer_order sets trusted GUC for status updates |

Phase 2 Sprint 4 adds **0017–0023** on top of the production schema from Phase 2 / 2.5.
Sprint 5.1 adds **0024** so Admin JWT mutations succeed under RLS.
Sprint 6 adds **0025** for customer invitation + self-serve order placement.
Sprint 7 adds **0026** for salesman visits + field RPCs.
Sprint 8 adds **0027** for delivery executive field RPCs.
Sprint 9 adds **0028** for production services (payments/notifications/jobs/audit/logs).
Sprint 9.1 adds **0029–0030** for cron, admin status RPC, security/realtime closure, place-order trusted GUC.

