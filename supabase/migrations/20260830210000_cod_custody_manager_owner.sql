-- COD custody: Delivery Boy → Manager → Owner (separate auditable steps).
-- Depends on 20260830205000_cod_custody_enum_values.sql
-- Preserves Card 5 (OFD unpaid residual) and Card 6 (WITH_DRIVER only).
-- Historical HANDED_TO_COMPANY / RECONCILED → RECEIVED_BY_OWNER (grandfathered).

-- Custody transfer audit (append-only).
CREATE TABLE IF NOT EXISTS public.delivery_cod_custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments (id) ON DELETE SET NULL,
  delivery_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  settlement_id uuid REFERENCES public.delivery_cod_settlements (id) ON DELETE SET NULL,
  from_status public.delivery_cod_custody_status,
  to_status public.delivery_cod_custody_status NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role public.staff_role,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_cod_custody_events_order_idx
  ON public.delivery_cod_custody_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_cod_custody_events_driver_idx
  ON public.delivery_cod_custody_events (delivery_profile_id, created_at DESC);

ALTER TABLE public.delivery_cod_custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cod_custody_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_cod_custody_events_select ON public.delivery_cod_custody_events;
CREATE POLICY delivery_cod_custody_events_select
  ON public.delivery_cod_custody_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_read_only());

DROP POLICY IF EXISTS delivery_cod_custody_events_admin_insert ON public.delivery_cod_custody_events;
CREATE POLICY delivery_cod_custody_events_admin_insert
  ON public.delivery_cod_custody_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.delivery_cod_custody_events TO authenticated;
GRANT INSERT ON public.delivery_cod_custody_events TO authenticated;
GRANT ALL ON public.delivery_cod_custody_events TO service_role;

COMMENT ON TABLE public.delivery_cod_custody_events IS
  'Append-only cash custody handovers: WITH_DRIVER → RECEIVED_BY_MANAGER → RECEIVED_BY_OWNER.';

-- Settlement stage: FROM_DRIVER (manager receive) vs TO_OWNER (owner confirm).
ALTER TABLE public.delivery_cod_settlements
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'FROM_DRIVER';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'delivery_cod_settlements_stage_check'
  ) THEN
    ALTER TABLE public.delivery_cod_settlements
      ADD CONSTRAINT delivery_cod_settlements_stage_check
      CHECK (stage IN ('FROM_DRIVER', 'TO_OWNER'));
  END IF;
END $$;

-- Grandfather prior "settled to company" rows as owner-received (books already closed).
UPDATE public.delivery_cod_custody
SET status = 'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
    updated_at = now()
WHERE status IN (
  'HANDED_TO_COMPANY'::public.delivery_cod_custody_status,
  'RECONCILED'::public.delivery_cod_custody_status
);

UPDATE public.delivery_cod_settlements
SET status = 'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
    stage = 'TO_OWNER'
WHERE status IN (
  'HANDED_TO_COMPANY'::public.delivery_cod_custody_status,
  'RECONCILED'::public.delivery_cod_custody_status
)
OR stage = 'FROM_DRIVER' AND status = 'HANDED_TO_COMPANY'::public.delivery_cod_custody_status;

