-- ================================================================
-- Migration: add_product_live_code
-- C_PRD_ProductList 加入 LiveCode 欄位
-- 讓每個商品有固定的直播留言代碼，建立直播場次時自動帶入，
-- 不需要每場重新設定
-- ================================================================

ALTER TABLE public."C_PRD_ProductList"
  ADD COLUMN IF NOT EXISTS "LiveCode" VARCHAR(20);

ALTER TABLE staging."C_PRD_ProductList"
  ADD COLUMN IF NOT EXISTS "LiveCode" VARCHAR(20);
