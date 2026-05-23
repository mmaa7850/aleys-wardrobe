-- ================================================================
-- Migration: add_cart_features
-- 新增購物車來源追蹤、購物金支援
-- ================================================================

-- public schema
ALTER TABLE public."C_CART_CartItemList"
  ADD COLUMN IF NOT EXISTS "Source"        varchar(20)  DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS "LiveSessionID" bigint,
  ADD COLUMN IF NOT EXISTS "IsReward"      boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "RewardAmt"     integer;

-- 購物金項目不需要商品，允許 ProductID / VariantID 為 null
ALTER TABLE public."C_CART_CartItemList"
  ALTER COLUMN "ProductID"  DROP NOT NULL,
  ALTER COLUMN "VariantID"  DROP NOT NULL;

-- staging schema (dev)
ALTER TABLE staging."C_CART_CartItemList"
  ADD COLUMN IF NOT EXISTS "Source"        varchar(20)  DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS "LiveSessionID" bigint,
  ADD COLUMN IF NOT EXISTS "IsReward"      boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "RewardAmt"     integer;

ALTER TABLE staging."C_CART_CartItemList"
  ALTER COLUMN "ProductID"  DROP NOT NULL,
  ALTER COLUMN "VariantID"  DROP NOT NULL;
