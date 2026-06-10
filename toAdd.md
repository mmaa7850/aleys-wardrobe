# Aley's Wardrobe — 待開發功能清單

> 更新時間：2026-06-08

---

## ✅ 已完成

- **商品層級預購**：`IsPreOrder` + `PreOrderShipDate` + `PreOrderNote`；庫存歸零自動切預購模式，前台顯示 badge + 出貨日，按鈕改「立即預購」
- **宅配到府出貨**：後台訂單填物流公司 + 單號 → `HomeDeliveryNo` / `HomeDeliveryCompany`；前台訂單詳情顯示可點擊的物流查詢連結（黑貓、新竹、郵局）
- **優惠券管理**：手動優惠碼 + 滿額自動折抵（`IsAutoApply`）、使用次數管理、前後端雙重驗證
- **Banner 管理**：後台可上傳圖片至 Storage（`banners` bucket）、選擇顯示位置、日期排程；前台首頁 `home-hero`（填入裝飾框內）、`home-banner`（Ticker 下方全寬橫幅），多張自動輪播
- **後台 UI 重設計**：深色側欄（`#1a1714`）+ 暖米色主體（`#faf7f4`）+ 金色 Bootstrap 覆寫（按鈕、卡片、表格、表單、Modal、分頁）
- **SetConfig 前台消費**：`useSiteConfigStore` 從 `S_SYS_Config` 載入所有設定值；前台 Layout 自動顯示 `announcement` 公告欄；支援 `maintenance_mode`、`payment_disabled` 旗標
- **i18n 英文翻譯完整化**：修正 en-US.js 中所有使用原始欄位名（`SetColors`、`UpdatedDate`、`DiscountValue` 等）的翻譯值，改為正常英文標籤
- **訂單紀錄獨立頁面**：從會員中心拆出，獨立路由 `/orders`；完整列表依時間倒序、四色付款狀態 badge；會員中心改為顯示最近 3 筆訂單預覽並附「查看全部」連結
- **LINE OA 浮動按鈕**：前台右下角固定懸浮 LINE 圖示按鈕；點擊開新分頁連至 LINE 官方帳號；網址透過後台「系統設定」Key `line_oa_url` 控制，未設定時自動隱藏
- **後台報表模組**：新增「報表」側欄群組（Chart.js）；5 張報表全部完成：
  - **銷售總覽** `/admin/reports/sales`：今日/本週/本月/自訂；營收/訂單數/客單價/退款 stat card；低庫存警示；每日折線圖
  - **商品排行** `/admin/reports/products`：依金額或數量排序；本週/本月/近3月/自訂；前3名獎牌
  - **優惠券效益** `/admin/reports/coupons`：使用次數/使用率進度條/折扣總額/帶動營收；7天內到期標黃
  - **訂單狀態分佈** `/admin/reports/orders`：甜甜圈圖 + 付款狀態明細表
  - **會員成長趨勢** `/admin/reports/members`：近12月柱狀圖；累積會員/本月活躍/回購會員 stat card
