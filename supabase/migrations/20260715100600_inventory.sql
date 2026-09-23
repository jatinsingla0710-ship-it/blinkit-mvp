-- GroAurum B2B: inventory balances, append-only movements, and stock reservations.

CREATE TABLE public.inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  operational_location_id uuid NOT NULL REFERENCES public.operational_locations (id) ON DELETE RESTRICT,
  on_hand_quantity numeric(12, 3) NOT NULL DEFAULT 0,
  reserved_quantity numeric(12, 3) NOT NULL DEFAULT 0,
  available_quantity numeric(12, 3) GENERATED ALWAYS AS (
    GREATEST(on_hand_quantity - reserved_quantity, 0)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_balances_unique_sku_location UNIQUE (sku_id, operational_location_id),
  CONSTRAINT inventory_balances_on_hand_non_negative CHECK (on_hand_quantity >= 0),
  CONSTRAINT inventory_balances_reserved_non_negative CHECK (reserved_quantity >= 0),
  CONSTRAINT inventory_balances_reserved_lte_on_hand CHECK (reserved_quantity <= on_hand_quantity)
);

CREATE INDEX inventory_balances_location_idx
  ON public.inventory_balances (operational_location_id);

CREATE INDEX inventory_balances_sku_idx
  ON public.inventory_balances (sku_id);

CREATE TRIGGER trg_inventory_balances_set_updated_at
  BEFORE UPDATE ON public.inventory_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  operational_location_id uuid NOT NULL REFERENCES public.operational_locations (id) ON DELETE RESTRICT,
  movement_type public.inventory_movement_type NOT NULL,
  quantity_delta numeric(12, 3) NOT NULL,
  reason text,
  reference_type text,
  reference_id uuid,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_quantity_delta_non_zero CHECK (quantity_delta <> 0)
);

CREATE INDEX inventory_movements_sku_location_created_idx
  ON public.inventory_movements (sku_id, operational_location_id, created_at DESC);

CREATE INDEX inventory_movements_reference_idx
  ON public.inventory_movements (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE TABLE public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  operational_location_id uuid NOT NULL REFERENCES public.operational_locations (id) ON DELETE RESTRICT,
  quantity numeric(12, 3) NOT NULL,
  status public.stock_reservation_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_reservations_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX stock_reservations_order_idx ON public.stock_reservations (order_id);
CREATE INDEX stock_reservations_status_idx ON public.stock_reservations (status);
CREATE UNIQUE INDEX stock_reservations_active_per_order_sku
  ON public.stock_reservations (order_id, sku_id, operational_location_id)
  WHERE status IN ('PENDING', 'RESERVED');

CREATE TRIGGER trg_stock_reservations_set_updated_at
  BEFORE UPDATE ON public.stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.inventory_balances IS
  'Current stock position per SKU and ops location. available_quantity is generated.';
COMMENT ON TABLE public.inventory_movements IS
  'Append-only inventory ledger. Balance changes must be reflected via trusted server actions.';
COMMENT ON COLUMN public.stock_reservations.order_id IS
  'FK to orders added after orders table is created.';
