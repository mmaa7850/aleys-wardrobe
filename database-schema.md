# Database Schema — staging & public

> 更新時間：2026-06-09
> Schema：`staging`（開發）、`public`（正式）

---

## Migration 紀錄

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `add_shipping_method_fields.sql` | 新增 ShippingMethod / HomeDelivery* 欄位 | ✅ 已執行 |
| `add_trade_no.sql` | 新增 TradeNo 欄位（藍新退款用） | ✅ 已執行 |
| `add_invoice_fields.sql` | Invoice* 欄位（ezPay）+ ATM 轉帳欄位（錢包儲值）+ 發票載具欄位（InvoiceCarrierType 等） | ✅ 已執行 |
| `add_wallet_tables.sql` | 新增錢包三張表（`C_MBR_WalletList` / `WalletTxList` / `WalletTopupList`）+ C_ORD_OrderList 的 `WalletDeductAmt` / `NewebpayAmt` | ✅ 已執行 |
| `add_line_binding.sql` | `C_MBR_MemberList` 新增 `LineUserID` / `FbName`；新增 `LineBindToken` 表 | ✅ 已執行 |
| `add_live_tables.sql` | 新增 `C_LIV_SessionList` / `C_LIV_ProductList`；`C_ORD_OrderList` 新增 `OrderSource` / `LiveSessionID` | ✅ 已執行 |
| `add_live_realtime_tables.sql` | `C_LIV_SessionList` 新增 `FbPageId` / `FbLiveVideoId`；新增 `C_LIV_ActiveBidList` / `C_LIV_ProcessedCommentList`；`C_ORD_OrderList` 新增 `LiveCode` | ✅ 已執行 |
| `add_cart_features.sql` | `C_CART_CartItemList` 新增 `Source` / `LiveSessionID` / `IsReward` / `RewardAmt`；`ProductID` / `VariantID` 改允許 NULL | ✅ 已執行 |
| `setup_weekly_cron.sql` | pg_cron：每週日 16:00 UTC（台灣週一 00:00）自動銷單 + 回補庫存 + 軟刪除購物車現貨品 | ✅ 已執行 |
| `cart_stock_functions.sql` | 新增 `decrement_stock(bigint, int)` / `restore_stock(bigint, int)` 原子性庫存函式 | ✅ 已執行 |
| `add_purchase_system.sql` | 新增 `S_INV_SupplierList` / `S_INV_CostTypeList` / `C_INV_PurchaseOrderList` / `C_INV_PurchaseOrderItemList` / `C_INV_PurchaseOrderCostList` / `C_ORD_OrderExtraCostList`；`C_PRD_ProductVariantList` 新增 `CostPrice`；`C_ORD_OrderItemList` 新增 `UnitCost`；`C_ORD_OrderList` 新增 `ActualShippingCost` | ✅ 已執行 |
| `add_consumables_system.sql` | 新增 `C_INV_ConsumableList` / `C_INV_ConsumablePurchaseList` / `C_INV_ConsumablePurchaseItemList` / `C_ORD_OrderConsumableList` / `S_FIN_ExpenseCategoryList` / `C_FIN_MonthlyExpenseList`；預設 6 筆費用分類 | ✅ 已執行 |
| `add_analytics_tracking.sql` | 新增 `C_ANL_ProductClickLog`（商品點擊追蹤）；RLS：anon/authenticated 可 INSERT，僅 staff 可 SELECT | ✅ 已執行 |
| `add_receipt_storage.sql` | `C_FIN_MonthlyExpenseList` / `C_INV_PurchaseOrderList` / `C_INV_ConsumablePurchaseList` 各新增 `ReceiptStoragePath VARCHAR(500)` | ✅ 已執行 |
| `add_expense_date.sql` | `C_FIN_MonthlyExpenseList` 的 `Year` + `Month` 兩欄改為 `ExpenseDate DATE`（舊資料 backfill 為當月 1 日）；頁面名稱改為「費用記錄」 | ✅ 已執行 |

> ⚠️ **無 migration 檔案的欄位**（直接在 Supabase Dashboard 執行）：
> - `C_CART_CartItemList.CancelledAt`（週銷單軟刪除時間戳）
> - `C_MBR_MemberList.IsBlocked`（銷單後自動封鎖）
> - `C_ORD_OrderList.OrderType`（`stock` / `preorder`）

---

## 🔴 重要規則：兩個 Schema 必須保持同步

> **務必確保 `staging` 和 `public` 兩個 schema 的 table 欄位與 RLS policy 一模一樣。**

- 任何新增 table、欄位異動、policy 新增或修改，**都必須同時在兩個 schema 執行**。
- 可用以下查詢檢查 policy 差異：

```sql
SELECT
  COALESCE(s.tablename, p.tablename) AS table,
  COALESCE(s.policyname, p.policyname) AS policy,
  CASE WHEN s.policyname IS NULL THEN '❌ 缺 staging' ELSE '✅' END AS in_staging,
  CASE WHEN p.policyname IS NULL THEN '❌ 缺 public'  ELSE '✅' END AS in_public
FROM
  (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'staging') s
  FULL OUTER JOIN
  (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public')  p
  USING (tablename, policyname)
WHERE s.policyname IS NULL OR p.policyname IS NULL
ORDER BY table, policy;
```

---

## ⚠️ 已知問題（需修正）

### 直接查詢 `auth.users` 的 policy（造成 "permission denied for table users"）