- **錢包系統**：`/wallet` 頁面（餘額/儲值/ATM 待付款顯示）；Edge Functions：`wallet-topup`、`wallet-topup-notify`、`wallet-topup-return`、`wallet-adjust`、`wallet-refund`；結帳頁可折抵錢包；全額折抵不送藍新；DB：`C_MBR_WalletList`/`C_MBR_WalletTopupList`/`C_MBR_WalletTxList`
- **結帳頁 UX 改善**：錯誤訊息移至各欄位下方（姓名/電話/地址/發票分別顯示）；電話驗證改為台灣格式（`/^0\d{8,9}$/`，允許連字號）；紅色邊框 + inline error text
- **結帳頁電子發票載具選擇**：紙本（預設）/ 手機條碼 / 自然人憑證 / 捐贈碼 / 公司戶三聯式；前端格式驗證；發票載具欄位存入訂單（`InvoiceCarrierType` 等）
- **retry-payment 修正**：加入 VACC=1、LINEPAY=1、ATM ExpireDate（3天）、CustomerURL；超商取貨附加 CVSCOM/LgsType；使用 `NewebpayAmt`（扣除錢包後金額）；移除 LoginType 多餘參數
- **payment-notify 補強**：付款成功自動寫入 `PaidAt`；計算並存入 `PaymentFee`（信用卡2.8%、ATM 1% 上限NT$20、LINE Pay 2.31%）；自動設訂單狀態為第二個狀態（已付款）
- **create-payment 補強**：訂單建立時即設 StatusID=第一個狀態（待付款）；全額錢包付款補寫 `PaidAt`/`PaymentMethod='wallet'`/`StatusID`=第二個狀態/`UpdatedDate`
- **訂單狀態自動化**：下單→待付款；付款→已付款；標記已出貨→已出貨；退款→已退款（依 `S_ORD_StatusList.Name` 查找，不硬寫 ID）
- **後台訂單詳情 UX 大幅改善**：付款方式顯示中文（VACC→ATM虛擬帳號等）；退款按鈕依付款方式顯示對應文字；顧客資訊卡加「訂單金額」+「實收金額」；金流資訊卡加「淨收金額」（實付－手續費）；錢包全額付款顯示「毋需開立」並隱藏開立發票按鈕；訂單列表金額有錢包折抵時顯示 NewebpayAmt
- **前台訂單詳情 UX 改善**：運費正確從 ShippingFee 讀取；有錢包折抵時訂單總計顯示 NewebpayAmt；新增「訂單狀態」欄位（從 S_ORD_StatusList 查中文名稱）；退款訂單不顯示重新付款/ATM轉帳資訊；payStatusLabel 補 refunded→已退款；訂單列表/會員中心金額同步修正
- **wallet-topup 加入 LINE Pay**：`LINEPAY=1` 加入儲值付款選項
- **LINE Pay 儲值/結帳全程測試通過**（沙盒環境）
- **LINE 帳號綁定**：LINE OA Follow 觸發 `line-webhook`→建立 `LineBindToken`→私訊綁定連結；會員點連結進 `/bind-line`→呼叫 `line-bind`→寫入 `LineUserID`；Unfollow 時自動清除
- **FB OAuth 登入後擷取 FbName**：前台 FB 登入後將 `user_metadata.full_name` 存入 `C_MBR_MemberList.FbName`，供直播留言比對
- **購物車拆分現貨/預購**：購物車頁面分兩個區塊，各自「前往結帳」按鈕帶 `?type=stock` / `?type=preorder`；加入購物車時即扣庫存（`decrement_stock`），移除時回補；前台查詢加 `CancelledAt IS NULL` 過濾
- **預購出貨說明改固定文字**：商品頁/購物車/結帳頁一律顯示「三週內出貨」；移除 `PreOrderShipDate` UI 引用；後台商品編輯移除精確出貨日欄位
- **訂單 OrderType 欄位**：`create-payment` 存入 `OrderType`（`stock`/`preorder`）；前台訂單列表/會員中心對預購訂單顯示「預購」badge
- **管理者 Email → UserId 查詢工具**：管理者帳號頁面新增工具欄，輸入 Email 自動查出對應 UUID，方便新增後台帳號
- **週銷單機制（pg_cron）**：每週日 16:00 UTC（台灣週一 00:00）自動執行：取消 `pending`/`failed` 訂單、`restore_stock` 回補庫存、軟刪除購物車現貨品（`CancelledAt`，預購品保留）、同步回補購物車庫存；也可從後台「待結清單」手動觸發 `cancel-orders`
- **銷單自動封鎖會員**：`cancel-orders` 執行後依 `CustomerEmail` 找到對應會員設 `IsBlocked=true`；`live-import` 建單前檢查，封鎖者拒絕建單（回傳 `status='blocked'`）
- **後台會員購物車管理**：會員列表新增「購物車」按鈕，開 Modal 顯示品項（含商品名稱/顏色/尺寸/數量）；逐筆移除並回補庫存（`manage-member-cart` Edge Function，service_role 繞過 RLS）；支援合併同款品項、數量調整
- **PendingList Tab2 被封鎖名單**：`/admin/orders/pending` 新增 Tab2「本週被封鎖名單」，呼叫 `get-blocked-members` Edge Function，顯示本週銷單後被封鎖的會員及其被取消的購物車品項明細
- **直播即時搶標（live-bid-poll 起標）**：`start_bid` action — 起標時在 FB 直播貼出格式化起標公告（含商品名稱、直播價、留言格式範例）並在 `C_LIV_ActiveBidList` 建立 open 記錄；後台場次詳情「起標」按鈕（已開標中顯示「● 開標中」badge，未直播時 disable）
- **批次進貨 / 成本追蹤 / 毛利報表**：6 張新資料表 + 3 個欄位異動；供應商 CRUD、成本項目 CRUD、進貨單列表 / 詳情（加權平均成本計算 + 庫存更新）；出貨 Modal 補箱數自動計算 `ActualShippingCost`；訂單詳情補「額外成本」區塊；毛利報表（日期篩選 + 成本拆解）；`create-payment` 快照 `UnitCost`
- **耗材管理系統 + 月度費用 + 賣場淨利報表**：耗材品項 CRUD（包材/贈品/其他）；耗材進貨單（加權平均成本更新）；訂單詳情新增耗材用量記錄區塊（出貨時選品項填數量，成本自動帶入）；費用分類設定、月度費用記錄頁面；賣場淨利報表（訂單毛利 − 月度費用 = 本月淨利）；毛利報表補耗材成本欄；migration `add_consumables_system.sql`（public/staging 分區）
- **Redeploy 後舊 chunk 消失導致按鈕失效修正**：`main.js` 監聽 `vite:preloadError` + `router.onError` 捕捉 `ChunkLoadError`，自動重新整理到最新版本
- **GA4 追蹤碼整合**：`gtag.js` 已完成（`initGA` / `trackPageView` / `trackViewItem` / `trackAddToCart` / `trackBeginCheckout` / `trackPurchase` / `setUserId`）；GA4 資料串流已建立；Vercel 測試專案已加入 `VITE_GA_MEASUREMENT_ID`；登入後自動傳會員 ID 給 GA4（User-ID 精準識別）
- **加入購物車前強制登入並綁定 LINE**：未登入 → 導向 `/login?redirect=`；已登入但未綁定 LINE → 導向 `/account?requireLine=1`（頁面顯示黃色提示條並自動捲動到 LINE 綁定區塊）
- **購物車 Bug 修正**：① `loadAdminProfile` 改 `.maybeSingle()`，消費者不在後台帳號表時不再報 406；② `addItem` 先載入 items 再檢查重複；③ 修正週銷單 soft-delete 後再次加入相同商品衝突的問題（偵測到 `CancelledAt IS NOT NULL` 的舊 row 則 UPDATE 復活而非 INSERT）
- **蝦皮式分析報表模組**：商品點擊數追蹤（`C_ANL_ProductClickLog`，`add_analytics_tracking.sql`）；LocalStorage 每日去重（key: `ck_YYYY-MM-DD_productId`）；前台商品詳情 fire-and-forget 插入；來源偵測（廣告來源/購物車/願望清單/直接）；商品排行完整重寫（銷售佔比/點擊數/訂單轉換率/平均客單價/買家數欄位）；銷售總覽新增商品點擊數/訂單轉換率/買家數 stat card；新增「流量來源分析」報表頁（Chart.js 長條圖 + 來源佔比表格）；側欄新增入口；i18n 補齊缺少的中文翻譯 key（consumables/finance 群組）
- **毛利率 → 淨利率**：毛利報表（`ProfitReport.vue`）與賣場淨利報表（`StoreProfitReport.vue`）中「毛利率」欄位更名為「淨利率」
- **成本記錄收據/憑證附件上傳**：月度費用（Modal 底部加圖片上傳）、商品進貨單詳情（基本資訊卡片）、耗材進貨單詳情（獨立收據卡片）均支援選填 JPG/PNG/WebP/PDF 附件；上傳至 `receipts` Storage Bucket；表格顯示 🖼️/📄 圖示；刪除記錄時一併清除 Storage 檔案；migration `add_receipt_storage.sql`（三張資料表新增 `ReceiptStoragePath`）
- **費用記錄日期精度（原月度費用）**：頁面名稱改為「費用記錄」；`C_FIN_MonthlyExpenseList` 的 `Year` + `Month` 兩欄合併為 `ExpenseDate DATE`（舊資料 backfill 為當月 1 日）；表單改為日期選擇器、列表新增日期欄、查詢改為日期範圍篩選；`StoreProfitReport.vue` 費用查詢同步更新；migration `add_expense_date.sql`

