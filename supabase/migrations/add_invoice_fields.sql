-- Add e-invoice fields to C_ORD_OrderList (both schemas must stay in sync)

ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "InvoiceStatus"      VARCHAR(20)  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "InvoiceNo"          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "InvoiceNumber"      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceRandomNum"   VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "InvoiceIssuedAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceNo" VARCHAR(25),
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceAmt" INTEGER;

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "InvoiceStatus"      VARCHAR(20)  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "InvoiceNo"          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "InvoiceNumber"      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "InvoiceRandomNum"   VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "InvoiceIssuedAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceNo" VARCHAR(25),
  ADD COLUMN IF NOT EXISTS "InvoiceAllowanceAmt" INTEGER;
