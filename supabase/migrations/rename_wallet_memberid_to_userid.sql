-- ============================================================
-- 錢包表 MemberID 改名為 UserID
--
-- 原因：C_MBR_WalletList / C_MBR_WalletTxList / C_MBR_WalletTopupList 的
-- "MemberID" 欄位實際存的是 auth.users.id（UUID，REFERENCES auth.users(id)），
-- 而不是 C_MBR_MemberList.ID（C_CART_CartList / C_MBR_WishList 的 MemberID
-- 才是這個意思）。同名不同義容易混淆，改名為 UserID 以符合實際語意
-- （對照 C_MBR_MemberList.UserID 欄位的命名）。
--
-- 純改名，不變更資料、FK 對象或任何查詢邏輯；PostgreSQL 會自動更新
-- 依賴此欄位的 index / constraint / RLS policy 內部定義。
-- ============================================================

ALTER TABLE public."C_MBR_WalletList"      RENAME COLUMN "MemberID" TO "UserID";
ALTER TABLE public."C_MBR_WalletTxList"    RENAME COLUMN "MemberID" TO "UserID";
ALTER TABLE public."C_MBR_WalletTopupList" RENAME COLUMN "MemberID" TO "UserID";

ALTER TABLE staging."C_MBR_WalletList"      RENAME COLUMN "MemberID" TO "UserID";
ALTER TABLE staging."C_MBR_WalletTxList"    RENAME COLUMN "MemberID" TO "UserID";
ALTER TABLE staging."C_MBR_WalletTopupList" RENAME COLUMN "MemberID" TO "UserID";
