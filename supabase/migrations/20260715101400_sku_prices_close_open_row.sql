-- GroAurum B2B: allow closing open sku_prices rows via trusted workflow while keeping history append-only.

CREATE OR REPLACE FUNCTION public.enforce_sku_prices_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Table sku_prices is append-only; DELETE is not permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.sku_id IS DISTINCT FROM NEW.sku_id
      OR OLD.trade_price IS DISTINCT FROM NEW.trade_price
      OR OLD.currency IS DISTINCT FROM NEW.currency
      OR OLD.effective_from IS DISTINCT FROM NEW.effective_from
      OR OLD.recorded_by_profile_id IS DISTINCT FROM NEW.recorded_by_profile_id
    THEN
      RAISE EXCEPTION 'sku_prices commercial fields are append-only; insert a new row instead'
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD.effective_to IS DISTINCT FROM NEW.effective_to THEN
      IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Closing sku_prices rows requires groaurum.trusted_server_action=true'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sku_prices_prevent_update ON public.sku_prices;
DROP TRIGGER IF EXISTS trg_sku_prices_prevent_delete ON public.sku_prices;

CREATE TRIGGER trg_sku_prices_prevent_delete
  BEFORE DELETE ON public.sku_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE TRIGGER trg_sku_prices_append_only
  BEFORE UPDATE ON public.sku_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sku_prices_append_only();

COMMENT ON FUNCTION public.enforce_sku_prices_append_only() IS
  'Append-only trade price history. trusted workflow may set effective_to to close the open row.';