```sql
-- C_ORD_OrderList: order: insert own
ALTER POLICY "order: insert own" ON staging."C_ORD_OrderList"
WITH CHECK (
  ("CustomerEmail")::text = (auth.jwt() ->> 'email')
);

-- C_ORD_OrderItemList: order_item: select own
ALTER POLICY "order_item: select own" ON staging."C_ORD_OrderItemList"
USING (
  "OrderID" IN (
    SELECT "ID" FROM staging."C_ORD_OrderList"
    WHERE ("CustomerEmail")::text = (auth.jwt() ->> 'email')
  )
);

-- C_ORD_OrderItemList: order_item: insert own
ALTER POLICY "order_item: insert own" ON staging."C_ORD_OrderItemList"
WITH CHECK (
  "OrderID" IN (
    SELECT "ID" FROM staging."C_ORD_OrderList"
    WHERE ("CustomerEmail")::text = (auth.jwt() ->> 'email')
  )
);
```

### 重複 policy（可擇一刪除，不影響功能）
- `C_CART_CartList`：`cart_*` 與 `cart: *` 重複
- `C_CART_CartItemList`：`cartitem_*` 與 `cart_item: *` 重複
- `C_MBR_WishList`：`wish_*` 與 `wishlist: *` 重複

---

## Tables

### C_CART_CartItemList
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| CartID | bigint | NO | — | |
| ProductID | bigint | **YES** | — | 購物金獎勵品項可為 NULL |
| VariantID | bigint | **YES** | — | 同上 |
| Qty | integer | YES | 1 | |
| AddedAt | timestamptz | YES | now() | |
| Source | varchar(20) | YES | 'web' | `web` / `live`（直播代建） |
| LiveSessionID | bigint | YES | — | 直播代建時填入場次 ID |
| IsReward | boolean | NO | false | 購物金獎勵品項標記 |
| RewardAmt | integer | YES | — | 購物金面額 |
| CancelledAt | timestamptz | YES | — | 週銷單軟刪除時間（前台查詢需加 `IS NULL` 過濾） |

### C_CART_CartList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | now() |

### C_LIV_SessionList
> 直播場次主表

| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| Title | varchar(100) | NO | — | 場次名稱 |
| LiveDate | date | YES | — | 直播日期 |
| Status | varchar(20) | NO | 'planned' | `planned` / `active` / `closed` |
| Notes | text | YES | — | 備注 |
| FbPageId | varchar | YES | — | FB 粉專 Page ID（即時監控用）|
| FbLiveVideoId | varchar | YES | — | FB 直播影片 ID |
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | now() | |

### C_LIV_ProductList
> 直播場次商品對照表（代碼 ↔ 商品 Variant ↔ 直播價）

| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| SessionID | bigint | NO | — | FK → C_LIV_SessionList.ID（CASCADE）|
| Code | varchar(20) | NO | — | 留言關鍵字代碼，如 `Y77` |
| ColorName | varchar(50) | NO | — | 顏色名稱 |
| SizeName | varchar(20) | NO | — | 尺寸 |
| VariantID | bigint | NO | — | FK → C_PRD_ProductVariantList.ID |
| ProductName | varchar(200) | YES | — | 快取商品名稱（避免 join）|
| LivePrice | bigint | NO | — | 直播特價（元）|
| CreatedDate | timestamptz | YES | now() | |

### C_LIV_ActiveBidList
> 追蹤目前開標中的商品。同一場次同一 Code 只能有一個 `open` 狀態（UNIQUE index）

| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| SessionID | bigint | NO | — | |
| Code | varchar | NO | — | 商品代碼 |
| ProductName | varchar | YES | — | 快取名稱 |
| Status | varchar | NO | 'open' | `open` / `closed` |
| OpenedAt | timestamptz | NO | now() | 起標時間 |
| ClosedAt | timestamptz | YES | — | 截標時間 |
| CreatedDate | timestamptz | NO | now() | |

### C_LIV_ProcessedCommentList
> 已處理 FB 留言 ID（去重）。`FbCommentId` + `FbUserId + DedupKey` 雙重防止重複建單。

| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| SessionID | bigint | NO | — | |
| FbCommentId | varchar | NO | — | UNIQUE(SessionID, FbCommentId) |
| FbUserId | varchar | YES | — | FB 用戶 ID |
| DedupKey | varchar | YES | — | `{CODE}\|{VariantID}`，null=非入單留言 |
| CreatedDate | timestamptz | NO | now() | |

### C_MBR_MemberAddressList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| Type | text | YES | 'home' |
| RecipientName | text | YES | — |
| RecipientPhone | text | YES | — |
| Address | text | YES | — |
| StoreCode | text | YES | — |
| StoreName | text | YES | — |
| IsDefault | boolean | YES | false |
| CreatedDate | timestamptz | YES | now() |

### C_MBR_MemberList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| UserID | uuid | YES | — |
| Name | text | YES | — |
| Email | text | YES | — |
| Phone | text | YES | — |
| Gender | text | YES | — |
| Birthday | date | YES | — |
| RegisterSource | text | YES | 'email' |
| DefaultPayMethodID | bigint | YES | — |
| MemberLevelID | bigint | YES | — (FK → S_MBR_MemberLevelList.ID) |
| IsActive | boolean | YES | true | |
| LineUserID | text | YES | — | LINE 帳號綁定後填入（UNIQUE）；`line-webhook` Unfollow 時清除 |
| FbName | text | YES | — | FB 登入後擷取 `user_metadata.full_name`；直播留言比對用 |
| IsBlocked | boolean | YES | false | 週銷單後自動設為 true；直播建單前檢查，封鎖者拒絕建單 |
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | now() | |

