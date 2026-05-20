-- ============================================================
-- 直播代建訂單功能 Migration
-- 執行時機：兩個 schema (staging + public) 都要執行
-- ============================================================

-- ── 直播場次 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging."C_LIV_SessionList" (
  "ID"          bigserial PRIMARY KEY,
  "Title"       varchar(100) NOT NULL,
  "LiveDate"    date,
  "Status"      varchar(20) NOT NULL DEFAULT 'planned', -- planned / active / closed
  "Notes"       text,
  "CreatedDate" timestamptz DEFAULT now(),
  "UpdatedDate" timestamptz DEFAULT now()
);
ALTER TABLE staging."C_LIV_SessionList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_session_staff_all" ON staging."C_LIV_SessionList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

CREATE TABLE IF NOT EXISTS public."C_LIV_SessionList" (
  "ID"          bigserial PRIMARY KEY,
  "Title"       varchar(100) NOT NULL,
  "LiveDate"    date,
  "Status"      varchar(20) NOT NULL DEFAULT 'planned',
  "Notes"       text,
  "CreatedDate" timestamptz DEFAULT now(),
  "UpdatedDate" timestamptz DEFAULT now()
);
ALTER TABLE public."C_LIV_SessionList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_session_staff_all" ON public."C_LIV_SessionList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── 直播商品對照表 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging."C_LIV_ProductList" (
  "ID"          bigserial PRIMARY KEY,
  "SessionID"   bigint NOT NULL REFERENCES staging."C_LIV_SessionList"("ID") ON DELETE CASCADE,
  "Code"        varchar(20) NOT NULL,     -- 留言關鍵字代碼，例：Y77
  "ColorName"   varchar(50) NOT NULL,     -- 顏色名稱，例：藍
  "SizeName"    varchar(20) NOT NULL,     -- 尺寸，例：L
  "VariantID"   bigint NOT NULL,
  "ProductName" varchar(200),             -- 快取，不用每次 join
  "LivePrice"   bigint NOT NULL,          -- 直播特價（元）
  "CreatedDate" timestamptz DEFAULT now()
);
ALTER TABLE staging."C_LIV_ProductList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_product_staff_all" ON staging."C_LIV_ProductList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

CREATE TABLE IF NOT EXISTS public."C_LIV_ProductList" (
  "ID"          bigserial PRIMARY KEY,
  "SessionID"   bigint NOT NULL REFERENCES public."C_LIV_SessionList"("ID") ON DELETE CASCADE,
  "Code"        varchar(20) NOT NULL,
  "ColorName"   varchar(50) NOT NULL,
  "SizeName"    varchar(20) NOT NULL,
  "VariantID"   bigint NOT NULL,
  "ProductName" varchar(200),
  "LivePrice"   bigint NOT NULL,
  "CreatedDate" timestamptz DEFAULT now()
);
ALTER TABLE public."C_LIV_ProductList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_product_staff_all" ON public."C_LIV_ProductList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── C_ORD_OrderList 新增欄位 ───────────────────────────────
ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "OrderSource"   varchar(20) DEFAULT 'web',  -- web / live / admin
  ADD COLUMN IF NOT EXISTS "LiveSessionID" bigint;

ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "OrderSource"   varchar(20) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS "LiveSessionID" bigint;
