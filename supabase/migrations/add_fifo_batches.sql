-- ── FIFO 進貨批次表（staging）──────────────────────────────────────────────
-- 取代加權平均 CostPrice，記錄每次進貨的批次與剩餘數量
CREATE TABLE IF NOT EXISTS staging."C_INV_VariantBatchList" (
  "ID"               BIGSERIAL      PRIMARY KEY,
  "VariantID"        BIGINT         NOT NULL,
  "PurchaseOrderID"  BIGINT,
  "PurchaseDate"     DATE           NOT NULL DEFAULT CURRENT_DATE,
  "UnitCost"         NUMERIC(10,4)  NOT NULL DEFAULT 0 CHECK ("UnitCost" >= 0),
  "OriginalQty"      INTEGER        NOT NULL CHECK ("OriginalQty" > 0),
  "RemainingQty"     INTEGER        NOT NULL DEFAULT 0 CHECK ("RemainingQty" >= 0),
  "CreatedDate"      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_batch_staging
  ON staging."C_INV_VariantBatchList"("VariantID", "PurchaseDate" ASC, "ID" ASC);

ALTER TABLE staging."C_INV_VariantBatchList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batch_staff_all" ON staging."C_INV_VariantBatchList"
  FOR ALL USING (staging.is_staff());

-- 初始化：將現有庫存轉換為第一批
INSERT INTO staging."C_INV_VariantBatchList"
  ("VariantID", "PurchaseDate", "UnitCost", "OriginalQty", "RemainingQty")
SELECT
  "ID",
  CURRENT_DATE,
  COALESCE("CostPrice", 0),
  "StockQty",
  "StockQty"
FROM staging."C_PRD_ProductVariantList"
WHERE "StockQty" > 0;

-- ── FIFO 扣批次函式（staging）──────────────────────────────────────────────
-- 從最舊批次依序扣除 RemainingQty，回傳加權平均 FIFO 單價
-- 注意：此函式只動 batch 表，不動 StockQty（StockQty 由既有流程管理）
CREATE OR REPLACE FUNCTION staging.fifo_deduct_batch(
  p_variant_id BIGINT,
  p_qty        INTEGER
) RETURNS NUMERIC(10,4)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_remaining      INTEGER       := p_qty;
  v_total_cost     NUMERIC(14,4) := 0;
  v_total_deducted INTEGER       := 0;
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
    v_deduct     := LEAST(v_remaining, v_rem);
    UPDATE staging."C_INV_VariantBatchList"
      SET "RemainingQty" = "RemainingQty" - v_deduct
    WHERE "ID" = v_id;
    v_total_cost     := v_total_cost + v_unit_cost * v_deduct;
    v_total_deducted := v_total_deducted + v_deduct;
    v_remaining      := v_remaining - v_deduct;
  END LOOP;

  IF v_total_deducted = 0 THEN RETURN 0; END IF;
  RETURN ROUND(v_total_cost / v_total_deducted, 4);
END;
$$;

-- ── FIFO 進貨批次表（public）────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."C_INV_VariantBatchList" (
  "ID"               BIGSERIAL      PRIMARY KEY,
  "VariantID"        BIGINT         NOT NULL,
  "PurchaseOrderID"  BIGINT,
  "PurchaseDate"     DATE           NOT NULL DEFAULT CURRENT_DATE,
  "UnitCost"         NUMERIC(10,4)  NOT NULL DEFAULT 0 CHECK ("UnitCost" >= 0),
  "OriginalQty"      INTEGER        NOT NULL CHECK ("OriginalQty" > 0),
  "RemainingQty"     INTEGER        NOT NULL DEFAULT 0 CHECK ("RemainingQty" >= 0),
  "CreatedDate"      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_batch_public
  ON public."C_INV_VariantBatchList"("VariantID", "PurchaseDate" ASC, "ID" ASC);

ALTER TABLE public."C_INV_VariantBatchList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batch_staff_all" ON public."C_INV_VariantBatchList"
  FOR ALL USING (public.is_staff());

INSERT INTO public."C_INV_VariantBatchList"
  ("VariantID", "PurchaseDate", "UnitCost", "OriginalQty", "RemainingQty")
SELECT
  "ID",
  CURRENT_DATE,
  COALESCE("CostPrice", 0),
  "StockQty",
  "StockQty"
FROM public."C_PRD_ProductVariantList"
WHERE "StockQty" > 0;

CREATE OR REPLACE FUNCTION public.fifo_deduct_batch(
  p_variant_id BIGINT,
  p_qty        INTEGER
) RETURNS NUMERIC(10,4)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_remaining      INTEGER       := p_qty;
  v_total_cost     NUMERIC(14,4) := 0;
  v_total_deducted INTEGER       := 0;
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
    v_deduct     := LEAST(v_remaining, v_rem);
    UPDATE public."C_INV_VariantBatchList"
      SET "RemainingQty" = "RemainingQty" - v_deduct
    WHERE "ID" = v_id;
    v_total_cost     := v_total_cost + v_unit_cost * v_deduct;
    v_total_deducted := v_total_deducted + v_deduct;
    v_remaining      := v_remaining - v_deduct;
  END LOOP;

  IF v_total_deducted = 0 THEN RETURN 0; END IF;
  RETURN ROUND(v_total_cost / v_total_deducted, 4);
END;
$$;
