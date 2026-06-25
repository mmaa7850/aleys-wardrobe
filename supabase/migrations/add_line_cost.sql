-- ── C_ORD_OrderItemList 新增 LineCost 欄位（staging）────────────────────────
-- LineCost = FIFO 這筆訂單明細的總成本（非單價），避免除後再乘的四捨五入誤差
ALTER TABLE staging."C_ORD_OrderItemList"
  ADD COLUMN IF NOT EXISTS "LineCost" NUMERIC(14,4);

-- ── C_ORD_OrderItemList 新增 LineCost 欄位（public）─────────────────────────
ALTER TABLE public."C_ORD_OrderItemList"
  ADD COLUMN IF NOT EXISTS "LineCost" NUMERIC(14,4);

-- ── 更新 fifo_deduct_batch：改回傳總成本而非單價平均（staging）──────────────
CREATE OR REPLACE FUNCTION staging.fifo_deduct_batch(
  p_variant_id BIGINT,
  p_qty        INTEGER
) RETURNS NUMERIC(14,4)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_remaining      INTEGER        := p_qty;
  v_total_cost     NUMERIC(14,4)  := 0;
  v_total_deducted INTEGER        := 0;
  v_id             BIGINT;
  v_unit_cost      NUMERIC(10,4);
  v_rem            INTEGER;
  v_deduct         INTEGER;
BEGIN
  FOR v_id, v_unit_cost, v_rem IN
    SELECT "ID", "UnitCost", "RemainingQty"
    FROM staging."C_INV_VariantBatchList"
    WHERE "VariantID" = p_variant_id AND "RemainingQty" > 0
    ORDER BY "PurchaseDate" ASC, "ID" ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_deduct         := LEAST(v_remaining, v_rem);
    UPDATE staging."C_INV_VariantBatchList"
      SET "RemainingQty" = "RemainingQty" - v_deduct
    WHERE "ID" = v_id;
    v_total_cost     := v_total_cost + v_unit_cost * v_deduct;
    v_total_deducted := v_total_deducted + v_deduct;
    v_remaining      := v_remaining - v_deduct;
  END LOOP;

  IF v_total_deducted = 0 THEN RETURN 0; END IF;
  -- 回傳總成本（不除以數量），精確保留完整金額
  RETURN ROUND(v_total_cost, 4);
END;
$$;

-- ── 更新 fifo_deduct_batch：改回傳總成本而非單價平均（public）───────────────
CREATE OR REPLACE FUNCTION public.fifo_deduct_batch(
  p_variant_id BIGINT,
  p_qty        INTEGER
) RETURNS NUMERIC(14,4)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_remaining      INTEGER        := p_qty;
  v_total_cost     NUMERIC(14,4)  := 0;
  v_total_deducted INTEGER        := 0;
  v_id             BIGINT;
  v_unit_cost      NUMERIC(10,4);
  v_rem            INTEGER;
  v_deduct         INTEGER;
BEGIN
  FOR v_id, v_unit_cost, v_rem IN
    SELECT "ID", "UnitCost", "RemainingQty"
    FROM public."C_INV_VariantBatchList"
    WHERE "VariantID" = p_variant_id AND "RemainingQty" > 0
    ORDER BY "PurchaseDate" ASC, "ID" ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_deduct         := LEAST(v_remaining, v_rem);
    UPDATE public."C_INV_VariantBatchList"
      SET "RemainingQty" = "RemainingQty" - v_deduct
    WHERE "ID" = v_id;
    v_total_cost     := v_total_cost + v_unit_cost * v_deduct;
    v_total_deducted := v_total_deducted + v_deduct;
    v_remaining      := v_remaining - v_deduct;
  END LOOP;

  IF v_total_deducted = 0 THEN RETURN 0; END IF;
  -- 回傳總成本（不除以數量），精確保留完整金額
  RETURN ROUND(v_total_cost, 4);
END;
$$;
