---
name: 上線前第三方帳號憑證清單
description: 所有需要在正式上線前切換成使用者自己帳號的第三方服務設定
type: project
originSessionId: 4a6c0d20-125e-4c36-9852-4d6bbf7d49bb
---
## 狀態說明
- ✅ 已完成
- ⏳ 等待使用者操作
- ❌ 尚未開始

---

## Facebook OAuth（最優先）

**狀態：⏳ 等待使用者操作**

### Step 1：建立 FB 應用程式（已進行中）
1. 前往 https://developers.facebook.com，用自己的 FB 帳號登入並完成開發者驗證
2. 建立 App：
   - 用途選「其他」→「商業」→ **管理粉絲專頁的所有內容**（此 use case 包含 `pages_read_engagement`）
   - App 名稱：Aley's Wardrobe
3. App 建立後，左側選單點「新增產品」→ 加入 **Facebook Login**
4. 進入 **Facebook Login → 設定**，在「有效的 OAuth 重新導向 URI」填入：
   ```
   https://xyqznatwbfuscocycqtb.supabase.co/auth/v1/callback
   ```
5. 從 **應用程式設定 → 基本資料** 複製 **應用程式編號（App ID）** 和 **應用程式密鑰（App Secret）**

### Step 2：填入 Supabase（⚠️ 不是 Edge Functions Secrets）
1. 開啟 Supabase Dashboard → 左側選單 **Authentication** → 上方 tab **Providers**
2. 找到 **Facebook**，展開
3. 開啟 **Enable sign in with Facebook** 開關
4. 填入 App ID 和 App Secret
5. **開啟 Allow users without an email**（部分 FB 帳號沒有綁定 email，不開啟這些用戶會登入失敗）
6. 儲存後，Supabase 會顯示 Callback URL（格式：`https://xyqznatwbfuscocycqtb.supabase.co/auth/v1/callback`）
   - 確認與 Step 1 填入的 URI 一致即可

### Step 3：FB App Review（上線前必須完成）
- 開發模式下可供自己測試，不需 App Review
- 正式上線前需提交審核以下**兩個**權限（同一個 App，同一次審核提交）：
  - `pages_read_engagement`：讀取粉絲專頁直播留言（搶標入單用）
  - `pages_manage_engagement`：以系統身份在直播中發布結標線、結標公告
- **審核影片需展示以下流程：**
  1. 管理後台連接 FB 帳號，選擇粉絲專頁，偵測並填入直播影片 ID
  2. 開始監控後，系統即時讀取消費者留言並自動建立訂單
  3. 庫存售完時，系統自動在直播留言發出「`======== 結標線 ========`」
  4. 系統緊接著發出結標公告（格式：`結標公告：第 Q80 標 [商品名] $[價格] 客人甲x1 客人乙x1`）
  5. 管理員也可點「手動截標」觸發上述第 3、4 步
- 詳細審核流程請參考 `fb_app_review.md`

**注意：** 目前程式碼已完成（`provider: "facebook"`），只差 Supabase 端的 App ID / Secret 填入就能啟用 FB 登入功能。

---

## 藍新金流（NewebPay）

**狀態：⏳ 等待使用者操作**

- 目前使用：開發者的測試商號
- 上線前需要：使用者申請自己的藍新商號，取得正式的：
  - `MerchantID`
  - `HashKey`
  - `HashIV`
- 填入位置：Supabase Edge Functions Secrets（`NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV`）
- 同時將 `NEWEBPAY_ENV` 從 `test` 改成 `prod`

---

## ezPay 電子發票

**狀態：❌ 使用者尚未申請帳號**

- 申請網址：https://www.ezpay.com.tw
- 申請後需要：
  - `EZPAY_MERCHANT_ID`
  - `EZPAY_HASH_KEY`
  - `EZPAY_HASH_IV`
- 填入位置：Supabase Edge Functions Secrets
- 同時將 `EZPAY_ENV` 從 `test` 改成 `prod`

---

## LINE Official Account（LINE OA 通知）

**狀態：⏳ 等待使用者操作**

- 目前使用：開發者的 LINE Channel
- 上線前需要：使用者自己的 LINE OA Channel Access Token
- 填入位置：Supabase Edge Functions Secrets（`LINE_CHANNEL_ACCESS_TOKEN`）

---

## Google Analytics 4（GA4）

**狀態：⏳ 等待使用者操作**

- 目前使用：開發者的 GA4 測量 ID
- 上線前需要：使用者建立自己的 GA4 屬性，取得 Measurement ID（格式：`G-XXXXXXXXXX`）
- 填入位置：`.env.production` 的 `VITE_GA_ID`，重新部署 Vercel

---

## Supabase 專案

**狀態：⏳ 待確認**

- 目前使用：開發者建立的 Supabase 專案
- 上線前確認：是否要移轉到使用者自己的 Supabase 帳號（需要 migrate 資料庫和 Edge Functions）
- 如果不移轉：把使用者加為 Supabase 專案的 Owner

---

## Vercel 部署

**狀態：⏳ 待確認**

- 目前使用：開發者的 Vercel 帳號
- 上線前確認：是否要移轉到使用者自己的 Vercel 帳號，並綁定使用者自己的網域

---

## 自訂網域

**狀態：❌ 尚未設定**

- 使用者需要購買並設定自己的網域（例如 `aleyswardrobe.com`）
- 設定位置：Vercel 專案 → Domains
- 同時更新 Supabase → Authentication → URL Configuration → Site URL
