-- ================================================================
-- Migration: fix_cron_and_cart_preorder
-- 1. 修正 cron job（改用 stored function，避免 dollar-quoting 衝突）
-- 2. 新增 IsPreOrderItem 欄位到購物車，加入購物車時記錄當下預購狀態
-- 3. 修正 loop 漏掉 CancelledAt IS NULL 的 bug（避免重複回補庫存）
-- ================================================================

-- ── 1. 購物車加入「加入時的預購狀態」欄位 ──────────────────────
ALTER TABLE public."C_CART_CartItemList"
  ADD COLUMN IF NOT EXISTS "IsPreOrderItem" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE staging."C_CART_CartItemList"
  ADD COLUMN IF NOT EXISTS "IsPreOrderItem" BOOLEAN NOT NULL DEFAULT false;

-- ── 2. 建立 public schema 的 cron 執行函數 ────────────────────
CREATE OR REPLACE FUNCTION public.weekly_cancel_job()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  r RECORD;
BEGIN
  -- A. 待付款 / 付款失敗訂單：回補庫存 + 取消訂單
  FOR r IN
    SELECT oi."VariantID", SUM(oi."Qty") AS qty
    FROM   public."C_ORD_OrderItemList"  oi
    JOIN   public."C_ORD_OrderList"      o  ON o."ID" = oi."OrderID"
    WHERE  o."PaymentStatus" IN ('pending', 'failed')
    AND    oi."VariantID" IS NOT NULL
    GROUP  BY oi."VariantID"
  LOOP
    PERFORM public.restore_stock(r."VariantID", r.qty::int);
  END LOOP;

  UPDATE public."C_ORD_OrderList"
  SET    "PaymentStatus" = 'cancelled',
         "UpdatedDate"   = NOW()
  WHERE  "PaymentStatus" IN ('pending', 'failed');

  -- B. 購物車現貨品（IsPreOrderItem=false）：回補庫存 + 軟刪除
  --    只處理尚未 CancelledAt 的 row，避免重複回補
  FOR r IN
    SELECT ci."VariantID", ci."Qty"
    FROM   public."C_CART_CartItemList" ci
    WHERE  ci."IsReward"       = false
    AND    ci."IsPreOrderItem"  = false
    AND    ci."CancelledAt"    IS NULL
  LOOP
    PERFORM public.restore_stock(r."VariantID", r."Qty"::int);
  END LOOP;

  UPDATE public."C_CART_CartItemList"
  SET    "CancelledAt" = NOW()
  WHERE  "IsReward"       = false
  AND    "IsPreOrderItem"  = false
  AND    "CancelledAt"    IS NULL;

  -- C. 購物金項目直接刪除
  DELETE FROM public."C_CART_CartItemList"
  WHERE "IsReward" = true;
END;
$func$;

-- ── 3. 建立 staging schema 的 cron 執行函數 ──────────────────
CREATE OR REPLACE FUNCTION staging.weekly_cancel_job()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oi."VariantID", SUM(oi."Qty") AS qty
    FROM   staging."C_ORD_OrderItemList"  oi
    JOIN   staging."C_ORD_OrderList"      o  ON o."ID" = oi."OrderID"
    WHERE  o."PaymentStatus" IN ('pending', 'failed')
    AND    oi."VariantID" IS NOT NULL
    GROUP  BY oi."VariantID"
  LOOP
    PERFORM staging.restore_stock(r."VariantID", r.qty::int);
  END LOOP;

  UPDATE staging."C_ORD_OrderList"
  SET    "PaymentStatus" = 'cancelled',
         "UpdatedDate"   = NOW()
  WHERE  "PaymentStatus" IN ('pending', 'failed');

  FOR r IN
    SELECT ci."VariantID", ci."Qty"
    FROM   staging."C_CART_CartItemList" ci
    WHERE  ci."IsReward"       = false
    AND    ci."IsPreOrderItem"  = false
    AND    ci."CancelledAt"    IS NULL
  LOOP
    PERFORM staging.restore_stock(r."VariantID", r."Qty"::int);
  END LOOP;

  UPDATE staging."C_CART_CartItemList"
  SET    "CancelledAt" = NOW()
  WHERE  "IsReward"       = false
  AND    "IsPreOrderItem"  = false
  AND    "CancelledAt"    IS NULL;

  DELETE FROM staging."C_CART_CartItemList"
  WHERE "IsReward" = true;
END;
$func$;

-- ── 4. 更新 cron jobs（刪舊、建新，使用 stored function）────────
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname IN (
  'cancel-pending-orders-weekly',
  'cancel-pending-orders-weekly-staging'
);

SELECT cron.schedule(
  'cancel-pending-orders-weekly',
  '0 16 * * 0',
  'SELECT public.weekly_cancel_job();'
);

SELECT cron.schedule(
  'cancel-pending-orders-weekly-staging',
  '0 16 * * 0',
  'SELECT staging.weekly_cancel_job();'
);