---

## ⚠️ 已開發，待測試 / 待上線

### 直播代建訂單系統

**程式已完成，尚未端對端測試。**

**已實作範圍：**
- `/admin/live` 場次列表（建立/管理）
- 場次詳情三個 Tab：**商品對照表**（代碼↔商品↔直播價）/ **留言解析建單**（貼 FB 留言文字 → 解析 → 批次建單 → LINE 通知）/ **FB 直播監控**（連 FB → 即時輪詢留言 → 自動搶標/截標）
- `live-import` Edge Function：比對 `FbName` 找會員、扣庫存、建訂單（`OrderSource='live'`）、發 LINE 推播付款連結
- `live-bid-poll` Edge Function：FB Graph API 輪詢、`start_bid`（起標貼公告 + 建 ActiveBid 記錄）✅ 已完成
- DB tables：`C_LIV_SessionList` / `C_LIV_ProductList` / `C_LIV_ActiveBidList` / `C_LIV_ProcessedCommentList`（已執行）

**待測試清單：**
- ⚠️ 場次建立 / 商品對照表 CRUD
- ⚠️ 留言貼入解析 → 批次建單 → 確認訂單建立正確
- ⚠️ LINE 付款通知是否送達
- ⚠️ 客人點連結 → 進入訂單詳情 → 重新付款流程
- ⚠️ FB 直播監控（需真實粉專授權）

