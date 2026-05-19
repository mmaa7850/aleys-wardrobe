-- ================================================================
-- Migration: cart_stock_functions.sql
-- 加入購物車時原子性扣庫存 / 還庫存
-- 庫存扣除時機改為「加入購物車」，不再於付款成功後才扣
-- ================================================================

-- ── public schema ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.decrement_stock(p_variant_id bigint, p_qty int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock int;
BEGIN
  -- FOR UPDATE 鎖定該列，防止同時多人搶同一庫存
  SELECT "StockQty" INTO v_stock
  FROM public."C_PRD_ProductVariantList"
  WHERE "ID" = p_variant_id
  FOR UPDATE;

  IF v_stock IS NULL OR v_stock < p_qty THEN
    RETURN false;
  END IF;

  UPDATE public."C_PRD_ProductVariantList"
  SET "StockQty" = "StockQty" - p_qty
  WHERE "ID" = p_variant_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_stock(p_variant_id bigint, p_qty int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public."C_PRD_ProductVariantList"
  SET "StockQty" = "StockQty" + p_qty
  WHERE "ID" = p_variant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_stock(bigint, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_stock(bigint, int)   TO anon, authenticated, service_role;

-- ── staging schema ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION staging.decrement_stock(p_variant_id bigint, p_qty int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staging
AS $$
DECLARE
  v_stock int;
BEGIN
  SELECT "StockQty" INTO v_stock
  FROM staging."C_PRD_ProductVariantList"
  WHERE "ID" = p_variant_id
  FOR UPDATE;

  IF v_stock IS NULL OR v_stock < p_qty THEN
    RETURN false;
  END IF;

  UPDATE staging."C_PRD_ProductVariantList"
  SET "StockQty" = "StockQty" - p_qty
  WHERE "ID" = p_variant_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION staging.restore_stock(p_variant_id bigint, p_qty int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staging
AS $$
BEGIN
  UPDATE staging."C_PRD_ProductVariantList"
  SET "StockQty" = "StockQty" + p_qty
  WHERE "ID" = p_variant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION staging.decrement_stock(bigint, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION staging.restore_stock(bigint, int)   TO anon, authenticated, service_role;
