-- 為 C_ORD_OrderList 新增 TradeNo（藍新交易序號）欄位
-- 用於信用卡退款 API（NPA-B032）的 IndexType=2 呼叫
-- 需在 staging 和 public 兩個 schema 各執行一次

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "TradeNo" varchar(20);

ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "TradeNo" varchar(20);