**已知潛在問題：**
> ⚠️ 純 LINE 帳號（無 email）的會員，`CustomerEmail` 為空，`OrderDetailView` 用 email 過濾會找不到訂單，付款連結失效。一般有 email 的會員不受影響。

---

### 電子發票（ezPay）

**程式已完成，部分已測試通過。**

**已實作範圍：**
- 結帳頁：可選擇發票載具（紙本/手機條碼/自然人憑證/捐贈碼/公司戶三聯式），資料存入訂單
- 後台訂單詳情：電子發票卡片（狀態 badge、發票號碼、隨機碼、折讓資訊）；Footer 按鈕（開立/作廢/折讓）
- Edge Function `issue-invoice`：支援 `issue` / `void` / `allowance` 三個 action
- Migration `add_invoice_fields.sql`：✅ 已執行（全部 Invoice* 欄位 + 發票載具欄位）

**測試結果（付款成功後 payment-notify 自動開票）：**
- ✅ **紙本發票**：開立成功，ezPay 自動寄發票通知 email 給買家
- ✅ **手機條碼**：開立成功
- ✅ **公司戶三聯式**：開立成功（三聯式）
- ✅ **自然人憑證**：開立成功，InvoiceCarrierNum 正確存入
- ✅ **捐贈碼**：開立成功，InvoiceLoveCode 正確存入
- ✅ **後台作廢發票**：作廢成功，InvoiceStatus 變 voided
- ✅ **後台開立折讓**：開立成功，InvoiceStatus 變 allowance，InvoiceAllowanceNo 正確寫入
- ✅ **後台手動補開發票**：開立成功

**尚需設定（正式上線前）：**
- Supabase Edge Functions Secrets 切換 `EZPAY_ENV=prod`

**已確認的操作邏輯：**
- 全額退款 → 先作廢發票，再按退款按鈕（兩個分開操作）✅
- 部分退款 → 開立折讓（只調整發票，退款金額人工處理）
- 錢包全額付款訂單 → 無發票（已在儲值時開立）

**待確認的問題：**

> ❓ **Q1：部分退款（折讓）的錢要怎麼還給客人？**
> 目前「開立折讓」只處理發票，不動金流。選項 A：退回錢包；選項 B：人工匯款
> → **目前預設 B**（系統只開折讓，退款人工處理）。

> ❓ **Q2：退款後庫存要不要回補？**
> 目前退款後已扣庫存不自動加回。退回的商品是要重新上架還是報損？

> ❓ **Q3：錢包全額付款的訂單發票問題已確認**
> 儲值時已開立，消費訂單不重複開立。

---

## 🔴 優先（改動小、業務需要）

> 目前 🔴 清單已全部完成，無待辦項目。

---

## 🟡 中優先（功能重要，工程量中等）

---

### 1. 待結清單 — 被銷單會員「重新購買」LINE 通知

在「待結清單 → 本週已銷單」Tab，小編可對被銷單／清購物車的會員手動發 LINE 通知催重購。

**已確認不做「自動加入購物車」**，原因：
- 銷單後庫存可能已被他人買走，`decrement_stock` 會失敗
- 部分商品有貨部分沒貨，購物車狀態不一致
- 強制加入購物車體驗差

