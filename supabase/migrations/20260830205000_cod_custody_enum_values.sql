-- Add COD custody enum values (must commit before use in later migration).
-- Used by 20260830210000_cod_custody_manager_owner.sql

ALTER TYPE public.delivery_cod_custody_status ADD VALUE IF NOT EXISTS 'RECEIVED_BY_MANAGER';
ALTER TYPE public.delivery_cod_custody_status ADD VALUE IF NOT EXISTS 'RECEIVED_BY_OWNER';
