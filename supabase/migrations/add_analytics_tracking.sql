-- ================================================================
-- Migration: add_analytics_tracking
-- 商品點擊追蹤系統（官網流量分析）
-- ================================================================


-- ================================================================
-- ██████╗ ██╗   ██╗██████╗ ██╗     ██╗ ██████╗
-- ██╔══██╗██║   ██║██╔══██╗██║     ██║██╔════╝
-- ██████╔╝██║   ██║██████╔╝██║     ██║██║
-- ██╔═══╝ ██║   ██║██╔══██╗██║     ██║██║
-- ██║     ╚██████╔╝██████╔╝███████╗██║╚██████╗
-- ╚═╝      ╚═════╝ ╚═════╝ ╚══════╝╚═╝ ╚═════╝
-- Schema: public（正式區）
-- ================================================================

-- ① 商品點擊記錄
--   每次消費者進入商品詳情頁即新增一筆；來源由前端偵測 referrer / query param
CREATE TABLE IF NOT EXISTS public."C_ANL_ProductClickLog" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "ProductID"   BIGINT NOT NULL REFERENCES public."C_PRD_ProductList"("ID") ON DELETE CASCADE,
  "ProductName" VARCHAR(200) NOT NULL DEFAULT '',
  "Source"      VARCHAR(30)  NOT NULL DEFAULT '直接',
  -- 可能值：首頁 / 商品列表 / 購物車 / 願望清單 / LINE / 外部 / 直接 / 其他
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 查詢常用：依日期範圍篩選
CREATE INDEX IF NOT EXISTS "C_ANL_ProductClickLog_date_idx"
  ON public."C_ANL_ProductClickLog" ("CreatedDate" DESC);

-- 查詢常用：依商品統計
CREATE INDEX IF NOT EXISTS "C_ANL_ProductClickLog_product_idx"
  ON public."C_ANL_ProductClickLog" ("ProductID", "CreatedDate" DESC);

ALTER TABLE public."C_ANL_ProductClickLog" ENABLE ROW LEVEL SECURITY;

-- 任何人（含未登入訪客）皆可 INSERT（使用 anon key 直接記錄）
CREATE POLICY "click_log_insert_all" ON public."C_ANL_ProductClickLog"
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 只有 staff 可讀取報表
CREATE POLICY "click_log_staff_read" ON public."C_ANL_ProductClickLog"
  FOR SELECT TO authenticated USING (is_staff());

-- Grant
GRANT INSERT ON public."C_ANL_ProductClickLog" TO anon, authenticated;
GRANT SELECT ON public."C_ANL_ProductClickLog" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."C_ANL_ProductClickLog_ID_seq" TO anon, authenticated;


-- ================================================================
--  ██████╗████████╗ █████╗  ██████╗ ██╗███╗   ██╗ ██████╗
-- ██╔════╝╚══██╔══╝██╔══██╗██╔════╝ ██║████╗  ██║██╔════╝
-- ╚█████╗    ██║   ███████║██║  ███╗██║██╔██╗ ██║██║  ███╗
--  ╚═══██╗   ██║   ██╔══██║██║   ██║██║██║╚██╗██║██║   ██║
-- ██████╔╝   ██║   ██║  ██║╚██████╔╝██║██║ ╚████║╚██████╔╝
-- ╚═════╝    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝
-- Schema: staging（測試區）
-- ================================================================

CREATE TABLE IF NOT EXISTS staging."C_ANL_ProductClickLog" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "ProductID"   BIGINT NOT NULL REFERENCES staging."C_PRD_ProductList"("ID") ON DELETE CASCADE,
  "ProductName" VARCHAR(200) NOT NULL DEFAULT '',
  "Source"      VARCHAR(30)  NOT NULL DEFAULT '直接',
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "C_ANL_ProductClickLog_date_idx"
  ON staging."C_ANL_ProductClickLog" ("CreatedDate" DESC);

CREATE INDEX IF NOT EXISTS "C_ANL_ProductClickLog_product_idx"
  ON staging."C_ANL_ProductClickLog" ("ProductID", "CreatedDate" DESC);

ALTER TABLE staging."C_ANL_ProductClickLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "click_log_insert_all" ON staging."C_ANL_ProductClickLog"
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "click_log_staff_read" ON staging."C_ANL_ProductClickLog"
  FOR SELECT TO authenticated USING (staging.is_staff());

GRANT INSERT ON staging."C_ANL_ProductClickLog" TO anon, authenticated;
GRANT SELECT ON staging."C_ANL_ProductClickLog" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE staging."C_ANL_ProductClickLog_ID_seq" TO anon, authenticated;
