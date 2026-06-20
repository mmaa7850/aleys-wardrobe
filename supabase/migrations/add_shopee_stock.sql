-- 蝦皮庫存獨立欄位（與官網 StockQty 分開管理，訂單/購物車不動此欄）
ALTER TABLE staging."C_PRD_ProductVariantList"
  ADD COLUMN IF NOT EXISTS "ShopeeStockQty" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public."C_PRD_ProductVariantList"
  ADD COLUMN IF NOT EXISTS "ShopeeStockQty" BIGINT NOT NULL DEFAULT 0;
