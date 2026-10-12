-- Phase 6B.2C — add PURCHASE_RETURN before schema/RPC that use it.
-- Distinct from customer RETURN and DAMAGE for audit clarity.
ALTER TYPE public.inventory_movement_type ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';
