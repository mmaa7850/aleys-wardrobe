-- ================================================================
-- Migration: sync_order_status_and_wallet_balance
-- 1. 補齊 cancelled 訂單狀態
-- 2. 讓每週銷單同步 PaymentStatus / StatusID
-- 3. 修復既有 paid / refunded / cancelled 訂單的 StatusID
-- 4. 以最新錢包流水 BalanceAfter 校正錢包餘額
-- public / staging 必須一起維護；實際測試仍應先在 staging 執行。
-- ================================================================

INSERT INTO public."S_ORD_StatusList" ("Name", "Description", "UpdatedDate")
SELECT 'cancelled', '已取消', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public."S_ORD_StatusList" WHERE "Name" = 'cancelled'
);

INSERT INTO staging."S_ORD_StatusList" ("Name", "Description", "UpdatedDate")
SELECT 'cancelled', '已取消', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM staging."S_ORD_StatusList" WHERE "Name" = 'cancelled'
);

-- 已付款訂單只有在仍停在第一個狀態（或沒有狀態）時才移到第二個狀態，
-- 避免覆蓋已出貨／已完成的正確營運狀態。
WITH status_ids AS (
  SELECT
    (ARRAY_AGG("ID" ORDER BY "ID"))[1] AS first_id,
    COALESCE((ARRAY_AGG("ID" ORDER BY "ID"))[2], (ARRAY_AGG("ID" ORDER BY "ID"))[1]) AS second_id
  FROM public."S_ORD_StatusList"
)
UPDATE public."C_ORD_OrderList" orders
SET "StatusID" = status_ids.second_id,
    "UpdatedDate" = NOW()
FROM status_ids
WHERE orders."PaymentStatus" = 'paid'
  AND (orders."StatusID" IS NULL OR orders."StatusID" = status_ids.first_id)
  AND status_ids.second_id IS NOT NULL;

WITH status_ids AS (
  SELECT
    (ARRAY_AGG("ID" ORDER BY "ID"))[1] AS first_id,
    COALESCE((ARRAY_AGG("ID" ORDER BY "ID"))[2], (ARRAY_AGG("ID" ORDER BY "ID"))[1]) AS second_id
  FROM staging."S_ORD_StatusList"
)
UPDATE staging."C_ORD_OrderList" orders
SET "StatusID" = status_ids.second_id,
    "UpdatedDate" = NOW()
FROM status_ids
WHERE orders."PaymentStatus" = 'paid'
  AND (orders."StatusID" IS NULL OR orders."StatusID" = status_ids.first_id)
  AND status_ids.second_id IS NOT NULL;

UPDATE public."C_ORD_OrderList" orders
SET "StatusID" = status_row."ID",
    "UpdatedDate" = NOW()
FROM (
  SELECT DISTINCT ON ("Name") "Name", "ID"
  FROM public."S_ORD_StatusList"
  WHERE "Name" IN ('refunded', 'cancelled')
  ORDER BY "Name", "ID"
) status_row
WHERE orders."PaymentStatus" = status_row."Name"
  AND orders."StatusID" IS DISTINCT FROM status_row."ID";

UPDATE staging."C_ORD_OrderList" orders
SET "StatusID" = status_row."ID",
    "UpdatedDate" = NOW()
FROM (
  SELECT DISTINCT ON ("Name") "Name", "ID"
  FROM staging."S_ORD_StatusList"
  WHERE "Name" IN ('refunded', 'cancelled')
  ORDER BY "Name", "ID"
) status_row
WHERE orders."PaymentStatus" = status_row."Name"
  AND orders."StatusID" IS DISTINCT FROM status_row."ID";

-- 流水帳是錢包異動的稽核來源；若彙總餘額不同，以最新一筆 BalanceAfter 為準。
WITH latest_balance AS (
  SELECT DISTINCT ON ("UserID")
    "UserID",
    "BalanceAfter"
  FROM public."C_MBR_WalletTxList"
  ORDER BY "UserID", "CreatedDate" DESC NULLS LAST, "ID" DESC
)
INSERT INTO public."C_MBR_WalletList" AS wallet ("UserID", "Balance", "UpdatedDate")
SELECT "UserID", "BalanceAfter", NOW()
FROM latest_balance
ON CONFLICT ("UserID") DO UPDATE
SET "Balance" = EXCLUDED."Balance",
    "UpdatedDate" = NOW()
