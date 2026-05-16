-- ============================================================
-- 錢包系統 Migration
-- 1. C_MBR_WalletList      — 錢包主表（餘額）
-- 2. C_MBR_WalletTxList    — 交易流水帳
-- 3. C_MBR_WalletTopupList — 儲值訂單（連接藍新）
-- 4. C_ORD_OrderList       — 新增 WalletDeductAmt / NewebpayAmt
-- ============================================================

-- ── public schema ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public."C_MBR_WalletList" (
  "ID"          SERIAL      PRIMARY KEY,
  "MemberID"    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  "Balance"     INTEGER     NOT NULL DEFAULT 0 CHECK ("Balance" >= 0),
  "CreatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."C_MBR_WalletTxList" (
  "ID"              SERIAL      PRIMARY KEY,
  "MemberID"        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- TxType: 'topup' | 'order_deduct' | 'refund' | 'adjust'
  "TxType"          VARCHAR(20) NOT NULL,
  "Amount"          INTEGER     NOT NULL,  -- 正數=入帳, 負數=扣款
  "BalanceBefore"   INTEGER     NOT NULL,
  "BalanceAfter"    INTEGER     NOT NULL,
  "RelatedOrderNo"  VARCHAR(50),
  "RelatedTopupNo"  VARCHAR(50),
  "Note"            TEXT,
  "CreatedBy"       UUID,                  -- 管理員手動調整時填入
  "CreatedDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."C_MBR_WalletTopupList" (
  "ID"                 SERIAL      PRIMARY KEY,
  "TopupNo"            VARCHAR(50) NOT NULL UNIQUE,
  "MemberID"           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "Amount"             INTEGER     NOT NULL CHECK ("Amount" > 0),
  -- PaymentStatus: 'pending' | 'paid' | 'failed'
  "PaymentStatus"      VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- InvoiceStatus: 'none' | 'issued'
  "InvoiceStatus"      VARCHAR(20) NOT NULL DEFAULT 'none',
  "InvoiceNo"          VARCHAR(20),
  "InvoiceNumber"      VARCHAR(10),
  "InvoiceRandomNum"   VARCHAR(4),
  "InvoiceIssuedAt"    TIMESTAMPTZ,
  "InvoiceCarrierType" VARCHAR(10),
  "InvoiceCarrierNum"  VARCHAR(50),
  "InvoiceLoveCode"    VARCHAR(10),
  "InvoiceBuyerUBN"    VARCHAR(8),
  "TradeNo"            VARCHAR(50),
  "PaymentMethod"      VARCHAR(20),
  "PaidAt"             TIMESTAMPTZ,
  "CreatedDate"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedDate"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "WalletDeductAmt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "NewebpayAmt"     INTEGER NOT NULL DEFAULT 0;

-- ── staging schema ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staging."C_MBR_WalletList" (
  "ID"          SERIAL      PRIMARY KEY,
  "MemberID"    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  "Balance"     INTEGER     NOT NULL DEFAULT 0 CHECK ("Balance" >= 0),
  "CreatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staging."C_MBR_WalletTxList" (
  "ID"              SERIAL      PRIMARY KEY,
  "MemberID"        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "TxType"          VARCHAR(20) NOT NULL,
  "Amount"          INTEGER     NOT NULL,
  "BalanceBefore"   INTEGER     NOT NULL,
  "BalanceAfter"    INTEGER     NOT NULL,
  "RelatedOrderNo"  VARCHAR(50),
  "RelatedTopupNo"  VARCHAR(50),
  "Note"            TEXT,
  "CreatedBy"       UUID,
  "CreatedDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staging."C_MBR_WalletTopupList" (
  "ID"                 SERIAL      PRIMARY KEY,
  "TopupNo"            VARCHAR(50) NOT NULL UNIQUE,
  "MemberID"           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "Amount"             INTEGER     NOT NULL CHECK ("Amount" > 0),
  "PaymentStatus"      VARCHAR(20) NOT NULL DEFAULT 'pending',
  "InvoiceStatus"      VARCHAR(20) NOT NULL DEFAULT 'none',
  "InvoiceNo"          VARCHAR(20),
  "InvoiceNumber"      VARCHAR(10),
  "InvoiceRandomNum"   VARCHAR(4),
  "InvoiceIssuedAt"    TIMESTAMPTZ,
  "InvoiceCarrierType" VARCHAR(10),
  "InvoiceCarrierNum"  VARCHAR(50),
  "InvoiceLoveCode"    VARCHAR(10),
  "InvoiceBuyerUBN"    VARCHAR(8),
  "TradeNo"            VARCHAR(50),
  "PaymentMethod"      VARCHAR(20),
  "PaidAt"             TIMESTAMPTZ,
  "CreatedDate"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedDate"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "WalletDeductAmt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "NewebpayAmt"     INTEGER NOT NULL DEFAULT 0;
