-- ================================================================
-- Migration: add_member_level_spending
-- 會員等級累積金額門檻 + 兩年到期降一級機制
-- ================================================================

-- ── 1. 會員等級加「維持門檻」欄位 ────────────────────────────
-- MinSpendingAmount：兩年內需累積消費此金額才能維持等級
-- 最基礎等級設 0（不會被降）

ALTER TABLE public."S_MBR_MemberLevelList"
  ADD COLUMN IF NOT EXISTS "MinSpendingAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE staging."S_MBR_MemberLevelList"
  ADD COLUMN IF NOT EXISTS "MinSpendingAmount" INTEGER NOT NULL DEFAULT 0;

-- ── 2. 會員主表加「等級更新時間」欄位 ────────────────────────
-- LevelUpdatedAt：最後一次升/降等的時間（兩年計算起點）

ALTER TABLE public."C_MBR_MemberList"
  ADD COLUMN IF NOT EXISTS "LevelUpdatedAt" TIMESTAMPTZ;

ALTER TABLE staging."C_MBR_MemberList"
  ADD COLUMN IF NOT EXISTS "LevelUpdatedAt" TIMESTAMPTZ;

-- ── 3. public schema：每月檢查降級函數 ───────────────────────
CREATE OR REPLACE FUNCTION public.check_member_level_demotion()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  m            RECORD;
  spending     NUMERIC;
  prev_level   BIGINT;
BEGIN
  FOR m IN
    SELECT
      mb."ID",
      mb."Email",
      mb."MemberLevelID",
      mb."LevelUpdatedAt",
      lv."MinSpendingAmount",
      lv."SortOrder"
    FROM   public."C_MBR_MemberList"      mb
    JOIN   public."S_MBR_MemberLevelList" lv ON lv."ID" = mb."MemberLevelID"
    WHERE  mb."IsActive"                  = true
    AND    mb."LevelUpdatedAt"            IS NOT NULL
    AND    mb."LevelUpdatedAt"            < NOW() - INTERVAL '2 years'
    AND    lv."MinSpendingAmount"         > 0        -- 最基礎等級(=0)不檢查
  LOOP
    -- 計算這兩年內（從 LevelUpdatedAt 起算）的累積消費
    SELECT COALESCE(SUM(o."FinalAmount"), 0) INTO spending
    FROM   public."C_ORD_OrderList" o
    WHERE  o."CustomerEmail" = m."Email"
    AND    o."PaymentStatus" = 'paid'
    AND    o."CreatedDate"  >= m."LevelUpdatedAt"
    AND    o."CreatedDate"  <  m."LevelUpdatedAt" + INTERVAL '2 years';

    IF spending < m."MinSpendingAmount" THEN
      -- 找比目前等級低一級的等級（SortOrder 小 1 且最接近）
      SELECT "ID" INTO prev_level
      FROM   public."S_MBR_MemberLevelList"
      WHERE  "SortOrder" < m."SortOrder"
      AND    "IsActive"  = true
      ORDER  BY "SortOrder" DESC
      LIMIT  1;

      IF prev_level IS NOT NULL THEN
        UPDATE public."C_MBR_MemberList"
        SET    "MemberLevelID"  = prev_level,
               "LevelUpdatedAt" = NOW(),
               "UpdatedDate"    = NOW()
        WHERE  "ID" = m."ID";
      END IF;
    ELSE
      -- 達標：重置兩年起算點
      UPDATE public."C_MBR_MemberList"
      SET    "LevelUpdatedAt" = NOW(),
             "UpdatedDate"    = NOW()
      WHERE  "ID" = m."ID";
    END IF;
  END LOOP;
END;
$func$;

-- ── 4. staging schema：每月檢查降級函數 ──────────────────────
CREATE OR REPLACE FUNCTION staging.check_member_level_demotion()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  m            RECORD;
  spending     NUMERIC;
  prev_level   BIGINT;
BEGIN
  FOR m IN
    SELECT
      mb."ID",
      mb."Email",
      mb."MemberLevelID",
      mb."LevelUpdatedAt",
      lv."MinSpendingAmount",
      lv."SortOrder"
    FROM   staging."C_MBR_MemberList"      mb
    JOIN   staging."S_MBR_MemberLevelList" lv ON lv."ID" = mb."MemberLevelID"
    WHERE  mb."IsActive"                   = true
    AND    mb."LevelUpdatedAt"             IS NOT NULL
    AND    mb."LevelUpdatedAt"             < NOW() - INTERVAL '2 years'
    AND    lv."MinSpendingAmount"          > 0
  LOOP
    SELECT COALESCE(SUM(o."FinalAmount"), 0) INTO spending
    FROM   staging."C_ORD_OrderList" o
    WHERE  o."CustomerEmail" = m."Email"
    AND    o."PaymentStatus" = 'paid'
    AND    o."CreatedDate"  >= m."LevelUpdatedAt"
    AND    o."CreatedDate"  <  m."LevelUpdatedAt" + INTERVAL '2 years';

    IF spending < m."MinSpendingAmount" THEN
      SELECT "ID" INTO prev_level
      FROM   staging."S_MBR_MemberLevelList"
      WHERE  "SortOrder" < m."SortOrder"
      AND    "IsActive"  = true
      ORDER  BY "SortOrder" DESC
      LIMIT  1;

      IF prev_level IS NOT NULL THEN
        UPDATE staging."C_MBR_MemberList"
        SET    "MemberLevelID"  = prev_level,
               "LevelUpdatedAt" = NOW(),
               "UpdatedDate"    = NOW()
        WHERE  "ID" = m."ID";
      END IF;
    ELSE
      UPDATE staging."C_MBR_MemberList"
      SET    "LevelUpdatedAt" = NOW(),
             "UpdatedDate"    = NOW()
      WHERE  "ID" = m."ID";
    END IF;
  END LOOP;
END;
$func$;

-- ── 5. 每月 1 日 02:00 UTC 執行降級檢查 ──────────────────────
SELECT cron.schedule(
  'check-member-level-demotion',
  '0 2 1 * *',
  'SELECT public.check_member_level_demotion(); SELECT staging.check_member_level_demotion();'
);
