-- GroAurum B2B: payments and payment events. Zero-credit model — no CREDIT method or status.

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  status public.payment_status NOT NULL DEFAULT 'UNPAID',
  method_intent public.payment_method_intent NOT NULL,
  collection_method public.payment_collection_method,
  amount numeric(12, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'INR',
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_unique_order UNIQUE (order_id),
  CONSTRAINT payments_currency_uppercase CHECK (currency = upper(currency)),
  CONSTRAINT payments_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT payments_paid_requires_paid_at CHECK (
    status <> 'PAID' OR paid_at IS NOT NULL
  ),
  CONSTRAINT payments_paid_requires_collection_method CHECK (
    status <> 'PAID' OR collection_method IS NOT NULL
  ),
  CONSTRAINT payments_unpaid_no_collection_method CHECK (
    status IN ('UNPAID', 'PAYMENT_PENDING', 'FAILED') OR collection_method IS NOT NULL
  ),
  CONSTRAINT payments_method_intent_allowed CHECK (
    method_intent IN ('PAY_ONLINE_NOW', 'PAY_ON_DELIVERY')
  )
);

CREATE INDEX payments_status_idx ON public.payments (status);
CREATE INDEX payments_method_intent_idx ON public.payments (method_intent);

CREATE TRIGGER trg_payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments (id) ON DELETE SET NULL;

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
  from_status public.payment_status,
  to_status public.payment_status NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role public.staff_role,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_status_changed CHECK (
    from_status IS DISTINCT FROM to_status
  )
);

CREATE INDEX payment_events_payment_created_idx
  ON public.payment_events (payment_id, created_at DESC);

COMMENT ON TABLE public.payments IS
  'Payment record per order. method_intent is customer choice; collection_method records how cash was collected when PAID.';
COMMENT ON COLUMN public.payments.method_intent IS
  'Allowed values only: PAY_ONLINE_NOW, PAY_ON_DELIVERY. No credit terms.';
