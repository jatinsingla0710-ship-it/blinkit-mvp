-- Delivery H2: allow Admin ERP to call delivery_complete_route while preserving
-- open-stop validation and COD summary. Delivery executives still require
-- assert_delivery_owns_route (DELIVERY + assigned).

CREATE OR REPLACE FUNCTION public.delivery_complete_route(p_route_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
  v_completed int;
  v_failed int;
  v_cod_expected numeric := 0;
  v_cod_collected numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Admin may close any route; delivery executives only their assigned routes.
  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(p_route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT
    count(*) FILTER (WHERE status IN ('PENDING', 'IN_PROGRESS')),
    count(*) FILTER (WHERE status = 'COMPLETED'),
    count(*) FILTER (WHERE status = 'FAILED')
  INTO v_pending, v_completed, v_failed
  FROM public.route_stops
  WHERE route_id = p_route_id;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Cannot close route: % stop(s) still open', v_pending;
  END IF;

  SELECT
    COALESCE(sum(p.amount) FILTER (
      WHERE p.method_intent = 'PAY_ON_DELIVERY' OR p.collection_method IN (
        'CASH_ON_DELIVERY', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY'
      )
    ), 0),
    COALESCE(sum(p.amount) FILTER (WHERE p.status = 'PAID'), 0)
  INTO v_cod_expected, v_cod_collected
  FROM public.route_stops rs
  LEFT JOIN public.payments p ON p.order_id = rs.order_id
  WHERE rs.route_id = p_route_id;

  UPDATE public.delivery_routes
  SET status = 'COMPLETED',
      updated_at = now()
  WHERE id = p_route_id;

  RETURN jsonb_build_object(
    'routeId', p_route_id,
    'completedDeliveries', v_completed,
    'failedDeliveries', v_failed,
    'codExpected', v_cod_expected,
    'codCollected', v_cod_collected,
    'codPending', GREATEST(v_cod_expected - v_cod_collected, 0),
    'closedAt', now()
  );
END;
$$;

COMMENT ON FUNCTION public.delivery_complete_route(uuid) IS
  'Sprint 8 + Delivery H2: close route when all stops done; return COD summary. Callable by assigned DELIVERY or is_admin().';