**建議方案（待實作）：**
LINE 訊息列出被取消的商品名稱 + 連結到店鋪首頁或各商品頁，讓客人自行決定是否重新下單。庫存不足時前台自然顯示「已售完」。

**待確認：**

> ❓ **Q1：訊息格式？**
> 逐一列出被取消的商品名稱，還是只給一個連結？

> ❓ **Q2：連結目標？**
> 導到店鋪首頁，還是每件商品各自的商品頁？

> ❓ **Q3：此功能優先級？**
> 上線前必要，還是上線後再迭代？

---

### 2. 批次進貨 / 成本追蹤 / 毛利報表

> **狀態：✅ 已開發完成，待執行 DB migration + 系統設定。**
> 規格圖：`D:\Users\MondyHuang\Downloads\purchase-system-overview.pptx`

**⚠️ 上線前必做：**
1. 在 Supabase 執行 `supabase/migrations/add_purchase_system.sql`（兩個 schema 均已包含）
2. 在後台「系統設定」(`S_SYS_Config`) 新增兩個 Key：
   - `shipping_cost_cvscom`：超商每箱運費成本（例：`70`）
   - `shipping_cost_home`：宅配每箱運費成本（例：`120`）

#### DB 異動

**新增 6 張表：**

| 表格 | 用途 |
|------|------|
| `S_INV_SupplierList` | 供應商主檔（名稱/聯絡人/電話/Email/IsActive）|
| `S_INV_CostTypeList` | 附加成本項目設定（大陸段運費/過境運費/關稅等，可自行新增）|
| `C_INV_PurchaseOrderList` | 進貨單主表（PurchaseNo/SupplierID/日期/狀態 draft→confirmed/總成本）|
| `C_INV_PurchaseOrderItemList` | 進貨明細（ProductID/VariantID/Qty/UnitCost/SubTotal）|
| `C_INV_PurchaseOrderCostList` | 進貨附加成本（對應 CostTypeID，可多筆）|
| `C_ORD_OrderExtraCostList` | 訂單額外成本（退換貨運費等；EventType: return/exchange；CostType: shipping_back/shipping_out/other）|

**修改 3 張現有表：**

| 表格 | 新增欄位 | 說明 |
|------|------|------|
| `C_PRD_ProductVariantList` | `CostPrice numeric(10,4)` | 加權平均成本，進貨 confirm 時自動更新 |
| `C_ORD_OrderItemList` | `UnitCost numeric(10,4)` | 建單當下快照成本，不隨後續進貨變動 |
| `C_ORD_OrderList` | `ActualShippingCost integer` | 實際出貨運費，出貨時自動帶入設定值×箱數 |

**系統設定（`S_SYS_Config`）新增 2 個 Key：**
- `shipping_cost_cvscom`：超商每箱成本（例：70）
- `shipping_cost_home`：宅配每箱成本（例：120）

#### 後台新增頁面

| 頁面 | 路由 |
|------|------|
| 供應商設定 | `/admin/inventory/suppliers` |
| 附加成本項目設定 | `/admin/inventory/setcosttypes` |
| 進貨單列表 | `/admin/inventory/purchases` |
| 進貨單詳情 / 建立 | `/admin/inventory/purchases/:id` |
| 毛利報表 | `/admin/reports/profit` |

#### 現有頁面修改

- **出貨 Modal**：新增「箱數」欄位（預設 1）；系統依 `ShippingMethod` 自動帶對應設定值；計算 `ActualShippingCost = 設定值 × 箱數`，可手動覆蓋
- **訂單詳情**：新增「額外成本」區塊，可新增多筆退換貨費用
- **`create-payment`**：建單時把 variant 當下的 `CostPrice` 快照寫入 `OrderItemList.UnitCost`

#### 進貨 Confirm 自動執行

1. `StockQty` + 進貨數量
2. 附加成本依數量比例分攤 → 重算加權平均 `CostPrice`
3. 寫入 `C_INV_StockLog` 庫存異動紀錄

#### 毛利計算公式

```
訂單毛利 = FinalAmount
         - Σ(UnitCost × Qty)            商品成本（建單快照）
         - PaymentFee                   金流手續費
         - ActualShippingCost           實際出貨運費
         - Σ(OrderConsumableList.Amount) 耗材成本（包材/贈品）
         - Σ(OrderExtraCostList.Amount)  退換貨等額外成本

毛利率 = 訂單毛利 ÷ FinalAmount × 100%

賣場月度淨利 = 當月訂單毛利合計 - 月度固定費用（C_FIN_MonthlyExpenseList）
```