### C_MBR_MemberSocialList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| Platform | text | YES | — |
| SocialUserID | text | YES | — |
| SocialEmail | text | YES | — |
| CreatedDate | timestamptz | YES | now() |

### LineBindToken
> LINE 帳號綁定的一次性 Token 表。由 `line-webhook` 建立、`line-bind` 消費。

| 欄位 | 型別 | Nullable | Default | 備注 |
|------|------|----------|---------|------|
| Token | text | NO | — | PRIMARY KEY（UUID v4） |
| LineUserID | text | NO | — | LINE 用戶 ID |
| CreatedAt | timestamptz | YES | now() | |
| UsedAt | timestamptz | YES | — | 綁定完成後填入 |
| ExpiresAt | timestamptz | YES | now() + 7 days | 7 天有效期 |

> RLS：已啟用；僅由 `line-webhook` / `line-bind` Edge Functions 以 service_role 讀寫，無公開 policy。

### C_MBR_WalletList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| Balance | bigint | NO | 0 |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | — |

### C_MBR_WalletTopupList
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| TopupNo | varchar | NO | — | 儲值單號（TU_YYYYMMDD_XXXXX）|
| MemberID | bigint | NO | — | |
| Amount | bigint | NO | — | 儲值金額 |
| PaymentStatus | varchar(20) | NO | 'pending' | `pending` / `paid` / `fail` |
| PaymentMethod | varchar(20) | YES | — | `credit` / `atm` 等 |
| ATMBankCode | varchar(10) | YES | — | ATM 虛擬帳號銀行代碼 |
| ATMAccount | varchar(20) | YES | — | ATM 虛擬帳號 |
| ATMExpireDate | date | YES | — | ATM 繳費期限 |
| InvoiceStatus | varchar(20) | NO | 'none' | `none` / `issued` / `voided` |
| InvoiceCarrierType | varchar(10) | YES | — | 同訂單 InvoiceCarrierType |
| InvoiceCarrierNum | varchar(30) | YES | — | |
| InvoiceLoveCode | varchar(10) | YES | — | |
| InvoiceBuyerUBN | varchar(8) | YES | — | |
| InvoiceNo | varchar(20) | YES | — | ezPay 發票序號 |
| InvoiceNumber | varchar(10) | YES | — | 實際發票號碼 |
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | — | |

### C_MBR_WalletTxList
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| MemberID | bigint | NO | — | |
| TxType | varchar(20) | NO | — | `topup` / `order_deduct` / `refund` / `adjust` |
| Amount | bigint | NO | — | 異動金額（正=入帳，負=支出）|
| BalanceBefore | bigint | NO | — | |
| BalanceAfter | bigint | NO | — | |
| RelatedTopupNo | varchar | YES | — | 對應儲值單號 |
| RelatedOrderNo | varchar | YES | — | 對應訂單號 |
| Note | text | YES | — | |
| CreatedDate | timestamptz | YES | now() | |

### C_MBR_WishList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| ProductID | bigint | NO | — |
| CreatedDate | timestamptz | YES | now() |

### C_ORD_OrderItemList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| OrderID | bigint | NO | — |
| ProductID | bigint | NO | — |
| ProductName | varchar | NO | — |
| VariantID | bigint | NO | — |
| ColorName | varchar | YES | — |
| SizeName | varchar | YES | — |
| UnitPrice | bigint | NO | — |
| Qty | bigint | NO | — |
| SubTotal | bigint | NO | — |
| UnitCost | numeric(10,4) | NO | 0 | 建單時快照的加權平均成本（CostPrice snapshot） |

