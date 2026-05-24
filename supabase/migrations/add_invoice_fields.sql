-- Add e-invoice fields to C_ORD_OrderList + ATM fields to C_MBR_WalletTopupList (both schemas must stay in sync)

ALTER TABLE public."C_MBR_WalletTopupList"
  ADD COLUMN IF NOT EXISTS "ATMBankCode"   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "ATMAccount"    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "ATMExpireDate" DATE;

ALTER TABLE staging."C_MBR_WalletTopupList"
  ADD COLUMN IF NOT EXISTS "ATMBankCode"   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "ATMAccount"    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "ATMExpireDate" DATE;

-- Add e-invoice fields to C_ORD_OrderList

ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "InvoiceStatus"        VARCHAR(20)  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "InvoiceNo"            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "InvoiceNumber"        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceRandomNum"     VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "InvoiceIssuedAt"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceNo"   VARCHAR(25),
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceAmt"  INTEGER,
  -- invoice carrier / recipient info stored at order time
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierType"   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierNum"    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "InvoiceLoveCode"      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerUBN"      VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerName"     VARCHAR(100);

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "InvoiceStatus"        VARCHAR(20)  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "InvoiceNo"            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "InvoiceNumber"        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceRandomNum"     VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "InvoiceIssuedAt"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceNo"   VARCHAR(25),
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceAmt"  INTEGER,
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierType"   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierNum"    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "InvoiceLoveCode"      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerUBN"      VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerName"     VARCHAR(100);
