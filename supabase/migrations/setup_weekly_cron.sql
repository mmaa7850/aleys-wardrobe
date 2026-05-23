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
      WHERE  o."PaymentStatus" IN ('pending', 'payment_failed')
      AND    oi."VariantID" IS NOT NULL
      GROUP  BY oi."VariantID"
    LOOP
      PERFORM public.restore_stock(r."VariantID", r.qty::int);
    END LOOP;

    -- 取消訂單
    UPDATE public."C_ORD_OrderList"
    SET    "PaymentStatus" = 'cancelled',
           "UpdatedDate"   = NOW()
    WHERE  "PaymentStatus" IN ('pending', 'payment_failed');

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
      WHERE  o."PaymentStatus" IN ('pending', 'payment_failed')
      AND    oi."VariantID" IS NOT NULL
      GROUP  BY oi."VariantID"
    LOOP
      PERFORM staging.restore_stock(r."VariantID", r.qty::int);
    END LOOP;

    UPDATE staging."C_ORD_OrderList"
    SET    "PaymentStatus" = 'cancelled',
           "UpdatedDate"   = NOW()
    WHERE  "PaymentStatus" IN ('pending', 'payment_failed');

    DELETE FROM staging."C_CART_CartItemList"
    WHERE "IsReward" = true;
  END;
  $$ LANGUAGE plpgsql;
  $$
);