-- Helper: write custody event
CREATE OR REPLACE FUNCTION public._record_cod_custody_event(
  p_order_id uuid,
  p_payment_id uuid,
  p_delivery_profile_id uuid,
  p_settlement_id uuid,
  p_from public.delivery_cod_custody_status,
  p_to public.delivery_cod_custody_status,
  p_amount numeric,
  p_actor uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.delivery_cod_custody_events (
    order_id, payment_id, delivery_profile_id, settlement_id,
    from_status, to_status, amount, actor_profile_id, actor_role, note
  ) VALUES (
    p_order_id, p_payment_id, p_delivery_profile_id, p_settlement_id,
    p_from, p_to, p_amount, p_actor, 'ADMIN'::public.staff_role,
    nullif(btrim(p_note), '')
  );
END;
$$;

-- Step 1: Manager receives cash from Delivery Boy (WITH_DRIVER → RECEIVED_BY_MANAGER).
-- Keeps function name admin_settle_delivery_cod for API compatibility.
CREATE OR REPLACE FUNCTION public.admin_settle_delivery_cod(
  p_delivery_profile_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement_id uuid;
  v_remaining numeric;
  v_row public.delivery_cod_custody%ROWTYPE;
  v_applied numeric := 0;
  v_orders uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  INSERT INTO public.delivery_cod_settlements (
    delivery_profile_id, amount, reference, note, status, stage, recorded_by_profile_id
  )
  VALUES (
    p_delivery_profile_id, p_amount,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
    'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
    'FROM_DRIVER',
    v_uid
  )
  RETURNING id INTO v_settlement_id;

  v_remaining := p_amount;

  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE delivery_profile_id = p_delivery_profile_id
      AND status = 'WITH_DRIVER'
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    IF v_row.amount <= v_remaining THEN
      UPDATE public.delivery_cod_custody
      SET status = 'RECEIVED_BY_MANAGER',
          settlement_id = v_settlement_id,
          updated_at = now()
      WHERE order_id = v_row.order_id;

      PERFORM public._record_cod_custody_event(
        v_row.order_id, v_row.payment_id, v_row.delivery_profile_id,
        v_settlement_id, 'WITH_DRIVER', 'RECEIVED_BY_MANAGER',
        v_row.amount, v_uid, coalesce(p_note, 'Received from delivery boy')
      );

      v_remaining := v_remaining - v_row.amount;
      v_applied := v_applied + v_row.amount;
      v_orders := array_append(v_orders, v_row.order_id);
    END IF;
  END LOOP;

  IF v_applied = 0 THEN
    RAISE EXCEPTION 'No matching WITH_DRIVER COD custody found for this amount';
  END IF;

  IF v_applied < p_amount THEN
    UPDATE public.delivery_cod_settlements
    SET amount = v_applied,
        note = coalesce(note || ' · ', '') || format('Applied %s of requested %s', v_applied, p_amount)
    WHERE id = v_settlement_id;
  END IF;

  RETURN jsonb_build_object(
    'settlementId', v_settlement_id,
    'appliedAmount', v_applied,
    'orderIds', to_jsonb(v_orders),
    'toStatus', 'RECEIVED_BY_MANAGER',
    'stage', 'FROM_DRIVER'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_settle_delivery_cod(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_settle_delivery_cod(uuid, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_settle_delivery_cod(uuid, numeric, text, text) IS
  'Manager/Admin receives cash from Delivery Boy: WITH_DRIVER → RECEIVED_BY_MANAGER. Does NOT equal Owner receipt.';

-- Step 2: Owner confirms company funds (RECEIVED_BY_MANAGER → RECEIVED_BY_OWNER).
CREATE OR REPLACE FUNCTION public.admin_confirm_owner_cod_receipt(
  p_delivery_profile_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement_id uuid;
  v_remaining numeric;
  v_row public.delivery_cod_custody%ROWTYPE;
  v_applied numeric := 0;
  v_orders uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  INSERT INTO public.delivery_cod_settlements (
    delivery_profile_id, amount, reference, note, status, stage, recorded_by_profile_id
  )
  VALUES (
    p_delivery_profile_id, p_amount,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
    'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
    'TO_OWNER',
    v_uid
  )
  RETURNING id INTO v_settlement_id;

  v_remaining := p_amount;

  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE delivery_profile_id = p_delivery_profile_id
      AND status = 'RECEIVED_BY_MANAGER'
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    IF v_row.amount <= v_remaining THEN
      UPDATE public.delivery_cod_custody
      SET status = 'RECEIVED_BY_OWNER',
          settlement_id = v_settlement_id,
          updated_at = now()
      WHERE order_id = v_row.order_id;

      PERFORM public._record_cod_custody_event(
        v_row.order_id, v_row.payment_id, v_row.delivery_profile_id,
        v_settlement_id, 'RECEIVED_BY_MANAGER', 'RECEIVED_BY_OWNER',
        v_row.amount, v_uid, coalesce(p_note, 'Confirmed by owner / company')
      );

      v_remaining := v_remaining - v_row.amount;
      v_applied := v_applied + v_row.amount;
      v_orders := array_append(v_orders, v_row.order_id);
    END IF;
  END LOOP;

  IF v_applied = 0 THEN
    RAISE EXCEPTION 'No matching RECEIVED_BY_MANAGER COD custody found for this amount';
  END IF;

  IF v_applied < p_amount THEN
    UPDATE public.delivery_cod_settlements
    SET amount = v_applied,
        note = coalesce(note || ' · ', '') || format('Applied %s of requested %s', v_applied, p_amount)
    WHERE id = v_settlement_id;
  END IF;

  RETURN jsonb_build_object(
    'settlementId', v_settlement_id,
    'appliedAmount', v_applied,
    'orderIds', to_jsonb(v_orders),
    'toStatus', 'RECEIVED_BY_OWNER',
    'stage', 'TO_OWNER'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_owner_cod_receipt(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_confirm_owner_cod_receipt(uuid, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_confirm_owner_cod_receipt(uuid, numeric, text, text) IS
  'Owner/company confirms funds: RECEIVED_BY_MANAGER → RECEIVED_BY_OWNER. Cannot skip FROM_DRIVER step.';

-- Prevent cash re-record / upserts from downgrading manager/owner custody.
CREATE OR REPLACE FUNCTION public._cod_custody_block_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN (
    'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
    'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
    'HANDED_TO_COMPANY'::public.delivery_cod_custody_status,
    'RECONCILED'::public.delivery_cod_custody_status
  ) AND NEW.status = 'WITH_DRIVER'::public.delivery_cod_custody_status THEN
    NEW.status := OLD.status;
  END IF;

  -- Never allow skipping Manager: cannot jump WITH_DRIVER → OWNER.
  IF OLD.status = 'WITH_DRIVER'::public.delivery_cod_custody_status
     AND NEW.status = 'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status THEN
    RAISE EXCEPTION 'Cannot mark Owner receipt while cash is still with Delivery Boy — Manager must receive first';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cod_custody_block_downgrade ON public.delivery_cod_custody;
CREATE TRIGGER trg_cod_custody_block_downgrade
  BEFORE UPDATE OF status ON public.delivery_cod_custody
  FOR EACH ROW
  EXECUTE FUNCTION public._cod_custody_block_downgrade();

COMMENT ON FUNCTION public._cod_custody_block_downgrade() IS
  'Enforces WITH_DRIVER → RECEIVED_BY_MANAGER → RECEIVED_BY_OWNER; never auto-equate Manager receipt to Owner.';
