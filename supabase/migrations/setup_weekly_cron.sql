-- ================================================================
-- Migration: setup_weekly_cron
-- 每週一 00:00 (Asia/Taipei) = 每週日 16:00 UTC 銷單 + 清購物金
-- 需要 pg_cron extension（Supabase 啟用後執行此 SQL）
-- ================================================================

-- 確保 pg_cron 已啟用
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 1. 銷單 + 回補庫存（public schema）────────────────────────
SELECT cron.schedule(
  'cancel-pending-orders-weekly',   -- job name（唯一）
  '0 16 * * 0',                     -- 每週日 16:00 UTC = 台灣週一 00:00
  $$
  DO $$
  DECLARE
    r RECORD;
  BEGIN
    -- 找出所有待付款 / 付款失敗的訂單明細，逐筆回補庫存
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

    -- 取消訂單
    UPDATE public."C_ORD_OrderList"
    SET    "PaymentStatus" = 'cancelled',
           "StatusID"      = COALESCE(
             (SELECT "ID" FROM public."S_ORD_StatusList" WHERE "Name" = 'cancelled' ORDER BY "ID" LIMIT 1),
             "StatusID"
           ),
           "UpdatedDate"   = NOW()
    WHERE  "PaymentStatus" IN ('pending', 'failed');

    -- 清除購物車現貨品（IsPreOrder=true 且 StockQty=0 的真預購除外），並回補庫存
    FOR r IN
      SELECT ci."ID", ci."VariantID", ci."Qty"
      FROM   public."C_CART_CartItemList"        ci
      JOIN   public."C_PRD_ProductList"          p  ON p."ID"  = ci."ProductID"
      JOIN   public."C_PRD_ProductVariantList"   v  ON v."ID"  = ci."VariantID"
      WHERE  ci."IsReward" = false
      AND    NOT (p."IsPreOrder" = true AND v."StockQty" <= 0)
    LOOP
      PERFORM public.restore_stock(r."VariantID", r."Qty"::int);
    END LOOP;

    UPDATE public."C_CART_CartItemList" ci
    SET    "CancelledAt" = NOW()
    FROM   public."C_PRD_ProductList"        p,
           public."C_PRD_ProductVariantList" v
    WHERE  ci."ProductID" = p."ID"
    AND    ci."VariantID" = v."ID"
    AND    ci."IsReward"  = false
    AND    ci."CancelledAt" IS NULL
    AND    NOT (p."IsPreOrder" = true AND v."StockQty" <= 0);

    -- 刪除購物車中的購物金項目（IsReward = true）
    DELETE FROM public."C_CART_CartItemList"
    WHERE "IsReward" = true;
  END;
  $$ LANGUAGE plpgsql;
  $$
);

-- ── 2. 銷單 + 回補庫存（staging schema）──────────────────────
SELECT cron.schedule(
  'cancel-pending-orders-weekly-staging',
  '0 16 * * 0',
  $$
  DO $$
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
           "StatusID"      = COALESCE(
             (SELECT "ID" FROM staging."S_ORD_StatusList" WHERE "Name" = 'cancelled' ORDER BY "ID" LIMIT 1),
             "StatusID"
           ),
           "UpdatedDate"   = NOW()
    WHERE  "PaymentStatus" IN ('pending', 'failed');

    -- 清除購物車現貨品（IsPreOrder=true 且 StockQty=0 的真預購除外），並回補庫存
    FOR r IN
      SELECT ci."ID", ci."VariantID", ci."Qty"
      FROM   staging."C_CART_CartItemList"        ci
      JOIN   staging."C_PRD_ProductList"          p  ON p."ID"  = ci."ProductID"
      JOIN   staging."C_PRD_ProductVariantList"   v  ON v."ID"  = ci."VariantID"
      WHERE  ci."IsReward" = false
      AND    NOT (p."IsPreOrder" = true AND v."StockQty" <= 0)
    LOOP
      PERFORM staging.restore_stock(r."VariantID", r."Qty"::int);
    END LOOP;

    UPDATE staging."C_CART_CartItemList" ci
    SET    "CancelledAt" = NOW()
    FROM   staging."C_PRD_ProductList"        p,
           staging."C_PRD_ProductVariantList" v
    WHERE  ci."ProductID" = p."ID"
    AND    ci."VariantID" = v."ID"
    AND    ci."IsReward"  = false
    AND    ci."CancelledAt" IS NULL
    AND    NOT (p."IsPreOrder" = true AND v."StockQty" <= 0);

    -- 刪除購物車中的購物金項目（IsReward = true）
    DELETE FROM staging."C_CART_CartItemList"
    WHERE "IsReward" = true;
  END;
  $$ LANGUAGE plpgsql;
  $$
);
