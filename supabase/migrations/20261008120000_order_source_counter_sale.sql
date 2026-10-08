-- RichlyBook 2.0: add COUNTER_SALE order source.
-- Must be a separate migration from code that uses the new enum value
-- (PostgreSQL cannot use a newly added enum label in the same transaction).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'order_source'
      AND e.enumlabel = 'COUNTER_SALE'
  ) THEN
    ALTER TYPE public.order_source ADD VALUE 'COUNTER_SALE';
  END IF;
END $$;
