# 開發摘要 — 2026-05-30 Session

> 本文件為 Claude 對話摘要，供下次 session 快速接續。

---

## 🔴 目前未完成的修改（中斷處）

### issue-invoice 發票金額計算修正（已改檔案，尚未 commit/push）

**問題**：`issue-invoice` 手動補開發票時，金額使用 `FinalAmount`（NT$9,300），但有錢包折抵（NT$200）的訂單應該只開 `NewebpayAmt`（NT$9,100），否則與儲值時已開的發票重複。

**已修改的檔案：**
1. `supabase/functions/issue-invoice/index.ts`
   - `totalAmt` 改用 `NewebpayAmt`（有 `WalletDeductAmt > 0` 時）
   - 運費按比例分攤
2. `src/pages/admin/orders/OrderList.vue`
   - 確認對話框金額改用 `NewebpayAmt`

**⚠️ 這兩個修改尚未 commit 和 push，需要先完成。**

---

## ✅ 今天已完成並部署的修改

### Edge Functions

| 檔案 | 修改內容 |
|------|----------|
| `payment-notify/index.ts` | 補寫 `PaidAt`；計算 `PaymentFee`（信用卡2.8%、ATM 1% 上限NT$20、LINE Pay 2.31%）；付款成功設 `StatusID`=第二個狀態（已付款） |
| `create-payment/index.ts` | 訂單建立時設 `StatusID`=第一個狀態（待付款）；全額錢包補寫 `PaidAt`/`PaymentMethod='wallet'`/`StatusID`/`UpdatedDate` |
| `retry-payment/index.ts` | 加入 `VACC=1`、`LINEPAY=1`、`ExpireDate`（3天）、`CustomerURL`；CVS 訂單附加 CVSCOM/LgsType |
| `wallet-topup/index.ts` | 加入 `LINEPAY=1` |
| `issue-invoice/index.ts` | 補 `import { Buffer } from 'node:buffer'`；Result JSON 字串 parse 防護 |

### 前台 Vue

| 檔案 | 修改內容 |
|------|----------|
| `OrderDetailView.vue` | 運費從 ShippingFee 讀取；有錢包折抵時總計顯示 NewebpayAmt；新增訂單狀態欄位（查 S_ORD_StatusList）；退款訂單隱藏重新付款/ATM 資訊；payStatusLabel 補 refunded→已退款 |
| `OrdersView.vue` | select 加 NewebpayAmt/WalletDeductAmt；金額有錢包折抵時顯示 NewebpayAmt |
| `AccountView.vue` | 同 OrdersView 修正 |
| `CheckoutView.vue` | 電話台灣格式驗證；錯誤訊息移至欄位下方；發票載具選擇（之前 session 已完成） |

### 後台 Vue

| 檔案 | 修改內容 |
|------|----------|
| `OrderList.vue` | 付款方式中文顯示（PAYMENT_METHOD_LABEL map）；退款按鈕依付款方式顯示對應文字；顧客卡加訂單金額+實收金額；金流卡加淨收金額；錢包全額顯示「毋需開立」隱藏開票按鈕；isWalletOnly fallback（NewebpayAmt=0）；標記已出貨自動設 StatusID=shipped + 同步 editStatusId；退款自動設 StatusID=refunded；訂單列表金額改用 NewebpayAmt |
| `AdminUsers.vue` | 新增 email 查詢 UserId 功能（不用手動複製 UUID） |

### DB / RLS

- `S_ORD_StatusList` 加 `member_read_status` policy（authenticated SELECT true）— 已在 Supabase SQL Editor 執行
- `add_invoice_fields.sql` 補齊 `InvoiceCarrierType`/`InvoiceCarrierNum`/`InvoiceLoveCode`/`InvoiceBuyerUBN`/`InvoiceBuyerName` — 已執行

---

## 🚫 不能改動的邏輯

1. **`S_ORD_StatusList` 的 ID 順序**：ID 1=待付款、ID 2=已付款。`payment-notify` 和 `create-payment` 用 `ORDER BY ID ASC LIMIT 2` 取前兩個，改 ID 順序會壞掉
2. **錢包全額付款不走藍新**：`create-payment` 在 `newebpayAmount === 0` 時直接 return `walletOnly:true`，不產生藍新參數
3. **錢包全額付款不開發票**：儲值時已開，消費訂單標記「毋需開立」，不重複開票
4. **PaymentFee 費率**：信用卡 2.8%、ATM 1%（上限 NT$20）、LINE Pay 2.31%（2.2% 未稅含稅後）。費率寫死在 `payment-notify` 的 `calcPaymentFee()`
5. **MerchantOrderNo retry 後綴**：`_R0~R9`，`payment-notify` 用 `replace(/_R\d+$/, '')` 還原原始 OrderNo
6. **OrderDetailView 用 `CustomerEmail` 過濾**：直播訂單如果客人沒有 email 會找不到訂單（已知問題，待修）

---

## ⚠️ 待測試清單

| 項目 | 說明 |
|------|------|
| **後台手動補開發票** | 需先 commit 金額修正，再用 AW_20260530_84983 測試 |
| **retry-payment** | 找待付款訂單，確認藍新頁面有信用卡+ATM+LINE Pay |
| **直播系統端對端** | 場次建立 → 商品對照表 → 留言解析建單 → LINE 通知 → 客人付款 |

---

## 📝 待確認的業務問題

1. **部分退款（折讓）的錢怎麼還客人？** 目前只開折讓不動金流，退款人工處理
2. **退款後庫存要不要回補？** 目前不自動加回
3. **退款後物流狀態要處理嗎？** 目前設計是 ShippingStatus 當歷史紀錄保留

---

## 📁 文件已更新

- `toAdd.md` — 更新至 2026-05-30，新增直播系統待測試區
- `function.md` — 更新至 2026-05-30，所有 Edge Function 和頁面說明同步
- `database-schema.md` — 更新至 2026-05-30，補 wallet tables、invoice carrier 欄位、RLS policy