#### 毛利報表內容

- **Stat Cards**：總營收 / 總毛利 / 整體毛利率 / 平均訂單毛利
- **每日毛利折線圖**：今日/本週/本月/自訂區間
- **商品毛利率排行**：依毛利率或金額排序
- **成本結構拆解**：商品成本/手續費/出貨運費/退換貨費用各佔比
- **缺少成本資料提醒**：`UnitCost=0` 的訂單另外標示

#### 開發順序

1. ✅ DB migration（6張新表 + 3個欄位 + 2個 Config key）— `supabase/migrations/add_purchase_system.sql`
2. ✅ 供應商設定 + 成本項目設定頁面（`Suppliers.vue` / `SetCostTypes.vue`）
3. ✅ 進貨單建立 / confirm 邏輯（`Purchases.vue` / `PurchaseDetail.vue`）— 加權平均成本計算 + 庫存更新
4. ✅ `create-payment` 補快照 `UnitCost`
5. ✅ 出貨 Modal 補箱數 + 自動計算 `ActualShippingCost`
6. ✅ 訂單詳情補「額外成本」區塊（`C_ORD_OrderExtraCostList`）
7. ✅ 毛利報表（`ProfitReport.vue`）— 日期篩選、訂單明細、成本拆解彙總

---

### 3. Google Analytics 整合

> **狀態：程式完成 ✅，Vercel 正式專案環境變數待設定 ⚠️**

**已完成：**
- GA4 資料串流建立，指向 `aleys-wardrobe-test.vercel.app` ✅
- `gtag.js` 全部追蹤函式完成（`initGA` / `trackPageView` / `trackViewItem` / `trackAddToCart` / `trackBeginCheckout` / `trackPurchase` / `setUserId`）✅
- Vercel 測試專案（`aleys-wardrobe-test`）已加入 `VITE_GA_MEASUREMENT_ID` ✅
- 登入後自動呼叫 `setUserId(memberId)` 提升訪客識別準確度 ✅
- GA4 即時報表確認有收到資料 ✅

**上線前待做：**
- Vercel 正式專案（`aleys-wardrobe`）補加 `VITE_GA_MEASUREMENT_ID`（已記錄在 `fb_app_review.md`）⚠️

---

### 4. 註冊確認信件優化

現況：Supabase 預設寄件人為 `noreply@mail.supabase.io`，體驗不佳。

**需使用者確認的問題：**

> ❓ **Q1：選擇哪個方案？**
>
> | 方案 | 做法 | 速度 | 體驗 |
> |------|------|------|------|
> | A：關閉確認信 | Supabase Auth → Email → 關閉 Confirm email | 5 分鐘 | 使用者註冊後直接登入，無需收信 |
> | B：自訂 SMTP | 串接 Resend / SendGrid，從自己 domain 寄信 | 半天 | 收到品牌信件，體驗最完整 |
>
> 方案 A 最快，但缺少 Email 驗證保護。
> 方案 B 需要申請 Resend（免費方案 100 封/天），並在 Supabase 設定 SMTP。

---

### 5. 大戶會員標記（暫緩決策）

**決策方向（已討論）：**
- 優先選擇**方案 A（自動計算）**：不動 DB schema；在會員列表和訂單詳情頁根據累積消費金額顯示「大戶」badge；門檻值存 `S_SYS_Config`（key: `vip_threshold`）
- 若未來需要標記「非大額但重要客人」，再疊加方案 B（手動 `IsVIP` 欄位）
- 方案 C（正式等級制）目前側欄已有「會員等級」入口，可未來擴充

**暫緩原因：** 目前資料量尚小，先觀察業績再決定門檻值。

---

## 🔵 待確認議題（需確認方向後再開發）

### 11. 成本記錄日期精度

目前月度費用 / 耗材進貨 / 商品進貨單只記錄到年月或日期欄位，使用者希望每筆成本都能精確記錄到日。

**進度：**
- ✅ **費用記錄（原月度費用）**：`Year` + `Month` 已改為 `ExpenseDate DATE`；頁面名稱同步改為「費用記錄」（`add_expense_date.sql` ✅ 已執行）
- ⏳ **商品進貨單附加成本 `C_INV_PurchaseOrderCostList`**：是否新增 `PaidDate` 讓運費/關稅各自記錄付款日期，待使用者確認後再開發

