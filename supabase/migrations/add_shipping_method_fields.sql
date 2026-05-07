-- 為 S_SHP_ShippingMethodList 新增 Fee、MethodCode、IsActive 欄位
-- 需在 staging 和 public 兩個 schema 各執行一次

-- ── staging ──────────────────────────────────────────────────────────────────
ALTER TABLE staging."S_SHP_ShippingMethodList"
  ADD COLUMN IF NOT EXISTS "Fee"        bigint      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "MethodCode" varchar(20),
  ADD COLUMN IF NOT EXISTS "IsActive"   boolean     NOT NULL DEFAULT true;

-- 預設兩種配送方式（若資料表為空才 insert）
INSERT INTO staging."S_SHP_ShippingMethodList" ("Name", "Description", "Fee", "MethodCode", "IsActive", "UpdatedDate")
SELECT '超商取貨不付款', '7-11、全家、萊爾富、OK mart（C2C 店到店）', 80, 'cvscom', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM staging."S_SHP_ShippingMethodList" WHERE "MethodCode" = 'cvscom');

INSERT INTO staging."S_SHP_ShippingMethodList" ("Name", "Description", "Fee", "MethodCode", "IsActive", "UpdatedDate")
SELECT '宅配到府', '黑貓宅急便，台灣本島，1~3 個工作天', 100, 'home', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM staging."S_SHP_ShippingMethodList" WHERE "MethodCode" = 'home');

-- ── public ───────────────────────────────────────────────────────────────────
ALTER TABLE public."S_SHP_ShippingMethodList"
  ADD COLUMN IF NOT EXISTS "Fee"        bigint      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "MethodCode" varchar(20),
  ADD COLUMN IF NOT EXISTS "IsActive"   boolean     NOT NULL DEFAULT true;

INSERT INTO public."S_SHP_ShippingMethodList" ("Name", "Description", "Fee", "MethodCode", "IsActive", "UpdatedDate")
SELECT '超商取貨不付款', '7-11、全家、萊爾富、OK mart（C2C 店到店）', 80, 'cvscom', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM public."S_SHP_ShippingMethodList" WHERE "MethodCode" = 'cvscom');

INSERT INTO public."S_SHP_ShippingMethodList" ("Name", "Description", "Fee", "MethodCode", "IsActive", "UpdatedDate")
SELECT '宅配到府', '黑貓宅急便，台灣本島，1~3 個工作天', 100, 'home', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM public."S_SHP_ShippingMethodList" WHERE "MethodCode" = 'home');
