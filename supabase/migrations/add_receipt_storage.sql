-- ============================================================
-- 為成本記錄資料表新增收據/憑證附件欄位
-- ============================================================

-- 月度費用
ALTER TABLE public."C_FIN_MonthlyExpenseList"
  ADD COLUMN IF NOT EXISTS "ReceiptStoragePath" VARCHAR(500);

ALTER TABLE staging."C_FIN_MonthlyExpenseList"
  ADD COLUMN IF NOT EXISTS "ReceiptStoragePath" VARCHAR(500);

-- 商品進貨單
ALTER TABLE public."C_INV_PurchaseOrderList"
  ADD COLUMN IF NOT EXISTS "ReceiptStoragePath" VARCHAR(500);

ALTER TABLE staging."C_INV_PurchaseOrderList"
  ADD COLUMN IF NOT EXISTS "ReceiptStoragePath" VARCHAR(500);

-- 耗材進貨單
ALTER TABLE public."C_INV_ConsumablePurchaseList"
  ADD COLUMN IF NOT EXISTS "ReceiptStoragePath" VARCHAR(500);

ALTER TABLE staging."C_INV_ConsumablePurchaseList"
  ADD COLUMN IF NOT EXISTS "ReceiptStoragePath" VARCHAR(500);

-- ============================================================
-- 完成後請至 Supabase Dashboard → Storage 建立 bucket：
--   名稱：receipts
--   Public：開啟（或依需求設 private + signed URL）
-- ============================================================
