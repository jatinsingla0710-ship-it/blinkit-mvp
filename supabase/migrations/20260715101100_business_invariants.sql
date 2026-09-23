-- GroAurum B2B: database-level business invariants and immutability guards.

CREATE OR REPLACE FUNCTION public.enforce_delivered_requires_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_status public.payment_status;
BEGIN
  IF NEW.status = 'DELIVERED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.payment_id IS NULL THEN
      RAISE EXCEPTION 'Order % cannot be DELIVERED without a linked payment', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT p.status
    INTO v_payment_status
    FROM public.payments p
    WHERE p.id = NEW.payment_id;

    IF v_payment_status IS DISTINCT FROM 'PAID' THEN
      RAISE EXCEPTION 'Order % cannot be DELIVERED unless payment status is PAID (current: %)',
        NEW.id, v_payment_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_delivered_requires_paid
  BEFORE INSERT OR UPDATE OF status, payment_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delivered_requires_paid();

CREATE TRIGGER trg_audit_logs_prevent_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE TRIGGER trg_audit_logs_prevent_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE TRIGGER trg_inventory_movements_prevent_update
  BEFORE UPDATE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE TRIGGER trg_inventory_movements_prevent_delete
  BEFORE DELETE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE TRIGGER trg_sku_prices_prevent_update
  BEFORE UPDATE ON public.sku_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE TRIGGER trg_sku_prices_prevent_delete
  BEFORE DELETE ON public.sku_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_modification();

CREATE OR REPLACE FUNCTION public.enforce_confirmed_order_line_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_status public.order_status;
BEGIN
  SELECT o.status
  INTO v_order_status
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  IF public.is_order_confirmed_or_later(v_order_status) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete order line for confirmed order %', OLD.order_id
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF TG_OP = 'UPDATE' AND (
      OLD.sku_id IS DISTINCT FROM NEW.sku_id
      OR OLD.product_name_snapshot IS DISTINCT FROM NEW.product_name_snapshot
      OR OLD.sku_name_snapshot IS DISTINCT FROM NEW.sku_name_snapshot
      OR OLD.sku_code_snapshot IS DISTINCT FROM NEW.sku_code_snapshot
      OR OLD.specification_snapshot IS DISTINCT FROM NEW.specification_snapshot
      OR OLD.selling_unit_snapshot IS DISTINCT FROM NEW.selling_unit_snapshot
      OR OLD.quantity IS DISTINCT FROM NEW.quantity
      OR OLD.agreed_unit_price IS DISTINCT FROM NEW.agreed_unit_price
      OR OLD.line_total IS DISTINCT FROM NEW.line_total
    ) THEN
      RAISE EXCEPTION 'Commercial snapshot fields are immutable after order confirmation (order %)',
        NEW.order_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_lines_immutability
  BEFORE UPDATE OR DELETE ON public.order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_confirmed_order_line_immutability();

CREATE OR REPLACE FUNCTION public.enforce_order_status_server_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
      OR OLD.payment_id IS DISTINCT FROM NEW.payment_id
      OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
      OR OLD.adjustments IS DISTINCT FROM NEW.adjustments
      OR OLD.total IS DISTINCT FROM NEW.total
    THEN
      IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Trusted workflow fields on orders require groaurum.trusted_server_action=true'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_trusted_workflow_fields
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_status_server_fields();

CREATE OR REPLACE FUNCTION public.enforce_payment_status_server_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
      OR OLD.collection_method IS DISTINCT FROM NEW.collection_method
      OR OLD.paid_at IS DISTINCT FROM NEW.paid_at
      OR OLD.provider_reference IS DISTINCT FROM NEW.provider_reference
      OR OLD.amount IS DISTINCT FROM NEW.amount
    THEN
      IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Trusted workflow fields on payments require groaurum.trusted_server_action=true'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_trusted_workflow_fields
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_status_server_fields();

COMMENT ON FUNCTION public.enforce_delivered_requires_paid() IS
  'Hard invariant: DELIVERED orders must have payment status PAID.';
COMMENT ON FUNCTION public.enforce_confirmed_order_line_immutability() IS
  'Protects commercial snapshot columns after customer confirmation.';