### C_ORD_OrderList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| OrderNo | varchar | NO | — |
| OrderType | varchar(20) | YES | 'stock' | `stock`=現貨 / `preorder`=預購；前台訂單列表顯示「預購」badge |
| OrderSource | varchar(20) | YES | 'web' | `web` / `live`（直播代建）/ `admin`（後台手動）|
| LiveSessionID | bigint | YES | — | 直播代建時填入 |
| LiveCode | varchar | YES | — | 直播代碼（方便結標公告查詢）|
| TradeNo | varchar(50) | YES | — | 藍新退款交易流水號（`payment-notify` 寫入）|
| CustomerName | varchar | NO | — |
| CustomerEmail | varchar | NO | — |
| CustomerPhone | varchar | YES | — |
| ShippingName | varchar | NO | — |
| ShippingPhone | varchar | NO | — |
| ShippingAddress | varchar | NO | — |
| ShippingMethodID | bigint | YES | — |
| ShippingFee | bigint | NO | 0 |
| ShippingMethod | varchar(20) | YES | 'home' |
| StoreID | varchar(10) | YES | — |
| StoreName | varchar(50) | YES | — |
| PayMethodID | bigint | YES | — |
| PaymentStatus | varchar | NO | 'pending' |
| PaymentMethod | varchar(20) | YES | — |
| PaymentFee | bigint | YES | — |
| PaidAt | timestamptz | YES | — |
| ATMBankCode | varchar(10) | YES | — |
| ATMAccount | varchar(20) | YES | — |
| WalletDeductAmt | bigint | NO | 0 | 本次從錢包扣款金額 |
| NewebpayAmt | bigint | NO | 0 | 實際送藍新收款金額（= FinalAmount − WalletDeductAmt）|
| CouponID | bigint | YES | — |
| HomeDeliveryNo | varchar(50) | YES | — |
| HomeDeliveryCompany | varchar(20) | YES | — |
| DiscountAmount | bigint | NO | 0 |
| ItemsTotal | bigint | NO | 0 |
| FinalAmount | bigint | NO | 0 |
| StatusID | bigint | YES | — |
| CustomerNote | text | YES | — |
| AdminNote | text | YES | — |
| LogisticsTradeNo | varchar(20) | YES | — |
| LgsNo | varchar(20) | YES | — |
| StorePrintNo | varchar(20) | YES | — |
| ShippingStatus | varchar(10) | YES | — |
| ShippingStatusText | varchar(50) | YES | — |
| CreatedDate | timestamptz | NO | now() |
| UpdatedDate | timestamptz | YES | — |
| InvoiceStatus | varchar(20) | NO | 'none' | `none` / `issued` / `voided` / `allowance` |
| InvoiceNo | varchar(20) | YES | — | ezPay 發票開立序號（InvoiceTransNo） |
| InvoiceNumber | varchar(10) | YES | — | 實際發票號碼（如 AB12345678） |
| InvoiceRandomNum | varchar(4) | YES | — | 4 碼防偽隨機碼 |
| InvoiceIssuedAt | timestamptz | YES | — | 發票開立時間 |
| InvoiceAllowanceNo | varchar(25) | YES | — | 折讓號 |
| InvoiceAllowanceAmt | integer | YES | — | 折讓金額（NT$） |
| InvoiceCarrierType | varchar(10) | YES | — | 結帳時選擇的載具類型：`''`=紙本 / `0`=手機條碼 / `1`=自然人憑證 / `D`=捐贈 / `B2B`=公司戶 |
| InvoiceCarrierNum | varchar(30) | YES | — | 手機條碼 or 自然人憑證號碼 |
| InvoiceLoveCode | varchar(10) | YES | — | 捐贈碼 |
| InvoiceBuyerUBN | varchar(8) | YES | — | 公司戶統一編號 |
| InvoiceBuyerName | varchar(100) | YES | — | 公司戶名稱 |
| ActualShippingCost | integer | YES | — | 實際出貨運費成本（出貨時依箱數×系統設定自動計算）|

### C_ORD_OrderStatusLog
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| OrderID | bigint | NO | — |
| FromStatusID | bigint | YES | — |
| ToStatusID | bigint | NO | — |
| Note | text | YES | — |
| CreatedDate | timestamptz | NO | now() |

### C_ORD_OrderExtraCostList
訂單額外成本（退換貨運費等）；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| OrderID | bigint | NO | — | 對應 C_ORD_OrderList.ID |
| EventType | varchar(20) | NO | 'other' | `return`=退貨 / `exchange`=換貨 / `other` |
| CostType | varchar(30) | NO | 'other' | `shipping_back`=寄回運費 / `shipping_out`=補寄運費 / `other` |
| Amount | integer | NO | — | 金額（CHECK >= 0）|
| Note | text | YES | — | |
| CreatedDate | timestamptz | NO | now() | |

### C_INV_ConsumableList
耗材品項主檔（包材/贈品/其他）；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| Name | varchar(100) | NO | — | 耗材名稱，如「黑色破壞袋（小）」|
| Category | varchar(20) | NO | '其他' | `包材` / `贈品` / `其他` |
| Unit | varchar(20) | NO | '個' | 計量單位，如個/捲/張/片 |
| CostPrice | numeric(10,4) | NO | 0 | 加權平均成本（確認進貨單時自動更新）|
| StockQty | integer | NO | 0 | 目前庫存（確認進貨單後自動累加）|
| Description | text | YES | — | |
| IsActive | boolean | NO | true | |
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | now() | |

### C_INV_ConsumablePurchaseList
耗材進貨單主表；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| PurchaseNo | varchar(30) | NO | — | 格式 `CPO_YYYYMMDD_XXXXX` |
| PurchaseDate | date | NO | CURRENT_DATE | |
| Status | varchar(20) | NO | 'draft' | `draft`=草稿 / `confirmed`=已確認（確認後不可修改）|
| Note | text | YES | — | |
| ReceiptStoragePath | varchar(500) | YES | — | 收據/憑證附件路徑（`receipts` bucket）|
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | now() | |

### C_INV_ConsumablePurchaseItemList
耗材進貨明細；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| PurchaseID | bigint | NO | — | FK → C_INV_ConsumablePurchaseList（CASCADE DELETE）|
| ConsumableID | bigint | NO | — | FK → C_INV_ConsumableList |
| ConsumableName | varchar(100) | NO | '' | 快取名稱 |
| Qty | integer | NO | 1 | 進貨數量 |
| UnitCost | numeric(10,4) | NO | 0 | 本次進貨單位成本 |
| SubTotal | numeric(10,2) | NO | 0 | Qty × UnitCost |
| CreatedDate | timestamptz | YES | now() | |

> **確認進貨加權平均公式：**
> `新CostPrice = (舊StockQty × 舊CostPrice + 本次Qty × 本次UnitCost) / (舊StockQty + 本次Qty)`

