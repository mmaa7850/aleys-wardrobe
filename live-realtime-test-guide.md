---
name: 直播即時搶標功能測試指南
description: live-bid-poll edge function 完整測試步驟
type: project
---

## 完整測試步驟

### 一、前置確認（一次性設定）

**1. 確認 Supabase FB Auth Provider 已設定**
- 打開 [Supabase Dashboard](https://supabase.com/dashboard/project/xyqznatwbfuscocycqtb/auth/providers)
- 點 **Facebook** → 確認 **Enable sign in with Facebook** 已開啟，App ID / App Secret 已填入

**2. 確認你的 FB 帳號是粉絲專頁的管理員**
- 直播監控功能需要用「管理粉專的 FB 帳號」登入後台，才能取得 Page Access Token

**3. 確認測試消費者的 FbName 已在 DB 中**

系統建單時靠 `FbName` 比對會員。需要先讓測試帳號在官網（前台）用 FB 登入過，讓系統建立 FbName 記錄。

最快的測試方式是直接去 Supabase 手動填入：
```sql
-- 在 Supabase SQL Editor 執行（staging schema 測試用）
UPDATE staging."C_MBR_MemberList"
SET "FbName" = '你的 FB 顯示名稱'   -- 完全一致，包含中文
WHERE "Email" = 'your@email.com';
```

> 到 FB 確認名稱：打開 FB → 個人檔案 → 最上面的名字就是 `FbName`

---

### 二、建立直播場次與商品

1. 開啟後台 → **直播場次** → **新增場次**
2. 進入場次詳情 → **商品對照表** → 新增至少一個商品，例如：
   - 代碼：`Q80`
   - 顏色：`藍`
   - 尺寸：`M`
   - 直播特價：`100`（測試用低一點）
3. 記下這個代碼 `Q80`

---

### 三、在 FB 開一個測試直播

> 不需要真的公開直播，可以設「只有我」觀看

1. 打開 [FB 直播製播工具](https://www.facebook.com/live/producer/)
2. 選擇你管理的**粉絲專頁**
3. 選擇觀看對象 → **「只有我（測試）」**
4. 不需要連接相機，直接點「進入直播」或「開始直播」
5. 直播開始後，複製網址列的 video ID（例如 `https://www.facebook.com/your-page/videos/123456789012345` → ID 是 `123456789012345`）

---

### 四、後台連接 FB 並開始監控

> ⚠️ 必須用 FB 帳號登入後台，不能是 email 帳號（需要 provider_token）

1. 如果目前是 email 登入 → 先登出
2. 用管理粉專的 FB 帳號重新登入後台
3. 進入直播場次詳情 → 點 **「直播監控」Tab**
4. 點 **「連接 FB 帳號」**
   - 系統自動抓出你管理的粉專列表，選擇對應粉專
5. 填入直播影片 ID（剛才複製的數字），或點 **「自動偵測」**
6. 點 **「▶ 開始監控」**
   - Tab 上的 badge 會變成紅色閃爍「● 直播中」

---

### 五、測試起標

1. 切換到 **「商品對照表」Tab**
2. 找到 Q80 那一列 → 點 **「▶ 起標」** 按鈕
3. 確認 confirm 彈窗 → 點確定
4. 去 FB 直播留言區確認系統自動發出起標線，格式如下：
   ```
   ======== 起標線 ========
   💰 本標商品：[商品名稱]
   💰 直購標：NT$100
   📝 入單關鍵字：Q80
   留言格式：Q80藍M+1
   ```
5. 切回 **直播監控 Tab** → 「開標中商品」區應出現 Q80 的卡片

---

### 六、測試搶標（消費者留言）

用 FB 帳號（該帳號的 FbName 已在 DB 中），在直播留言輸入：
```
Q80藍M+1
```

等最多 8 秒（下一個輪詢週期），後台「即時入單記錄」應出現這筆：
- 狀態：`✅ 建單成功`
- 有訂單編號 `LIV_YYYYMMDD_XXXXX`
- 如果有綁 LINE，手機會收到 LINE 通知

**可能出現的狀態：**

| 狀態 | 原因 |
|------|------|
| ✅ 建單成功 | 正常 |
| ⚠️ 找不到會員 | FbName 不在 DB，回頭做步驟一第 3 點 |
| ❌ 庫存不足 | 庫存 = 0，先把商品庫存調大 |

---

### 七、測試截標

**方式 A：手動截標**
- 在「開標中商品」卡片點 **「手動截標」**
- FB 直播留言應出現：
  1. `======== 結標線 ========`
  2. 結標公告（列出得標名單與數量）

**方式 B：庫存售完自動截標**
- 把 Q80 的庫存設為 1，讓一個人搶
- 搶完後系統自動發結標線 + 公告

---

### 八、常見問題

| 問題 | 解決方式 |
|------|---------|
| 點「連接 FB 帳號」出現「找不到 FB Token」 | 必須用 FB 帳號登入（不是 email），登出重新用 FB 登入 |
| 「此帳號沒有管理任何粉絲專頁」 | 登入的 FB 帳號不是粉專管理員，換帳號 |
| 自動偵測找不到直播 | 直播可能還沒開始，或改手動貼 video ID |
| 留言後沒有建單 | 檢查 FbName 是否完全一致（含空格、中英文）|
| Edge function 回傳 403 | 後台帳號不在 `S_SYS_AdminUserList` 或 `IsActive = false` |
| 起標按鈕是灰色 | 需先在「直播監控」Tab 開始監控才能起標 |

---

### 九、測試環境資訊

| 項目 | 值 |
|------|---|
| Supabase 專案 | `xyqznatwbfuscocycqtb` |
| 本地 DB Schema | `staging`（`.env.development` 設定）|
| Edge Function DB_SCHEMA | 已設定（見 Supabase Secrets）|
| Edge Function | `live-bid-poll`（已部署 2026-05-22）|
| 輪詢間隔 | 每 8 秒 |
