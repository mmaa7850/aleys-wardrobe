# Database Schema — staging & public

> 更新時間：2026-05-24
> Schema：`staging`（開發）、`public`（正式）

---

## Migration 紀錄

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `add_shipping_method_fields.sql` | 新增 ShippingMethod / HomeDelivery* 欄位 | ✅ 已執行 |
| `add_trade_no.sql` | 新增 TradeNo 欄位（藍新退款用） | ✅ 已執行 |
| `add_invoice_fields.sql` | Invoice* 欄位（ezPay）+ ATM 轉帳欄位（錢包儲值）+ 發票載具欄位（InvoiceCarrierType 等） | ✅ 已執行 |

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
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| CartID | bigint | NO | — |
| ProductID | bigint | NO | — |
| VariantID | bigint | NO | — |
| Qty | integer | YES | 1 |
| AddedAt | timestamptz | YES | now() |

### C_CART_CartList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | now() |

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
| IsActive | boolean | YES | true |
| CreatedDate | timestamptz | YES | now() |
| UpdatedDate | timestamptz | YES | now() |

### C_MBR_MemberSocialList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| MemberID | bigint | NO | — |
| Platform | text | YES | — |
| SocialUserID | text | YES | — |
| SocialEmail | text | YES | — |
| CreatedDate | timestamptz | YES | now() |

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

### C_ORD_OrderList
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| OrderNo | varchar | NO | — |

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

### C_ORD_OrderStatusLog
| 欄位 | 型別 | Nullable | Default |
|------|------|----------|---------|
| ID | bigint | NO | — |
| OrderID | bigint | NO | — |
| FromStatusID | bigint | YES | — |
| ToStatusID | bigint | NO | — |
| Note | text | YES | — |
| CreatedDate | timestamptz | NO | now() |

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
