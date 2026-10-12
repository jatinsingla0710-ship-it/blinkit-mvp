-- Phase 6B.2B — add PARTIALLY_RECEIVED before schema/RPC that use it.
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED';
