-- Add customer invoice preference fields to C_ORD_OrderList
-- InvoiceCarrierType: null=紙本 / '0'=手機條碼 / '1'=自然人憑證 / '2'=ezPay載具 / 'D'=捐贈 / 'B2B'=公司戶

ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierType" VARCHAR(5),
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierNum"  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "InvoiceLoveCode"    VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerUBN"    VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerName"   VARCHAR(60);

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierType" VARCHAR(5),
  ADD COLUMN IF NOT EXISTS "InvoiceCarrierNum"  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "InvoiceLoveCode"    VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerUBN"    VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "InvoiceBuyerName"   VARCHAR(60);
