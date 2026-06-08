-- ================================================================
-- Migration: add_consumables_system
-- 耗材管理 + 月度費用記錄系統
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

-- ① 耗材品項
CREATE TABLE IF NOT EXISTS public."C_INV_ConsumableList" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "Name"        VARCHAR(100) NOT NULL,
  "Category"    VARCHAR(20)  NOT NULL DEFAULT '其他',  -- 包材 / 贈品 / 其他
  "Unit"        VARCHAR(20)  NOT NULL DEFAULT '個',
  "CostPrice"   NUMERIC(10,4) NOT NULL DEFAULT 0,
  "StockQty"    INTEGER NOT NULL DEFAULT 0,
  "Description" TEXT,
  "IsActive"    BOOLEAN NOT NULL DEFAULT true,
  "CreatedDate" TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."C_INV_ConsumableList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumable_staff_all" ON public."C_INV_ConsumableList"
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- ② 耗材進貨單
CREATE TABLE IF NOT EXISTS public."C_INV_ConsumablePurchaseList" (
  "ID"           BIGSERIAL PRIMARY KEY,
  "PurchaseNo"   VARCHAR(30) NOT NULL,
  "PurchaseDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "Status"       VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft / confirmed
  "Note"         TEXT,
  "CreatedDate"  TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate"  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."C_INV_ConsumablePurchaseList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumable_purchase_staff_all" ON public."C_INV_ConsumablePurchaseList"
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- ③ 耗材進貨明細
CREATE TABLE IF NOT EXISTS public."C_INV_ConsumablePurchaseItemList" (
  "ID"             BIGSERIAL PRIMARY KEY,
  "PurchaseID"     BIGINT NOT NULL REFERENCES public."C_INV_ConsumablePurchaseList"("ID") ON DELETE CASCADE,
  "ConsumableID"   BIGINT NOT NULL REFERENCES public."C_INV_ConsumableList"("ID"),
  "ConsumableName" VARCHAR(100) NOT NULL DEFAULT '',
  "Qty"            INTEGER NOT NULL DEFAULT 1,
  "UnitCost"       NUMERIC(10,4) NOT NULL DEFAULT 0,
  "SubTotal"       NUMERIC(10,2) NOT NULL DEFAULT 0,
  "CreatedDate"    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."C_INV_ConsumablePurchaseItemList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumable_purchase_item_staff_all" ON public."C_INV_ConsumablePurchaseItemList"
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- ④ 訂單耗材使用記錄
CREATE TABLE IF NOT EXISTS public."C_ORD_OrderConsumableList" (
  "ID"             BIGSERIAL PRIMARY KEY,
  "OrderID"        BIGINT NOT NULL REFERENCES public."C_ORD_OrderList"("ID") ON DELETE CASCADE,
  "ConsumableID"   BIGINT REFERENCES public."C_INV_ConsumableList"("ID"),
  "ConsumableName" VARCHAR(100) NOT NULL,
  "Unit"           VARCHAR(20)  NOT NULL DEFAULT '個',
  "Qty"            INTEGER NOT NULL DEFAULT 1,
  "UnitCost"       NUMERIC(10,4) NOT NULL DEFAULT 0,
  "Amount"         NUMERIC(10,2) NOT NULL DEFAULT 0,
  "CreatedDate"    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."C_ORD_OrderConsumableList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_consumable_staff_all" ON public."C_ORD_OrderConsumableList"
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- ⑤ 費用分類設定
CREATE TABLE IF NOT EXISTS public."S_FIN_ExpenseCategoryList" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "Name"        VARCHAR(50) NOT NULL,
  "Description" TEXT,
  "SortOrder"   INTEGER NOT NULL DEFAULT 0,
  "IsActive"    BOOLEAN NOT NULL DEFAULT true,
  "CreatedDate" TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."S_FIN_ExpenseCategoryList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_cat_staff_read"  ON public."S_FIN_ExpenseCategoryList"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_cat_admin_write" ON public."S_FIN_ExpenseCategoryList"
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ⑥ 月度費用記錄
CREATE TABLE IF NOT EXISTS public."C_FIN_MonthlyExpenseList" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "Year"        INTEGER NOT NULL,
  "Month"       INTEGER NOT NULL CHECK ("Month" BETWEEN 1 AND 12),
  "CategoryID"  BIGINT REFERENCES public."S_FIN_ExpenseCategoryList"("ID"),
  "Name"        VARCHAR(100) NOT NULL,
  "Amount"      NUMERIC(10,2) NOT NULL DEFAULT 0,
  "Note"        TEXT,
  "CreatedDate" TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."C_FIN_MonthlyExpenseList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_expense_staff_all" ON public."C_FIN_MonthlyExpenseList"
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- ⑦ 預設費用分類
INSERT INTO public."S_FIN_ExpenseCategoryList" ("Name", "Description", "SortOrder") VALUES
  ('租金',     '倉庫、辦公室租金', 1),
  ('水電費',   '電費、水費、網路', 2),
  ('設備',     '除濕機、燈具等設備採購', 3),
  ('文具耗材', '膠帶、標籤紙、剪刀等', 4),
  ('人事費用', '兼職薪資', 5),
  ('其他',     '其他雜項費用', 6)
ON CONFLICT DO NOTHING;

-- ⑧ Grant（public）
GRANT SELECT, INSERT, UPDATE, DELETE ON public."C_INV_ConsumableList"             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."C_INV_ConsumablePurchaseList"      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."C_INV_ConsumablePurchaseItemList"  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."C_ORD_OrderConsumableList"         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."S_FIN_ExpenseCategoryList"         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."C_FIN_MonthlyExpenseList"          TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public."C_INV_ConsumableList_ID_seq"             TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."C_INV_ConsumablePurchaseList_ID_seq"      TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."C_INV_ConsumablePurchaseItemList_ID_seq"  TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."C_ORD_OrderConsumableList_ID_seq"         TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."S_FIN_ExpenseCategoryList_ID_seq"         TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public."C_FIN_MonthlyExpenseList_ID_seq"          TO authenticated;


-- ================================================================
--  ██████╗████████╗ █████╗  ██████╗ ██╗███╗   ██╗ ██████╗
-- ██╔════╝╚══██╔══╝██╔══██╗██╔════╝ ██║████╗  ██║██╔════╝
-- ╚█████╗    ██║   ███████║██║  ███╗██║██╔██╗ ██║██║  ███╗
--  ╚═══██╗   ██║   ██╔══██║██║   ██║██║██║╚██╗██║██║   ██║
-- ██████╔╝   ██║   ██║  ██║╚██████╔╝██║██║ ╚████║╚██████╔╝
-- ╚═════╝    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝
-- Schema: staging（測試區）
-- ================================================================

-- ① 耗材品項
CREATE TABLE IF NOT EXISTS staging."C_INV_ConsumableList" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "Name"        VARCHAR(100) NOT NULL,
  "Category"    VARCHAR(20)  NOT NULL DEFAULT '其他',
  "Unit"        VARCHAR(20)  NOT NULL DEFAULT '個',
  "CostPrice"   NUMERIC(10,4) NOT NULL DEFAULT 0,
  "StockQty"    INTEGER NOT NULL DEFAULT 0,
  "Description" TEXT,
  "IsActive"    BOOLEAN NOT NULL DEFAULT true,
  "CreatedDate" TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staging."C_INV_ConsumableList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumable_staff_all" ON staging."C_INV_ConsumableList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ② 耗材進貨單
CREATE TABLE IF NOT EXISTS staging."C_INV_ConsumablePurchaseList" (
  "ID"           BIGSERIAL PRIMARY KEY,
  "PurchaseNo"   VARCHAR(30) NOT NULL,
  "PurchaseDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "Status"       VARCHAR(20) NOT NULL DEFAULT 'draft',
  "Note"         TEXT,
  "CreatedDate"  TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate"  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staging."C_INV_ConsumablePurchaseList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumable_purchase_staff_all" ON staging."C_INV_ConsumablePurchaseList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ③ 耗材進貨明細
CREATE TABLE IF NOT EXISTS staging."C_INV_ConsumablePurchaseItemList" (
  "ID"             BIGSERIAL PRIMARY KEY,
  "PurchaseID"     BIGINT NOT NULL REFERENCES staging."C_INV_ConsumablePurchaseList"("ID") ON DELETE CASCADE,
  "ConsumableID"   BIGINT NOT NULL REFERENCES staging."C_INV_ConsumableList"("ID"),
  "ConsumableName" VARCHAR(100) NOT NULL DEFAULT '',
  "Qty"            INTEGER NOT NULL DEFAULT 1,
  "UnitCost"       NUMERIC(10,4) NOT NULL DEFAULT 0,
  "SubTotal"       NUMERIC(10,2) NOT NULL DEFAULT 0,
  "CreatedDate"    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staging."C_INV_ConsumablePurchaseItemList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumable_purchase_item_staff_all" ON staging."C_INV_ConsumablePurchaseItemList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ④ 訂單耗材使用記錄
CREATE TABLE IF NOT EXISTS staging."C_ORD_OrderConsumableList" (
  "ID"             BIGSERIAL PRIMARY KEY,
  "OrderID"        BIGINT NOT NULL REFERENCES staging."C_ORD_OrderList"("ID") ON DELETE CASCADE,
  "ConsumableID"   BIGINT REFERENCES staging."C_INV_ConsumableList"("ID"),
  "ConsumableName" VARCHAR(100) NOT NULL,
  "Unit"           VARCHAR(20)  NOT NULL DEFAULT '個',
  "Qty"            INTEGER NOT NULL DEFAULT 1,
  "UnitCost"       NUMERIC(10,4) NOT NULL DEFAULT 0,
  "Amount"         NUMERIC(10,2) NOT NULL DEFAULT 0,
  "CreatedDate"    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staging."C_ORD_OrderConsumableList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_consumable_staff_all" ON staging."C_ORD_OrderConsumableList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ⑤ 費用分類設定
CREATE TABLE IF NOT EXISTS staging."S_FIN_ExpenseCategoryList" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "Name"        VARCHAR(50) NOT NULL,
  "Description" TEXT,
  "SortOrder"   INTEGER NOT NULL DEFAULT 0,
  "IsActive"    BOOLEAN NOT NULL DEFAULT true,
  "CreatedDate" TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staging."S_FIN_ExpenseCategoryList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_cat_staff_read"  ON staging."S_FIN_ExpenseCategoryList"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_cat_admin_write" ON staging."S_FIN_ExpenseCategoryList"
  FOR ALL TO authenticated USING (staging.is_admin()) WITH CHECK (staging.is_admin());

-- ⑥ 月度費用記錄
CREATE TABLE IF NOT EXISTS staging."C_FIN_MonthlyExpenseList" (
  "ID"          BIGSERIAL PRIMARY KEY,
  "Year"        INTEGER NOT NULL,
  "Month"       INTEGER NOT NULL CHECK ("Month" BETWEEN 1 AND 12),
  "CategoryID"  BIGINT REFERENCES staging."S_FIN_ExpenseCategoryList"("ID"),
  "Name"        VARCHAR(100) NOT NULL,
  "Amount"      NUMERIC(10,2) NOT NULL DEFAULT 0,
  "Note"        TEXT,
  "CreatedDate" TIMESTAMPTZ DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staging."C_FIN_MonthlyExpenseList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_expense_staff_all" ON staging."C_FIN_MonthlyExpenseList"
  FOR ALL TO authenticated USING (staging.is_staff()) WITH CHECK (staging.is_staff());

-- ⑦ 預設費用分類
INSERT INTO staging."S_FIN_ExpenseCategoryList" ("Name", "Description", "SortOrder") VALUES
  ('租金',     '倉庫、辦公室租金', 1),
  ('水電費',   '電費、水費、網路', 2),
  ('設備',     '除濕機、燈具等設備採購', 3),
  ('文具耗材', '膠帶、標籤紙、剪刀等', 4),
  ('人事費用', '兼職薪資', 5),
  ('其他',     '其他雜項費用', 6)
ON CONFLICT DO NOTHING;

-- ⑧ Grant（staging）
GRANT SELECT, INSERT, UPDATE, DELETE ON staging."C_INV_ConsumableList"             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staging."C_INV_ConsumablePurchaseList"      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staging."C_INV_ConsumablePurchaseItemList"  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staging."C_ORD_OrderConsumableList"         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staging."S_FIN_ExpenseCategoryList"         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staging."C_FIN_MonthlyExpenseList"          TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE staging."C_INV_ConsumableList_ID_seq"             TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE staging."C_INV_ConsumablePurchaseList_ID_seq"      TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE staging."C_INV_ConsumablePurchaseItemList_ID_seq"  TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE staging."C_ORD_OrderConsumableList_ID_seq"         TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE staging."S_FIN_ExpenseCategoryList_ID_seq"         TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE staging."C_FIN_MonthlyExpenseList_ID_seq"          TO authenticated;
