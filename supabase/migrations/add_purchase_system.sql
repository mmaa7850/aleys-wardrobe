-- ================================================================
-- Migration: add_purchase_system
-- 批次進貨、成本追蹤、毛利計算所需資料表與欄位
-- 執行時機：staging + public 兩個 schema 都要執行
-- ================================================================

-- ── 1. S_INV_SupplierList（供應商主檔）─────────────────────────

CREATE TABLE IF NOT EXISTS public."S_INV_SupplierList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "Name"        VARCHAR(100) NOT NULL,
  "ContactName" VARCHAR(50),
  "Phone"       VARCHAR(20),
  "Email"       VARCHAR(100),
  "Note"        TEXT,
  "IsActive"    BOOLEAN      NOT NULL DEFAULT true,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE public."S_INV_SupplierList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_staff_all" ON public."S_INV_SupplierList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS staging."S_INV_SupplierList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "Name"        VARCHAR(100) NOT NULL,
  "ContactName" VARCHAR(50),
  "Phone"       VARCHAR(20),
  "Email"       VARCHAR(100),
  "Note"        TEXT,
  "IsActive"    BOOLEAN      NOT NULL DEFAULT true,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE staging."S_INV_SupplierList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_staff_all" ON staging."S_INV_SupplierList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ── 2. S_INV_CostTypeList（附加成本項目設定）───────────────────

CREATE TABLE IF NOT EXISTS public."S_INV_CostTypeList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "Name"        VARCHAR(50)  NOT NULL,
  "Description" VARCHAR(200),
  "SortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "IsActive"    BOOLEAN      NOT NULL DEFAULT true,
  "UpdatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE public."S_INV_CostTypeList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costtype_staff_all" ON public."S_INV_CostTypeList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS staging."S_INV_CostTypeList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "Name"        VARCHAR(50)  NOT NULL,
  "Description" VARCHAR(200),
  "SortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "IsActive"    BOOLEAN      NOT NULL DEFAULT true,
  "UpdatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE staging."S_INV_CostTypeList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costtype_staff_all" ON staging."S_INV_CostTypeList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- 預設成本項目
INSERT INTO public."S_INV_CostTypeList" ("Name", "SortOrder") VALUES
  ('大陸段物流費', 1),
  ('過境運費',     2),
  ('關稅',         3),
  ('報關費',       4)
ON CONFLICT DO NOTHING;

INSERT INTO staging."S_INV_CostTypeList" ("Name", "SortOrder") VALUES
  ('大陸段物流費', 1),
  ('過境運費',     2),
  ('關稅',         3),
  ('報關費',       4)
ON CONFLICT DO NOTHING;

-- ── 3. C_INV_PurchaseOrderList（進貨單主表）────────────────────

