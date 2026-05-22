-- ================================================================
-- 直播即時搶標功能所需資料表與欄位
-- ================================================================

-- ── C_LIV_SessionList：新增 FB Live 欄位 ──────────────────────
ALTER TABLE public."C_LIV_SessionList"
  ADD COLUMN IF NOT EXISTS "FbPageId"      VARCHAR,
  ADD COLUMN IF NOT EXISTS "FbLiveVideoId" VARCHAR;

ALTER TABLE staging."C_LIV_SessionList"
  ADD COLUMN IF NOT EXISTS "FbPageId"      VARCHAR,
  ADD COLUMN IF NOT EXISTS "FbLiveVideoId" VARCHAR;

-- ── C_LIV_ActiveBidList：追蹤目前開標中的商品 ─────────────────
-- 每個 Code 在一場直播只能同時有一個 open 狀態
-- 售完或手動截標後 Status 改為 closed，可再 insert 新的 open 列（重新開標）

CREATE TABLE IF NOT EXISTS public."C_LIV_ActiveBidList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "SessionID"   BIGINT       NOT NULL,
  "Code"        VARCHAR      NOT NULL,
  "ProductName" VARCHAR,
  "Status"      VARCHAR      NOT NULL DEFAULT 'open',  -- open / closed
  "OpenedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "ClosedAt"    TIMESTAMPTZ,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- 同一場直播同一個 Code 只能有一個 open
CREATE UNIQUE INDEX IF NOT EXISTS "idx_live_active_bid_open"
  ON public."C_LIV_ActiveBidList"("SessionID", "Code")
  WHERE "Status" = 'open';

CREATE TABLE IF NOT EXISTS staging."C_LIV_ActiveBidList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "SessionID"   BIGINT       NOT NULL,
  "Code"        VARCHAR      NOT NULL,
  "ProductName" VARCHAR,
  "Status"      VARCHAR      NOT NULL DEFAULT 'open',
  "OpenedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "ClosedAt"    TIMESTAMPTZ,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_live_active_bid_staging_open"
  ON staging."C_LIV_ActiveBidList"("SessionID", "Code")
  WHERE "Status" = 'open';

-- ── C_LIV_ProcessedCommentList：已處理 FB 留言 ID（去重） ──────
-- FbCommentId：防止同一則留言被處理兩次（跨輪詢去重）
-- FbUserId + DedupKey：防止同一人同款重複下單（格式：CODE|VARIANT_ID）

CREATE TABLE IF NOT EXISTS public."C_LIV_ProcessedCommentList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "SessionID"   BIGINT       NOT NULL,
  "FbCommentId" VARCHAR      NOT NULL,
  "FbUserId"    VARCHAR,
  "DedupKey"    VARCHAR,      -- '{CODE}|{VariantID}'，null 表示非入單留言
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE("SessionID", "FbCommentId")
);

CREATE TABLE IF NOT EXISTS staging."C_LIV_ProcessedCommentList" (
  "ID"          BIGSERIAL    PRIMARY KEY,
  "SessionID"   BIGINT       NOT NULL,
  "FbCommentId" VARCHAR      NOT NULL,
  "FbUserId"    VARCHAR,
  "DedupKey"    VARCHAR,
  "CreatedDate" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE("SessionID", "FbCommentId")
);

-- ── C_ORD_OrderList：新增 LiveCode（方便結標公告查詢） ─────────
ALTER TABLE public."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "LiveCode" VARCHAR;

ALTER TABLE staging."C_ORD_OrderList"
  ADD COLUMN IF NOT EXISTS "LiveCode" VARCHAR;
