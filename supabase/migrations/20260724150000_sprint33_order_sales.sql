-- Sprint 3.3: Order → Sale conversion (invoice register without duplicating lines).

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  converted_at timestamptz NOT NULL DEFAULT now(),
  converted_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoice_number_not_blank CHECK (char_length(btrim(invoice_number)) > 0)
);

CREATE UNIQUE INDEX sales_order_id_unique ON public.sales (order_id);
CREATE UNIQUE INDEX sales_invoice_number_unique
  ON public.sales (lower(btrim(invoice_number)));

CREATE INDEX sales_converted_at_idx ON public.sales (converted_at DESC);

CREATE TRIGGER trg_sales_set_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.sales IS
  'Sale records created from confirmed/dispatched orders. Line items stay on order_lines.';

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales FORCE ROW LEVEL SECURITY;

CREATE POLICY sales_admin_all
  ON public.sales
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