CREATE TABLE IF NOT EXISTS public."C_INV_PurchaseOrderList" (
  "ID"           BIGSERIAL    PRIMARY KEY,
  "PurchaseNo"   VARCHAR(30)  NOT NULL UNIQUE,  -- PO_YYYYMMDD_XXXXX
  "SupplierID"   BIGINT       REFERENCES public."S_INV_SupplierList"("ID"),
  "PurchaseDate" DATE         NOT NULL,
  "Status"       VARCHAR(20)  NOT NULL DEFAULT 'draft',  -- draft / confirmed
  "TotalCost"    NUMERIC(12,4),   -- 商品成本 + 附加成本合計（confirm 時計算）
  "Note"         TEXT,
  "CreatedDate"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedDate"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE public."C_INV_PurchaseOrderList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_order_staff_all" ON public."C_INV_PurchaseOrderList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS staging."C_INV_PurchaseOrderList" (
  "ID"           BIGSERIAL    PRIMARY KEY,
  "PurchaseNo"   VARCHAR(30)  NOT NULL UNIQUE,
  "SupplierID"   BIGINT       REFERENCES staging."S_INV_SupplierList"("ID"),
  "PurchaseDate" DATE         NOT NULL,
  "Status"       VARCHAR(20)  NOT NULL DEFAULT 'draft',
  "TotalCost"    NUMERIC(12,4),
  "Note"         TEXT,
  "CreatedDate"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedDate"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE staging."C_INV_PurchaseOrderList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_order_staff_all" ON staging."C_INV_PurchaseOrderList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ── 4. C_INV_PurchaseOrderItemList（進貨明細）──────────────────

CREATE TABLE IF NOT EXISTS public."C_INV_PurchaseOrderItemList" (
  "ID"              BIGSERIAL     PRIMARY KEY,
  "PurchaseOrderID" BIGINT        NOT NULL REFERENCES public."C_INV_PurchaseOrderList"("ID") ON DELETE CASCADE,
  "ProductID"       BIGINT        NOT NULL,
  "VariantID"       BIGINT        NOT NULL,
  "ProductName"     VARCHAR(200),   -- 快取，避免頻繁 join
  "ColorName"       VARCHAR(50),
  "SizeName"        VARCHAR(20),
  "Qty"             INTEGER       NOT NULL CHECK ("Qty" > 0),
  "UnitCost"        NUMERIC(10,4) NOT NULL CHECK ("UnitCost" >= 0),
  "SubTotal"        NUMERIC(12,4) GENERATED ALWAYS AS ("Qty" * "UnitCost") STORED
);
ALTER TABLE public."C_INV_PurchaseOrderItemList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_item_staff_all" ON public."C_INV_PurchaseOrderItemList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS staging."C_INV_PurchaseOrderItemList" (
  "ID"              BIGSERIAL     PRIMARY KEY,
  "PurchaseOrderID" BIGINT        NOT NULL REFERENCES staging."C_INV_PurchaseOrderList"("ID") ON DELETE CASCADE,
  "ProductID"       BIGINT        NOT NULL,
  "VariantID"       BIGINT        NOT NULL,
  "ProductName"     VARCHAR(200),
  "ColorName"       VARCHAR(50),
  "SizeName"        VARCHAR(20),
  "Qty"             INTEGER       NOT NULL CHECK ("Qty" > 0),
  "UnitCost"        NUMERIC(10,4) NOT NULL CHECK ("UnitCost" >= 0),
  "SubTotal"        NUMERIC(12,4) GENERATED ALWAYS AS ("Qty" * "UnitCost") STORED
);
ALTER TABLE staging."C_INV_PurchaseOrderItemList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_item_staff_all" ON staging."C_INV_PurchaseOrderItemList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ── 5. C_INV_PurchaseOrderCostList（進貨附加成本）──────────────

CREATE TABLE IF NOT EXISTS public."C_INV_PurchaseOrderCostList" (
  "ID"              BIGSERIAL     PRIMARY KEY,
  "PurchaseOrderID" BIGINT        NOT NULL REFERENCES public."C_INV_PurchaseOrderList"("ID") ON DELETE CASCADE,
  "CostTypeID"      BIGINT        REFERENCES public."S_INV_CostTypeList"("ID"),
  "Amount"          NUMERIC(10,2) NOT NULL CHECK ("Amount" >= 0),
  "Note"            TEXT,
  "CreatedDate"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
ALTER TABLE public."C_INV_PurchaseOrderCostList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_cost_staff_all" ON public."C_INV_PurchaseOrderCostList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS staging."C_INV_PurchaseOrderCostList" (
  "ID"              BIGSERIAL     PRIMARY KEY,
  "PurchaseOrderID" BIGINT        NOT NULL REFERENCES staging."C_INV_PurchaseOrderList"("ID") ON DELETE CASCADE,
  "CostTypeID"      BIGINT        REFERENCES staging."S_INV_CostTypeList"("ID"),
  "Amount"          NUMERIC(10,2) NOT NULL CHECK ("Amount" >= 0),
  "Note"            TEXT,
  "CreatedDate"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
ALTER TABLE staging."C_INV_PurchaseOrderCostList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_cost_staff_all" ON staging."C_INV_PurchaseOrderCostList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ── 6. C_ORD_OrderExtraCostList（訂單額外成本）────────────────

CREATE TABLE IF NOT EXISTS public."C_ORD_OrderExtraCostList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "OrderID"     BIGINT       NOT NULL,
  -- EventType: return（退貨）/ exchange（換貨）/ other
  "EventType"   VARCHAR(20)  NOT NULL DEFAULT 'other',
  -- CostType: shipping_back（寄回運費）/ shipping_out（補寄運費）/ other
  "CostType"    VARCHAR(30)  NOT NULL DEFAULT 'other',
  "Amount"      INTEGER      NOT NULL CHECK ("Amount" >= 0),
  "Note"        TEXT,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE public."C_ORD_OrderExtraCostList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_extra_cost_staff_all" ON public."C_ORD_OrderExtraCostList"
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS staging."C_ORD_OrderExtraCostList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "OrderID"     BIGINT       NOT NULL,
  "EventType"   VARCHAR(20)  NOT NULL DEFAULT 'other',
  "CostType"    VARCHAR(30)  NOT NULL DEFAULT 'other',
  "Amount"      INTEGER      NOT NULL CHECK ("Amount" >= 0),
  "Note"        TEXT,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE staging."C_ORD_OrderExtraCostList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_extra_cost_staff_all" ON staging."C_ORD_OrderExtraCostList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ── 7. 修改現有表欄位 ──────────────────────────────────────────

-- C_PRD_ProductVariantList：加權平均成本
ALTER TABLE public."C_PRD_ProductVariantList"
  ADD COLUMN IF NOT EXISTS "CostPrice" NUMERIC(10,4) NOT NULL DEFAULT 0;

ALTER TABLE staging."C_PRD_ProductVariantList"
  ADD COLUMN IF NOT EXISTS "CostPrice" NUMERIC(10,4) NOT NULL DEFAULT 0;

-- C_ORD_OrderItemList：建單時快照成本
ALTER TABLE public."C_ORD_OrderItemList"
  ADD COLUMN IF NOT EXISTS "UnitCost" NUMERIC(10,4) NOT NULL DEFAULT 0;

ALTER TABLE staging."C_ORD_OrderItemList"
  ADD COLUMN IF NOT EXISTS "UnitCost" NUMERIC(10,4) NOT NULL DEFAULT 0;

-- C_ORD_OrderList：實際出貨運費（出貨時填入）
ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "ActualShippingCost" INTEGER;

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "ActualShippingCost" INTEGER;

-- ── 注意事項 ───────────────────────────────────────────────────
-- 執行後請在後台「系統設定」新增以下兩個 Key（S_SYS_Config）：
--   shipping_cost_cvscom  超商每箱成本（建議預設：70）
--   shipping_cost_home    宅配每箱成本（建議預設：120）