### C_ORD_OrderConsumableList
訂單耗材使用記錄（出貨時填入）；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| OrderID | bigint | NO | — | FK → C_ORD_OrderList（CASCADE DELETE）|
| ConsumableID | bigint | YES | — | FK → C_INV_ConsumableList（允許 NULL，耗材停用仍保留記錄）|
| ConsumableName | varchar(100) | NO | — | 快取名稱 |
| Unit | varchar(20) | NO | '個' | 快取單位 |
| Qty | integer | NO | 1 | 使用數量 |
| UnitCost | numeric(10,4) | NO | 0 | 記錄當下的耗材單位成本 |
| Amount | numeric(10,2) | NO | 0 | Qty × UnitCost |
| CreatedDate | timestamptz | YES | now() | |

### S_FIN_ExpenseCategoryList
費用分類設定；SELECT=所有登入者，寫入=`is_admin()`；預設 6 筆分類
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| Name | varchar(50) | NO | — | 如「租金」「水電費」|
| Description | text | YES | — | |
| SortOrder | integer | NO | 0 | |
| IsActive | boolean | NO | true | |
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | now() | |

> 預設分類：租金（1）/ 水電費（2）/ 設備（3）/ 文具耗材（4）/ 人事費用（5）/ 其他（6）

### C_FIN_MonthlyExpenseList
費用記錄主表（原名月度費用）；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| ExpenseDate | date | NO | — | 費用實際日期（取代原本 Year + Month 欄位）|
| CategoryID | bigint | YES | — | FK → S_FIN_ExpenseCategoryList |
| Name | varchar(100) | NO | — | 費用說明，如「6月房租」|
| Amount | numeric(10,2) | NO | 0 | |
| Note | text | YES | — | |
| ReceiptStoragePath | varchar(500) | YES | — | 收據/憑證附件路徑（`receipts` bucket）|
| CreatedDate | timestamptz | YES | now() | |
| UpdatedDate | timestamptz | YES | now() | |

### C_ANL_ProductClickLog
商品點擊追蹤記錄；每次訪客進入商品詳情頁時 fire-and-forget 插入一筆（LocalStorage 每日去重）；RLS：anon/authenticated 可 INSERT，staff 可 SELECT
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigserial | NO | — | |
| ProductID | bigint | YES | — | FK → C_PRD_ProductList（允許 NULL 以防商品被刪）|
| ProductName | varchar(200) | NO | '' | 快取商品名稱 |
| Source | varchar(30) | NO | '直接' | `廣告來源`=外部網站或 ?src=line / `購物車`=從 /cart 進入 / `願望清單`=從 /wishlist 進入 / `直接`=直接或站內 |
| CreatedDate | timestamptz | NO | now() | |

> 來源偵測：`document.referrer` hostname 非本站 → 廣告來源；`?src=line` → 廣告來源；referrer 含 `/cart` → 購物車；含 `/wishlist` → 願望清單；其他 → 直接
> 去重機制：LocalStorage key `ck_YYYY-MM-DD_{productId}`，同商品同天只記錄一次

### C_INV_PurchaseOrderList
進貨單主表；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| PurchaseNo | varchar(30) | NO | — | UNIQUE，格式 `PO_YYYYMMDD_XXXXX` |
| SupplierID | bigint | YES | — | FK → S_INV_SupplierList |
| PurchaseDate | date | NO | — | |
| Status | varchar(20) | NO | 'draft' | `draft`=草稿 / `confirmed`=已確認 |
| TotalCost | numeric(12,4) | YES | — | 商品成本 + 附加成本（confirm 時計算）|
| Note | text | YES | — | |
| ReceiptStoragePath | varchar(500) | YES | — | 收據/憑證附件路徑（`receipts` bucket）|
| CreatedDate | timestamptz | NO | now() | |
| UpdatedDate | timestamptz | NO | now() | |

### C_INV_PurchaseOrderItemList
進貨明細；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| PurchaseOrderID | bigint | NO | — | FK → C_INV_PurchaseOrderList（CASCADE DELETE）|
| ProductID | bigint | NO | — | |
| VariantID | bigint | NO | — | |
| ProductName | varchar(200) | YES | — | 快取，避免 JOIN |
| ColorName | varchar(50) | YES | — | |
| SizeName | varchar(20) | YES | — | |
| Qty | integer | NO | — | CHECK > 0 |
| UnitCost | numeric(10,4) | NO | — | CHECK >= 0，每件進貨成本（不含附加成本）|
| SubTotal | numeric(12,4) | GENERATED | — | Qty × UnitCost，STORED |

### C_INV_PurchaseOrderCostList
進貨附加成本（關稅、運費等）；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default | 說明 |
|------|------|----------|---------|------|
| ID | bigint | NO | — | |
| PurchaseOrderID | bigint | NO | — | FK → C_INV_PurchaseOrderList（CASCADE DELETE）|
| CostTypeID | bigint | YES | — | FK → S_INV_CostTypeList |
| Amount | numeric(10,2) | NO | — | CHECK >= 0 |
| Note | text | YES | — | |
| CreatedDate | timestamptz | NO | now() | |

### S_INV_SupplierList
供應商主檔；RLS `is_staff()` ALL
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| Name | varchar(100) | NO | — |
| ContactName | varchar(50) | YES | — |
| Phone | varchar(20) | YES | — |
| Email | varchar(100) | YES | — |
| Note | text | YES | — |
| IsActive | boolean | NO | true |
| CreatedDate | timestamptz | NO | now() |
| UpdatedDate | timestamptz | NO | now() |

### S_INV_CostTypeList
進貨附加成本類型設定（可自訂）；RLS `is_staff()` ALL；預設四筆：大陸段物流費/過境運費/關稅/報關費
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| Name | varchar(50) | NO | — |
| Description | varchar(200) | YES | — |
| SortOrder | integer | NO | 0 |
| IsActive | boolean | NO | true |
| UpdatedDate | timestamptz | NO | now() |