WHERE wallet."Balance" IS DISTINCT FROM EXCLUDED."Balance";

WITH latest_balance AS (
  SELECT DISTINCT ON ("UserID")
    "UserID",
    "BalanceAfter"
  FROM staging."C_MBR_WalletTxList"
  ORDER BY "UserID", "CreatedDate" DESC NULLS LAST, "ID" DESC
)
INSERT INTO staging."C_MBR_WalletList" AS wallet ("UserID", "Balance", "UpdatedDate")
SELECT "UserID", "BalanceAfter", NOW()
FROM latest_balance
ON CONFLICT ("UserID") DO UPDATE
SET "Balance" = EXCLUDED."Balance",
    "UpdatedDate" = NOW()
WHERE wallet."Balance" IS DISTINCT FROM EXCLUDED."Balance";

-- 重新定義目前 cron 使用的 stored functions，確保之後銷單同步 StatusID。
CREATE OR REPLACE FUNCTION public.weekly_cancel_job()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oi."VariantID", SUM(oi."Qty") AS qty
    FROM public."C_ORD_OrderItemList" oi
    JOIN public."C_ORD_OrderList" o ON o."ID" = oi."OrderID"
    WHERE o."PaymentStatus" IN ('pending', 'failed')
      AND oi."VariantID" IS NOT NULL
    GROUP BY oi."VariantID"
  LOOP
    PERFORM public.restore_stock(r."VariantID", r.qty::int);
  END LOOP;

  UPDATE public."C_ORD_OrderList"
  SET "PaymentStatus" = 'cancelled',
      "StatusID" = COALESCE(
        (SELECT "ID" FROM public."S_ORD_StatusList" WHERE "Name" = 'cancelled' ORDER BY "ID" LIMIT 1),
        "StatusID"
      ),
      "UpdatedDate" = NOW()
  WHERE "PaymentStatus" IN ('pending', 'failed');

  FOR r IN
    SELECT "VariantID", "Qty"
    FROM public."C_CART_CartItemList"
    WHERE "IsReward" = false
      AND "IsPreOrderItem" = false
      AND "CancelledAt" IS NULL
  LOOP
    PERFORM public.restore_stock(r."VariantID", r."Qty"::int);
  END LOOP;

  UPDATE public."C_CART_CartItemList"
  SET "CancelledAt" = NOW()
  WHERE "IsReward" = false
    AND "IsPreOrderItem" = false
    AND "CancelledAt" IS NULL;

  DELETE FROM public."C_CART_CartItemList" WHERE "IsReward" = true;
END;
$func$;

CREATE OR REPLACE FUNCTION staging.weekly_cancel_job()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oi."VariantID", SUM(oi."Qty") AS qty
    FROM staging."C_ORD_OrderItemList" oi
    JOIN staging."C_ORD_OrderList" o ON o."ID" = oi."OrderID"
    WHERE o."PaymentStatus" IN ('pending', 'failed')
      AND oi."VariantID" IS NOT NULL
    GROUP BY oi."VariantID"
  LOOP
    PERFORM staging.restore_stock(r."VariantID", r.qty::int);
  END LOOP;

  UPDATE staging."C_ORD_OrderList"
  SET "PaymentStatus" = 'cancelled',
      "StatusID" = COALESCE(
        (SELECT "ID" FROM staging."S_ORD_StatusList" WHERE "Name" = 'cancelled' ORDER BY "ID" LIMIT 1),
        "StatusID"
      ),
      "UpdatedDate" = NOW()
  WHERE "PaymentStatus" IN ('pending', 'failed');

  FOR r IN
    SELECT "VariantID", "Qty"
    FROM staging."C_CART_CartItemList"
    WHERE "IsReward" = false
      AND "IsPreOrderItem" = false
      AND "CancelledAt" IS NULL
  LOOP
    PERFORM staging.restore_stock(r."VariantID", r."Qty"::int);
  END LOOP;

  UPDATE staging."C_CART_CartItemList"
  SET "CancelledAt" = NOW()
  WHERE "IsReward" = false
    AND "IsPreOrderItem" = false
    AND "CancelledAt" IS NULL;

  DELETE FROM staging."C_CART_CartItemList" WHERE "IsReward" = true;
END;
$func$;
