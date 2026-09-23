-- GroAurum B2B: orders, immutable line snapshots, events, and assisted confirmation challenges.

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'DRAFT_ASSISTED',
  source public.order_source NOT NULL,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  payment_id uuid,
  service_area_id uuid NOT NULL REFERENCES public.service_areas (id) ON DELETE RESTRICT,
  expected_delivery_at timestamptz,
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  adjustments numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_currency_uppercase CHECK (currency = upper(currency)),
  CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT orders_total_non_negative CHECK (total >= 0),
  CONSTRAINT orders_total_matches_components CHECK (total = subtotal + adjustments)
);

CREATE INDEX orders_shop_created_idx ON public.orders (shop_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE INDEX orders_service_area_idx ON public.orders (service_area_id);
CREATE INDEX orders_payment_idx ON public.orders (payment_id) WHERE payment_id IS NOT NULL;

CREATE TRIGGER trg_orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL,
  sku_name_snapshot text NOT NULL,
  sku_code_snapshot text NOT NULL,
  specification_snapshot text,
  selling_unit_snapshot text NOT NULL,
  quantity numeric(12, 3) NOT NULL,
  agreed_unit_price numeric(12, 2) NOT NULL,
  line_total numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_lines_agreed_unit_price_non_negative CHECK (agreed_unit_price >= 0),
  CONSTRAINT order_lines_line_total_non_negative CHECK (line_total >= 0),
  CONSTRAINT order_lines_line_total_matches CHECK (
    line_total = round(quantity * agreed_unit_price, 2)
  ),
  CONSTRAINT order_lines_selling_unit_snapshot_not_blank CHECK (
    char_length(btrim(selling_unit_snapshot)) > 0
  )
);

CREATE INDEX order_lines_order_idx ON public.order_lines (order_id);
CREATE INDEX order_lines_sku_idx ON public.order_lines (sku_id);
CREATE UNIQUE INDEX order_lines_unique_sku_per_order
  ON public.order_lines (order_id, sku_id);

CREATE TRIGGER trg_order_lines_set_updated_at
  BEFORE UPDATE ON public.order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role public.staff_role,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_events_status_changed CHECK (
    from_status IS DISTINCT FROM to_status
  )
);

CREATE INDEX order_events_order_created_idx
  ON public.order_events (order_id, created_at DESC);

CREATE TABLE public.order_confirmation_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  token text NOT NULL,
  status public.assisted_confirmation_status NOT NULL DEFAULT 'PENDING',
  payment_method_intent public.payment_method_intent,
  otp_hash text,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_confirmation_challenges_token_not_blank CHECK (
    char_length(btrim(token)) >= 16
  ),
  CONSTRAINT order_confirmation_challenges_otp_hash_not_plaintext CHECK (
    otp_hash IS NULL OR (
      char_length(otp_hash) >= 32
      AND otp_hash !~ '^[0-9]{4,8}$'
    )
  ),
  CONSTRAINT order_confirmation_challenges_confirmed_at_consistency CHECK (
    (status = 'CUSTOMER_CONFIRMED' AND confirmed_at IS NOT NULL)
    OR (status <> 'CUSTOMER_CONFIRMED' AND confirmed_at IS NULL)
  )
);

CREATE UNIQUE INDEX order_confirmation_challenges_token_unique
  ON public.order_confirmation_challenges (token);

CREATE INDEX order_confirmation_challenges_order_idx
  ON public.order_confirmation_challenges (order_id);

CREATE INDEX order_confirmation_challenges_pending_idx
  ON public.order_confirmation_challenges (order_id, expires_at)
  WHERE status = 'PENDING';

CREATE TRIGGER trg_order_confirmation_challenges_set_updated_at
  BEFORE UPDATE ON public.order_confirmation_challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stock_reservations
  ADD CONSTRAINT stock_reservations_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE CASCADE;

COMMENT ON TABLE public.orders IS
  'Commercial order header. Order status is independent from payment status.';
COMMENT ON TABLE public.order_lines IS
  'Line snapshots captured at confirmation. Snapshot columns must not change after CONFIRMED.';
COMMENT ON COLUMN public.order_confirmation_challenges.otp_hash IS
  'Hashed OTP only — never store plaintext OTP values.';
