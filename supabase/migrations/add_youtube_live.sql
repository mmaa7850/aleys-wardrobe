-- YouTube 直播 ID 欄位
ALTER TABLE staging."C_LIV_SessionList"
  ADD COLUMN IF NOT EXISTS "YtVideoId" VARCHAR(30);

ALTER TABLE public."C_LIV_SessionList"
  ADD COLUMN IF NOT EXISTS "YtVideoId" VARCHAR(30);

-- ── 站內聊天訊息表（staging）────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging."C_LIV_ChatMessageList" (
  "ID"          BIGSERIAL   PRIMARY KEY,
  "SessionID"   BIGINT      NOT NULL REFERENCES staging."C_LIV_SessionList"("ID") ON DELETE CASCADE,
  "UserID"      UUID        NOT NULL REFERENCES auth.users("id"),
  "SenderName"  TEXT        NOT NULL,
  "Message"     TEXT        NOT NULL CHECK (char_length("Message") <= 200),
  "CreatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session_staging
  ON staging."C_LIV_ChatMessageList"("SessionID", "CreatedDate" ASC);

ALTER TABLE staging."C_LIV_ChatMessageList" ENABLE ROW LEVEL SECURITY;

-- 所有人可讀（直播頁公開顯示留言）
CREATE POLICY "chat_select" ON staging."C_LIV_ChatMessageList"
  FOR SELECT USING (true);

-- 登入會員只能新增自己的留言
CREATE POLICY "chat_insert" ON staging."C_LIV_ChatMessageList"
  FOR INSERT WITH CHECK (auth.uid() = "UserID");

-- 管理員可刪（清除不當留言）
CREATE POLICY "chat_admin_delete" ON staging."C_LIV_ChatMessageList"
  FOR DELETE USING (staging.is_admin());

-- ── 站內聊天訊息表（public）─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."C_LIV_ChatMessageList" (
  "ID"          BIGSERIAL   PRIMARY KEY,
  "SessionID"   BIGINT      NOT NULL REFERENCES public."C_LIV_SessionList"("ID") ON DELETE CASCADE,
  "UserID"      UUID        NOT NULL REFERENCES auth.users("id"),
  "SenderName"  TEXT        NOT NULL,
  "Message"     TEXT        NOT NULL CHECK (char_length("Message") <= 200),
  "CreatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session_public
  ON public."C_LIV_ChatMessageList"("SessionID", "CreatedDate" ASC);

ALTER TABLE public."C_LIV_ChatMessageList" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select" ON public."C_LIV_ChatMessageList"
  FOR SELECT USING (true);

CREATE POLICY "chat_insert" ON public."C_LIV_ChatMessageList"
  FOR INSERT WITH CHECK (auth.uid() = "UserID");

CREATE POLICY "chat_admin_delete" ON public."C_LIV_ChatMessageList"
  FOR DELETE USING (public.is_admin());
