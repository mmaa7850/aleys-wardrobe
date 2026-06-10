-- Migration: add_expense_date.sql
-- 將 C_FIN_MonthlyExpenseList 的 Year + Month 兩欄合併為 ExpenseDate DATE
-- 頁面名稱同步改為「費用記錄」

-- ── public schema ─────────────────────────────────────────────

-- 1. 新增 ExpenseDate 欄位（暫時允許 NULL）
ALTER TABLE public."C_FIN_MonthlyExpenseList"
  ADD COLUMN IF NOT EXISTS "ExpenseDate" date;

-- 2. 回填舊資料（統一設為當月 1 日）
UPDATE public."C_FIN_MonthlyExpenseList"
  SET "ExpenseDate" = make_date("Year", "Month", 1)
  WHERE "ExpenseDate" IS NULL;

-- 3. 設為 NOT NULL
ALTER TABLE public."C_FIN_MonthlyExpenseList"
  ALTER COLUMN "ExpenseDate" SET NOT NULL;

-- 4. 移除舊欄位
ALTER TABLE public."C_FIN_MonthlyExpenseList"
  DROP COLUMN IF EXISTS "Year",
  DROP COLUMN IF EXISTS "Month";

-- ── staging schema（測試環境）────────────────────────────────

ALTER TABLE staging."C_FIN_MonthlyExpenseList"
  ADD COLUMN IF NOT EXISTS "ExpenseDate" date;

UPDATE staging."C_FIN_MonthlyExpenseList"
  SET "ExpenseDate" = make_date("Year", "Month", 1)
  WHERE "ExpenseDate" IS NULL;

ALTER TABLE staging."C_FIN_MonthlyExpenseList"
  ALTER COLUMN "ExpenseDate" SET NOT NULL;

ALTER TABLE staging."C_FIN_MonthlyExpenseList"
  DROP COLUMN IF EXISTS "Year",
  DROP COLUMN IF EXISTS "Month";