### C_PRD_ProductList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ProductName | varchar | NO | — |
| OriginPrice | bigint | YES | — |
| Price | bigint | NO | — |
| Category | varchar | NO | — |
| ProductTitle | text | YES | — |
| SubTitle | text | YES | — |
| Description | varchar | NO | — |
| Material | varchar | YES | — |
| WashingMethod | text | YES | — |
| SEOTitle | varchar | YES | — |
| SEODescription | text | YES | — |
| IsActive | boolean | NO | false |
| IsPreOrder | boolean | NO | false |
| PreOrderShipDate | date | YES | — |
| PreOrderNote | text | YES | — |
| CreatedDate | timestamptz | YES | — |
| UpdatedDate | timestamptz | YES | — |

### C_PRD_ProductPictureList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ProductID | bigint | NO | — |
| AltText | text | YES | — |
| SortOrder | bigint | NO | — |
| IsMain | boolean | NO | false |
| StoragePath | text | NO | — |
| Type | varchar | YES | — |
| UpdatedDate | timestamptz | YES | — |

### C_PRD_ProductSizeSpecList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ProductID | bigint | NO | — |
| SizeID | bigint | NO | — |
| Bust | varchar | YES | — |
| ClothLength | varchar | YES | — |
| SleeveLength | varchar | YES | — |
| ShoulderWidth | varchar | YES | — |
| Waist | varchar | YES | — |
| SkirtLength | varchar | YES | — |
| Hip | varchar | YES | — |
| Memo | text | YES | — |
| CreatedDate | timestamptz | YES | — |
| UpdatedDate | timestamptz | YES | — |

### C_PRD_ProductTag
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ProductID | bigint | NO | — |
| TagID | bigint | NO | — |
| CreatedDate | timestamptz | YES | — |
| UpdatedDate | timestamptz | YES | — |

### C_PRD_ProductVariantList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ProductID | bigint | NO | — |
| ColorID | bigint | NO | — |
| SizeID | bigint | NO | — |
| StockQty | bigint | NO | 0 |
| SKU | varchar | YES | — |
| IsActive | boolean | NO | false |
| CostPrice | numeric(10,4) | NO | 0 | 加權平均進貨成本（每次確認進貨單時自動更新）|
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | — |

### C_PRD_ReviewList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ProductID | bigint | NO | — |
| MemberID | bigint | NO | — |
| OrderID | bigint | YES | — |
| Rating | smallint | YES | — |
| Comment | text | YES | — |
| IsVisible | boolean | YES | true |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | now() |

### C_PRD_StockNotifyList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | YES | — |
| Email | text | NO | — |
| ProductID | bigint | NO | — |
| VariantID | bigint | YES | — |
| IsNotified | boolean | YES | false |
| CreatedDate | timestamptz | YES | now() |
| NotifiedAt | timestamptz | YES | — |

### C_PRM_CouponUsageLog
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| CouponID | bigint | NO | — |
| MemberID | bigint | YES | — |
| OrderID | bigint | YES | — |
| UsedAt | timestamptz | YES | now() |

### H_PRD_ProductList
> 商品歷史紀錄表（與 C_PRD_ProductList 欄位相同，用於保存異動前快照）

| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID, ProductName, OriginPrice, Price, Category, ProductTitle, SubTitle, Description, Material, WashingMethod, SEOTitle, SEODescription, IsActive, CreatedDate, UpdatedDate | 同 C_PRD_ProductList | — |

### S_MKT_BannerList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| ImagePath | text | YES | — |
| LinkURL | text | YES | — |
| AltText | text | YES | — |
| Position | text | YES | 'hero' |
| SortOrder | integer | YES | 0 |
| StartDate | date | YES | — |
| EndDate | date | YES | — |
| IsActive | boolean | YES | true |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | now() |

### S_ORD_StatusList
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| UpdatedDate | timestamptz | YES |

### S_PAY_PayMethodList
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| UpdatedDate | timestamptz | YES |

### S_PRD_CategoryList
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| UpdatedDate | timestamptz | YES |

### S_PRD_ColorList
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| UpdatedDate | timestamptz | YES |

### S_PRD_SizeList
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| SortOrder | bigint | YES |
| UpdatedDate | timestamptz | YES |

### S_PRD_TagList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| Name | varchar | NO | — |
| Description | varchar | NO | — |
| Slug | varchar | NO | — |
| IsActive | boolean | NO | false |
| CreatedDate | timestamptz | YES | — |
| UpdatedDate | timestamptz | YES | — |

### S_PRM_CouponList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| Name | varchar | NO | — |
| Description | varchar | NO | — |
| DiscountValue | bigint | NO | — |
| DiscountType | text | YES | 'fixed' |
| StartDate | date | NO | — |
| EndDate | date | NO | — |
| IsActive | boolean | YES | false |
| UsageCount | bigint | NO | — |
| UsageLimit | integer | YES | — |
| UsagePerMember | integer | YES | 1 |
| MinOrderAmount | numeric | YES | — |
| IsAutoApply | boolean | NO | false |
| CreatedDate | timestamptz | YES | — |
| UpdatedDate | timestamptz | YES | — |

### S_SHP_ShippingMethodList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| Name | varchar | NO | — |
| Description | varchar | YES | — |
| Fee | bigint | NO | 0 |
| MethodCode | varchar(20) | YES | — |
| IsActive | boolean | NO | true |
| UpdatedDate | timestamptz | YES | — |

