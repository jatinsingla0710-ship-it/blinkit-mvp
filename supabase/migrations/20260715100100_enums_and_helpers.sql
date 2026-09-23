-- GroAurum B2B: domain enums and normalization helpers.

CREATE TYPE public.order_status AS ENUM (
  'DRAFT_ASSISTED',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'CONFIRMED',
  'STOCK_RESERVED',
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'ASSIGNED_TO_ROUTE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED'
);

CREATE TYPE public.payment_status AS ENUM (
  'UNPAID',
  'PAYMENT_PENDING',
  'PAID',
  'FAILED',
  'REFUNDED'
);

CREATE TYPE public.shop_lifecycle_status AS ENUM (
  'LEAD',
  'INVITED',
  'ACTIVATED',
  'FIRST_ORDER',
  'REPEAT_CUSTOMER',
  'INACTIVE_OR_FOLLOW_UP'
);

CREATE TYPE public.staff_role AS ENUM (
  'CUSTOMER',
  'SALESMAN',
  'DELIVERY',
  'ADMIN'
);

CREATE TYPE public.serviceability_rule_type AS ENUM (
  'PIN_CODE',
  'ADMIN_AREA',
  'POLYGON'
);

CREATE TYPE public.inventory_movement_type AS ENUM (
  'RECEIPT',
  'ORDER_DISPATCH',
  'DAMAGE',
  'RETURN',
  'ADMIN_ADJUSTMENT'
);

CREATE TYPE public.stock_reservation_status AS ENUM (
  'PENDING',
  'RESERVED',
  'RELEASED',
  'FULFILLED',
  'FAILED'
);

CREATE TYPE public.payment_method_intent AS ENUM (
  'PAY_ONLINE_NOW',
  'PAY_ON_DELIVERY'
);

CREATE TYPE public.payment_collection_method AS ENUM (
  'ONLINE_GATEWAY',
  'CASH_ON_DELIVERY',
  'UPI_ON_DELIVERY',
  'CARD_ON_DELIVERY',
  'OTHER'
);

CREATE TYPE public.delivery_failure_reason AS ENUM (
  'CUSTOMER_UNAVAILABLE',
  'SHOP_CLOSED',
  'PAYMENT_NOT_AVAILABLE',
  'CUSTOMER_REQUESTED_CREDIT',
  'CUSTOMER_REFUSED_ORDER',
  'ADDRESS_LOCATION_ISSUE',
  'DAMAGED_ORDER_ISSUE',
  'OTHER'
);

CREATE TYPE public.assisted_confirmation_status AS ENUM (
  'PENDING',
  'CUSTOMER_CONFIRMED',
  'CUSTOMER_REQUESTED_CHANGES',
  'CUSTOMER_REJECTED',
  'EXPIRED'
);

CREATE TYPE public.delivery_route_status AS ENUM (
  'DRAFT',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.route_stop_status AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'SKIPPED'
);

CREATE TYPE public.operational_location_kind AS ENUM (
  'OPS_BASE',
  'WAREHOUSE',
  'OTHER'
);

CREATE TYPE public.order_source AS ENUM (
  'CUSTOMER_SELF_SERVE',
  'SALESMAN_ASSISTED'
);

CREATE TYPE public.shop_invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED'
);

CREATE OR REPLACE FUNCTION public.normalize_mobile(p_mobile text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text;
BEGIN
  IF p_mobile IS NULL OR btrim(p_mobile) = '' THEN
    RAISE EXCEPTION 'mobile number must not be null or empty'
      USING ERRCODE = 'check_violation';
  END IF;

  v_digits := regexp_replace(p_mobile, '[^0-9]', '', 'g');

  IF length(v_digits) = 10 THEN
    RETURN '+91' || v_digits;
  ELSIF length(v_digits) = 12 AND left(v_digits, 2) = '91' THEN
    RETURN '+' || v_digits;
  ELSIF length(v_digits) = 11 AND left(v_digits, 1) = '0' THEN
    RETURN '+91' || substr(v_digits, 2);
  ELSIF left(btrim(p_mobile), 1) = '+' AND length(v_digits) BETWEEN 10 AND 15 THEN
    RETURN '+' || v_digits;
  END IF;

  RAISE EXCEPTION 'unsupported mobile format: %', p_mobile
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.normalize_mobile(text) IS
  'Normalize Indian mobile numbers to E.164 (+91XXXXXXXXXX). Used by CHECK constraints and unique indexes.';

CREATE OR REPLACE FUNCTION public.is_order_confirmed_or_later(p_status public.order_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN (
    'CONFIRMED',
    'STOCK_RESERVED',
    'PROCESSING',
    'READY_FOR_DISPATCH',
    'ASSIGNED_TO_ROUTE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERY_FAILED'
  );
$$;

COMMENT ON FUNCTION public.is_order_confirmed_or_later(public.order_status) IS
  'True when an order has passed customer confirmation and commercial snapshots must be immutable.';
