# Supabase Edge Functions — 部署步驟

## 1. 安裝 Supabase CLI

```powershell
npm install -g supabase
```

## 2. 登入並連結專案

```powershell
supabase login
supabase link --project-ref xyqznatwbfuscocycqtb
```

## 3. 設定 Secrets（只需執行一次）

```powershell
supabase secrets set NEWEBPAY_MERCHANT_ID=MS158966759
supabase secrets set NEWEBPAY_HASH_KEY=bBDPsoH6FcMTSGXQ0CZty3WykpiOsCNl
supabase secrets set NEWEBPAY_HASH_IV=CrMUeQwXGLgGSm4P
supabase secrets set NEWEBPAY_ENV=test
supabase secrets set DB_SCHEMA=staging
supabase secrets set SITE_URL=http://localhost:5173
```

> 正式上線時，將 `NEWEBPAY_ENV` 改為 `prod`，`SITE_URL` 改為正式網址。

## 4. 部署 Edge Functions

```powershell
# 需要用戶 JWT 驗證（前端呼叫）
supabase functions deploy create-payment
supabase functions deploy store-map

# 不需要 JWT 驗證（藍新伺服器端回呼，無 Authorization header）
supabase functions deploy payment-notify --no-verify-jwt
supabase functions deploy store-callback --no-verify-jwt
supabase functions deploy logistics-notify --no-verify-jwt
```

> **重要**：`payment-notify`、`store-callback`、`logistics-notify` 這三個是藍新後端直接 POST 的，
> 不帶 JWT。部署時必須加 `--no-verify-jwt`，或在 Supabase Dashboard →
> Edge Functions → 該 function → 關閉「Enforce JWT Verification」。

## 5. 確認部署成功

```powershell
supabase functions list
```

---

## NotifyURL 說明

`payment-notify` 的 URL 為：
```
https://xyqznatwbfuscocycqtb.supabase.co/functions/v1/payment-notify
```

這是藍新金流在付款完成後，從伺服器端發出通知的位置（幕後通知）。
必須是可從外部存取的 HTTPS 網址（不能是 localhost）。

---

## 測試流程

1. 啟動前端 `npm run dev`
2. 加商品到購物車 → 進入結帳頁
3. 填寫收件資料 → 點「確認送出訂單」
4. 瀏覽器會跳轉到藍新測試金流頁面
5. 使用測試信用卡完成付款
6. 付款成功後跳回 `/order-success/AW-...`
7. 在 Supabase DB 確認訂單 `PaymentStatus` 已更新為 `paid`