> `MethodCode` 決定結帳流程：`cvscom` = 超商取貨（藍新 CVSCOM）、`home` = 宅配到府（需填地址）

### S_MBR_MemberLevelList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| Name | varchar | NO | — |
| Description | varchar | YES | — |
| SortOrder | integer | NO | 0 |
| IsActive | boolean | NO | true |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | now() |

> 預設資料：`一般會員`（SortOrder=1）、`VIP 會員`（SortOrder=2）

### S_SYS_AdminUserList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| UserId | uuid | NO | auth.uid() |
| Account | text | NO | — |
| AdminNo | bigint | NO | — |
| IsAdmin | boolean | YES | false |
| IsActive | boolean | YES | false |
| CanManageProducts | boolean | NO | false |
| CanManageOrders | boolean | NO | false |
| CanManageMarketing | boolean | NO | false |
| CanManageSettings | boolean | NO | false |
| CanManageMembers | boolean | NO | false |
| CreatedDate | timestamptz | YES | — |
| UpdatedDate | timestamptz | YES | — |

> `IsAdmin = true` 自動擁有所有權限；其他帳號依各 `Can*` 欄位控制。

### S_SYS_Config
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| Value | varchar | NO |
| Category | varchar | NO |
| UpdatedDate | timestamptz | YES |

### S_SYS_ConfigCategoryList
| 欄位 | 型別 | Nullable |
|------|------|----------|
| ID | bigint | NO |
| Name | varchar | NO |
| Description | varchar | NO |
| UpdatedDate | timestamptz | YES |

---

## RLS Policies

### S_INV_SupplierList / S_INV_CostTypeList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| supplier_staff_all | authenticated | ALL | is_staff() |
| costtype_staff_all | authenticated | ALL | is_staff() |

### C_INV_PurchaseOrderList / C_INV_PurchaseOrderItemList / C_INV_PurchaseOrderCostList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| purchase_order_staff_all | authenticated | ALL | is_staff() |
| purchase_item_staff_all  | authenticated | ALL | is_staff() |
| purchase_cost_staff_all  | authenticated | ALL | is_staff() |

### C_ORD_OrderExtraCostList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| order_extra_cost_staff_all | authenticated | ALL | is_staff() |

### C_INV_ConsumableList / C_INV_ConsumablePurchaseList / C_INV_ConsumablePurchaseItemList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| consumable_staff_all | authenticated | ALL | is_staff() |
| consumable_purchase_staff_all | authenticated | ALL | is_staff() |
| consumable_purchase_item_staff_all | authenticated | ALL | is_staff() |

### C_ORD_OrderConsumableList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| order_consumable_staff_all | authenticated | ALL | is_staff() |

### S_FIN_ExpenseCategoryList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| expense_cat_staff_read | authenticated | SELECT | true（所有登入者可讀，月度費用頁面下拉需要）|
| expense_cat_admin_write | authenticated | ALL | is_admin()（僅超管可新增/編輯分類）|

### C_FIN_MonthlyExpenseList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| monthly_expense_staff_all | authenticated | ALL | is_staff() |

### C_ANL_ProductClickLog
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| click_log_anon_insert | anon | INSERT | true（匿名訪客可寫入點擊）|
| click_log_auth_insert | authenticated | INSERT | true（登入用戶可寫入點擊）|
| click_log_staff_select | authenticated | SELECT | is_staff() |

### LineBindToken
> 無公開 policy；僅由 `line-webhook` 和 `line-bind` Edge Functions 以 service_role（繞過 RLS）讀寫。已啟用 RLS（`ENABLE ROW LEVEL SECURITY`）。

### C_LIV_SessionList / C_LIV_ProductList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| live_session_staff_all | authenticated | ALL | is_staff()（任何啟用管理員）|
| live_product_staff_all | authenticated | ALL | is_staff() |

### C_LIV_ActiveBidList / C_LIV_ProcessedCommentList
> 無 RLS policy；由 `live-bid-poll` / `live-import` Edge Functions 以 service_role 存取。

### C_CART_CartItemList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| cart_item: select own | public | SELECT | CartID 屬於自己的 Cart（透過 MemberList.UserID） |
| cart_item: insert own | public | INSERT | 同上 |
| cart_item: update own | public | UPDATE | 同上 |
| cart_item: delete own | public | DELETE | 同上 |
| cartitem_select *(重複)* | public | SELECT | 同上 |
| cartitem_insert *(重複)* | public | INSERT | 同上 |
| cartitem_update *(重複)* | public | UPDATE | 同上 |
| cartitem_delete *(重複)* | public | DELETE | 同上 |

### C_CART_CartList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| cart: select own | public | SELECT | MemberID 屬於自己 |
| cart: insert own | public | INSERT | 同上 |
| cart: update own | public | UPDATE | 同上 |
| cart: delete own | public | DELETE | 同上 |
| cart_select *(重複)* | public | SELECT | 同上 |
| cart_insert *(重複)* | public | INSERT | 同上 |
| cart_update *(重複)* | public | UPDATE | 同上 |
| cart_delete *(重複)* | public | DELETE | 同上 |

### C_MBR_MemberAddressList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| addr_select | public | SELECT | MemberID 屬於自己 |
| addr_insert | public | INSERT | 同上 |
| addr_update | public | UPDATE | 同上 |
| addr_delete | public | DELETE | 同上 |

