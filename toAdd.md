# Aley's Wardrobe — 待開發功能清單

---

## 1. FB 直播留言喊單 → 自動加入購物車

**概念：** 直播主在 Facebook 直播留言區喊單（例如留言「+1 黑色 M」），系統自動解析留言並將商品加入對應會員的購物車。

**需研究：**
- Facebook Graph API（取得直播留言串）
- 留言格式解析規則（商品編號/顏色/尺寸的對應）
- 會員綁定機制（如何對應 FB 帳號與網站會員）
- Webhook 或輪詢方式即時同步

---

## 2. 庫存管理（部分完成）

**現況：** `C_PRD_ProductVariantList` 有 `StockQty` 欄位，付款成功後 `payment-notify` 會扣庫存。

**已完成：**
- ✅ 後台庫存總覽（`/admin/inventory/overview`）：各 variant 剩餘數量、低庫存/售完警示、篩選
- ✅ 前台商品詳情頁顯示「庫存不足」/「已售完」狀態

**待做：**
- 手動調整庫存功能（放在商品編輯頁內）

---

## 3. 訂單出貨流程（藍新 CVSCOM）

**現況：**
- 付款/取號完成後，藍新自動建立物流單並在 `payment-notify` / `payment-return` 回傳 `LgsNo`（寄件代碼）、`StoreCode`、`StoreName` 等，寫入 `C_ORD_OrderList`
- `logistics-notify` 已接收 NPA-B58 推播，自動更新 `ShippingStatus` / `ShippingStatusText`
- 客戶訂單頁顯示取貨門市與「出貨後收簡訊通知」說明

**待做：**
- 後台訂單列表加入「出貨操作」：商家確認商品備好後，需帶著 LgsNo 至指定門市的 ibon 機台列印寄件單，後台應顯示 LgsNo 並有「標記已出貨」按鈕更新 ShippingStatus
- 前台訂單詳情頁在商家出貨後顯示物流追蹤狀態（目前 ShippingStatusText 已有但樣式待確認）

---

## 4. 商品詳情頁：一次加入多件 ✅

**已完成：** 數量選擇器（− / 數字 / +）、上限卡庫存、換 variant 自動重置為 1、未登入導向 /login。

---

## 5. Google Analytics 整合

**待做：**
- 申請 GA4 屬性，取得 Measurement ID
- 在 `index.html` 或 Vue 入口加入 gtag.js
- 設定關鍵事件追蹤：
  - 商品瀏覽（`view_item`）
  - 加入購物車（`add_to_cart`）
  - 開始結帳（`begin_checkout`）
  - 購買完成（`purchase`）

---

## 6. 優惠券流程（後端完成，前台待實作）

**現況：** 後台有 `SetCoupons` 頁面（建立優惠券）；`create-payment` Edge Function 已完成後端驗證與折扣計算。

**已完成：**
- ✅ `create-payment` Edge Function 後端驗證優惠券（有效期、使用次數、啟用狀態）
- ✅ 計算折扣金額，寫入訂單 `DiscountAmount` / `FinalAmount`
- ✅ 付款建立後自動扣除 `UsageCount`

**待做：**
- 結帳頁加入優惠券輸入欄 + 套用按鈕（呼叫後端先行驗證，顯示折扣金額預覽）
- 訂單摘要顯示折扣明細（原價 / 折扣 / 實付）

---

## 7. 後台系統設定功能

**現況：** 後台有以下設定頁面，部分功能尚未完整實作：

| 設定頁面 | 路由 | 功能說明 |
|----------|------|----------|
| 付款方式設定 | `/admin/settings/setpaymethods` | 啟用/停用各付款方式（信用卡/超商/ATM 等）|
| 配送方式設定 | `/admin/settings/setshippingmethods` | 啟用/停用配送方式、設定運費 |
| 系統設定分類 | `/admin/settings/setconfigcategories` | 管理設定項目的分類群組 |
| 系統設定 | `/admin/settings/setconfig` | **全站開關設定**，包含： |

**`setconfig` 預計功能（已知）：**
- **維修模式 / 關閉付款開關**：一鍵停用全站付款功能（例如網站維護、金流問題時使用）
- 其他全站設定（待補充）

**待做：**
- 確認 `setconfig` 的完整設定項目
- 前台結帳時讀取設定，若付款關閉則顯示提示並擋住付款流程

---

## 8. 未完成頁面實作

以下頁面路由已存在但功能尚未完整實作（需逐一確認）：

- **Banner 管理** (`/admin/marketing/setbanners`)：後台 Banner CRUD 是否完成？首頁是否已串接動態 Banner？
- **優惠券管理** (`/admin/marketing/setcoupons`)：後台建立介面是否完整？
- **i18n 多語系**：語言切換介面已有但實際翻譯內容是否完整？
- **其他待確認頁面**：開發過程中發現哪些頁面殼建好但邏輯未完成，請列入此處

---

## 優先順序建議

| 優先 | 功能 |
|------|------|
| 高 | 庫存管理後台介面（基本營運必須）|
| 高 | 商品詳情頁多件加入購物車 |
| 高 | 優惠券前台結帳 UI（後端已完成） |
| 中 | 訂單出貨流程釐清 |
| 中 | Google Analytics |
| 中 | 後台系統設定完整實作 |
| 低 | FB 直播留言喊單（複雜度高，需另行規劃）|