---

### 12. 破壞袋耗材記錄方式

破壞袋目前記錄在耗材品項，進貨時會更新加權平均單價（`CostPrice`）。但**每筆訂單使用的耗材成本如何計算**尚未確定。

**方案選項：**

- **A. 純參考（最簡單）**：在耗材列表顯示加權平均單價，不影響訂單；成本僅供定價參考，損益報表中耗材成本直接顯示該期間採購總支出
- **B. 每月損益分攤（中等）**：每筆訂單耗材成本 = 當月耗材總支出 ÷ 當月訂單數；損益報表自動分攤，不須逐筆訂單登記
- **C. 每筆訂單預估成本（最精確）**：依訂單商品件數 × 平均袋子單價帶入每筆訂單耗材成本；需設定「每件商品用幾個袋」的規則

**Claude 建議：A + B 組合**
- 耗材列表顯示加權平均單價（A）
- 損益報表以當月耗材採購總支出直接呈現，不需分配到單筆訂單（接近 B 但更直覺）
- 無須建 per-order 追蹤，`C_ORD_OrderConsumableList` 訂單耗材區塊不需繼續開發

**待確認：** 詢問使用者偏好哪個方案後再開發。

---

## 🟢 低優先（複雜度高 / 有外部依賴 / 暫緩）

### 6. FB 直播留言自動化

讓客人直播留言「+1 商品 顏色 尺寸」後，系統自動建訂單、分配庫存、發結帳連結。

**技術需求：**
- FB App + `pages_read_engagement`、`pages_messaging` 權限（需 App Review，約 5〜14 工作天）
- 識別方式：用 FB User ID 當客人身份，不需事先綁定會員帳號（參考就醬播做法）
- 結帳連結透過 FB Messenger 自動私訊

**需使用者確認的問題：**

> ❓ **Q1：願意等 FB App Review（5〜14 工作天）嗎？**
> 建議先把功能 1（手動代建版）跑起來，FB 自動化在申請期間同步開發。

> ❓ **Q2：通知管道**
> 結帳連結要透過 FB Messenger 傳，還是透過 LINE OA 傳？

> ❓ **Q3：直播後補單**
> 直播結束後漏掉的留言，要 API 自動抓取，還是小編手動匯入 CSV？

---

### 7. 分批出貨

單筆訂單中部分商品先到貨、部分延後，需拆分出貨記錄與通知。

**需使用者確認的問題：**

> ❓ **Q1：實際業務上有這個需求嗎？**
> 還是目前都是整單出貨？先確認需求再設計，避免過度開發。

---

### 8. 訂單取消流程

目前系統沒有「取消訂單」功能，只有「退款」。

**需使用者確認的問題：**

> ❓ **Q1：客人可以自己在前台申請取消嗎？**
> 還是只有後台管理員可以操作？

> ❓ **Q2：未付款訂單要不要自動逾時取消？**
> 例如：ATM 轉帳 3 天未付款，訂單自動取消並釋放庫存。
> → 需要這個機制嗎？

---

### 9. 訂單通知信

目前下單、付款成功、出貨，客人都**不會收到任何通知**。

**需使用者確認的問題：**

> ❓ **Q1：要不要發訂單確認信 / 出貨通知？**
> 需串接 SMTP（Resend/SendGrid）才能做，和「註冊確認信件優化」可以一起做。
> → 若選項是「關閉確認信（方案 A）」就還是要串 SMTP 才能做訂單通知。

---

### 10. 客戶錢包 / 儲值（暫緩，待會計確認）

**⚠️ 實作前需請會計師確認「儲值不開發票、消費開發票」符合記帳需求。**

**功能範圍：**
- 會員錢包餘額，可抵消費
- 儲值走藍新 MPG，消費發票改用藍新獨立電子發票 API 開立完整金額
- 滿額贈贈點（與實付金額分開記錄）

**DB 設計方向：**
- `C_MBR_WalletList`：錢包餘額
- `C_MBR_WalletTransactionList`：每筆異動 log（topup / bonus / consume / refund）
- 餘額只能透過 edge function 異動（RLS 擋前端直接 UPDATE）

**需使用者確認的問題：**

> ❓ **Q1：會計師確認了嗎？**
> 這是硬性前提，確認前不開發。