### C_MBR_MemberList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| member_select | public | SELECT | UserID = auth.uid() |
| member_insert | public | INSERT | 同上 |
| member_update | public | UPDATE | 同上 |
| member_delete | public | DELETE | 同上 |
| staff_select_members | authenticated | SELECT | staging.is_staff()（管理員可讀全部會員）|
| staff_update_members | authenticated | UPDATE | staging.is_staff()（管理員可更新會員，含等級）|

### C_MBR_MemberSocialList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| social_select/insert/update/delete | public | ALL | MemberID 屬於自己 |

### C_MBR_WishList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| wish_* | public | ALL | MemberID 屬於自己 |
| wishlist: * *(重複)* | public | ALL | 同上 |

### C_ORD_OrderItemList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_Select_OrderItem | authenticated | SELECT | staging.is_admin() |
| Admin_Insert_OrderItem | authenticated | INSERT | staging.is_admin() |
| Admin_Update_OrderItem | authenticated | UPDATE | staging.is_admin() |
| Admin_Delete_OrderItem | authenticated | DELETE | staging.is_admin() |
| admin read order items | authenticated | SELECT | true |
| order_item: select own ⚠️ | public | SELECT | 查 auth.users（需修正） |
| order_item: insert own ⚠️ | public | INSERT | 查 auth.users（需修正） |
| user_read_own_items | authenticated | SELECT | staging.user_owns_order() |

### C_ORD_OrderList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_Select_Order | authenticated | SELECT | S_SYS_AdminUserList IsAdmin+IsActive |
| Admin_Insert_Order | authenticated | INSERT | staging.is_admin() |
| Admin_Update_Order | authenticated | UPDATE | staging.is_admin() |
| Admin_Delete_Order | authenticated | DELETE | staging.is_admin() |
| order: select own | authenticated | SELECT | CustomerEmail = auth.jwt()->>email ✅ |
| order: insert own ⚠️ | public | INSERT | 查 auth.users（需修正） |

### C_ORD_OrderStatusLog
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_* | authenticated | ALL | staging.is_admin() |

### C_PRD_ProductList / ProductVariantList / ProductPictureList / ProductSizeSpecList / ProductTag
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_* | authenticated | ALL | staging.is_admin() |
| staging_read | public | SELECT | true（公開讀取） |

### C_PRD_ReviewList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| review_select | public | SELECT | IsVisible = true |
| review_insert/update/delete | public | — | MemberID 屬於自己 |

### C_PRD_StockNotifyList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| notify_select/update/delete | public | — | MemberID 屬於自己 |
| notify_insert | public | INSERT | true |

### C_PRM_CouponUsageLog
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| coupon_log_select/update/delete | public | — | MemberID 屬於自己 |
| coupon_log_insert | public | INSERT | true |

### S_MKT_BannerList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| banner_select | public | SELECT | true（公開讀取） |
| banner_insert/update/delete | public | — | auth.role() = 'authenticated' |

### S_ORD_StatusList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_Select/Insert_Status | authenticated | SELECT/INSERT | staging.is_admin() |
| member_read_status | authenticated | SELECT | true（前台訂單詳情顯示訂單狀態名稱用）|

### H_PRD_ProductList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_* | authenticated | ALL | is_admin() |

### S_SHP_ShippingMethodList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| Admin_Select_ShippingMethod | authenticated | SELECT | is_admin()（管理員可讀全部）|
| Admin_Insert_ShippingMethod | authenticated | INSERT | is_admin() |
| Admin_Update_ShippingMethod | authenticated | UPDATE | is_admin() |
| Admin_Delete_ShippingMethod | authenticated | DELETE | is_admin() |
| Member_Select_ShippingMethod | authenticated | SELECT | IsActive = true（登入會員可查看啟用中的配送方式，結帳頁使用）|

### S_MBR_MemberLevelList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| level_select | public | SELECT | true（公開讀取，前台會員中心需要）|
| level_admin_all | authenticated | ALL | staging.is_admin()（僅超管可新增/編輯等級）|

### S_SYS_AdminUserList
| Policy | Role | CMD | 條件 |
|--------|------|-----|------|
| admin_select | authenticated | SELECT | staging.is_admin()（超管可讀全部）|
| admin_insert | authenticated | INSERT | staging.is_admin() |
| admin_update | authenticated | UPDATE | staging.is_admin() |
| admin_delete | authenticated | DELETE | staging.is_admin() |
| self_select | authenticated | SELECT | UserId = auth.uid()（任何管理員可讀自己那筆，loadAdminProfile 使用）|

---

## 常用 Functions

| Function | 說明 |
|----------|------|
| `staging.is_admin()` | 檢查目前使用者是否在 S_SYS_AdminUserList 且 IsAdmin=true, IsActive=true（超管）|
| `staging.is_staff()` | 檢查目前使用者是否在 S_SYS_AdminUserList 且 IsActive=true（任何啟用的管理員）|
| `staging.user_owns_order(OrderID)` | 檢查訂單是否屬於目前使用者 |
| `decrement_stock(p_variant_id bigint, p_qty int)` | 原子性扣庫存（`FOR UPDATE` 鎖）；庫存不足回傳 `false`；加入購物車時呼叫 |
| `restore_stock(p_variant_id bigint, p_qty int)` | 原子性還庫存；移除購物車 / 取消訂單時呼叫 |

> 上述 `decrement_stock` / `restore_stock` 在 `public` 和 `staging` 兩個 schema 各有一份，`SECURITY DEFINER` 確保任何 role 都可呼叫。
