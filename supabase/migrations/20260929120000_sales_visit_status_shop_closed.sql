-- Add SHOP_CLOSED to the existing visit status enum.
-- PostgreSQL cannot use a new enum value in the same transaction that adds it,
-- so columns, constraints, and RPCs that reference SHOP_CLOSED are in the next migration.
-- delivery_failure_reason already has SHOP_CLOSED; this does not touch that enum.

ALTER TYPE public.sales_visit_status ADD VALUE IF NOT EXISTS 'SHOP_CLOSED';
