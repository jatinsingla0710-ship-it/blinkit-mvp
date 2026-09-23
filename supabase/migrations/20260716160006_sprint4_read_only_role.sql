-- Sprint 4 / 0022: READ_ONLY staff role for admin ERP observers.
-- Must run outside a transaction block that also uses the new value in policies
-- (Postgres enum quirk). This migration only adds the enum value.

ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'READ_ONLY';

COMMENT ON TYPE public.staff_role IS
  'CUSTOMER | SALESMAN | DELIVERY | ADMIN | READ_ONLY (admin ERP observer, no writes).';
