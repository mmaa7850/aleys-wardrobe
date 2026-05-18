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

使用者需要：
1. 去 https://developers.facebook.com 用**自己的 FB 帳號**登入並開啟開發者模式
2. 建立 App（名稱：Aley's Wardrobe，類型：Facebook Login）
3. 在 Facebook Login → Settings 填入 Valid OAuth Redirect URI：
   ```
   https://xyqznatwbfuscocycqtb.supabase.co/auth/v1/callback
   ```
4. 從 App Settings → Basic 複製 **App ID** 和 **App Secret**
5. 把這兩個值交給開發者，填入 Supabase Dashboard → Authentication → Providers → Facebook

**注意：** 目前代碼已完成（`provider: "facebook"`），只差 Supabase 端的 App ID / Secret 填入就能啟用。

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
