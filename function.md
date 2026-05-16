# Aley's Wardrobe — 現有功能總覽

> 更新時間：2026-05-16
> 技術棧：Vue 3 + Pinia + Vue Router + Supabase (PostgreSQL + Storage + Auth) + Supabase Edge Functions + NewebPay 藍新金流

---

## 前台（顧客端）

### 頁面

| 頁面 | 路由 | 說明 |
|------|------|------|
| 首頁 | `/` | Hero 區塊（左側文字 + 右側裝飾框）、跑馬燈 Ticker、**動態 Banner 橫幅**（`home-banner`，Ticker 下方全寬，多張輪播）、最新上架 8 件商品卡片、探索風格分類卡、品牌故事；管理員可見 FAB 快速進入後台 |
| 商品列表 | `/products` | 分類篩選 + 關鍵字搜尋、商品卡片（圖片/影片、售價/原價劃線/SALE badge）、Hover 顯示「查看商品」 |
| 商品詳情 | `/products/:id` | 圖片/影片 Gallery（主圖 + 縮圖列）、顏色→尺寸選擇（依庫存過濾）、**數量選擇器**（現貨上限卡庫存；預購上限 99）、商品描述/尺寸規格 Tab；**預購模式**：`IsPreOrder=true` 且所選 variant 庫存歸零時顯示預購 badge + 預計出貨日 + 說明，按鈕改「立即預購」，數量選擇器仍顯示；加入購物車、收藏按鈕 |
| 購物車 | `/cart` | 品項列表（**勾選欄**（僅非預購品項）、圖、名稱、規格、**預購預計出貨日**、數量 ± 控制、刪除）；預購品項不顯示勾選框、不計入合計；**已選取合計金額**；前往結帳按鈕（無勾選時 disabled）；`cart.initSelection()` 在載入後自動勾選所有非預購品項 |
| 結帳 | `/checkout` | 僅結算購物車中**已勾選品項**（`cart.selectedItems`）；自動從會員資料填入姓名/電話；**配送方式**從 DB 動態載入，超商取貨（`cvscom`）/ 宅配到府（`home`）驅動不同表單欄位；**手動優惠碼**輸入驗證；**滿額自動折抵**（`IsAutoApply=true`，自動套用最高折扣，距下一門檻進度提示）；**錢包折抵**：「使用錢包折抵」選項（顯示餘額、折抵金額、實付金額）；全錢包支付不走藍新直接建立已付款訂單；**電子發票設定**（5 種：紙本 / 手機條碼 / 自然人憑證 / 捐贈愛心碼 / 公司戶統編，各有格式驗證）；金額明細（小計+運費-折扣-錢包折抵）；送出後呼叫 `create-payment` Edge Function，自動 submit 藍新付款表單（或全錢包直接完成）；成功後僅移除已勾選品項 |
| 優惠券專區 | `/coupons` | 僅一般會員可見（管理員導首頁）；分兩區：**滿額自動折抵**（金色 badge、無需輸入）、**優惠碼**（顯示代碼 + 一鍵複製）；從 DB 動態載入有效期內且 `IsActive=true` 的優惠券 |
| 結帳成功 | `/order-success/:orderNo` | 成功訊息、訂單編號、前往訂單詳情 / 繼續購物 |
| 訂單紀錄 | `/orders` | 完整訂單列表（依建立時間倒序）；四色付款狀態 badge（待付款/已付款/付款失敗/已退款）；桌面版表格 header，行動版簡化雙列；空清單提示「去逛逛」 |
| 訂單詳情 | `/orders/:orderNo` | 訂單狀態、付款狀態 badge、商品明細、收件人資訊、**宅配物流追蹤**：後台填入單號後顯示物流公司 + 單號 + 可點擊的查詢連結（黑貓、新竹、郵局）；ATM 繳費帳號（付款前）；**重新付款**按鈕（呼叫 `retry-payment`） |
| 會員中心 | `/account` | 個人資料（姓名/電話/性別/生日）可編輯儲存、會員等級顯示、最近 3 筆訂單預覽（附「查看全部訂單」連結跳 `/orders`）、登出；**⚠️ 待開發** — 「綁定 Facebook 帳號」選項（Email 帳號用戶可綁定 FB，FB User ID 存 `C_MBR_MemberSocialList`） |
| 收藏清單 | `/wishlist` | 收藏商品格狀顯示、移除收藏 |
| 尺寸指南 | `/size-guide` | S/M/L/XL 量法說明 + 各尺寸對照表（靜態） |
| 退換貨政策 | `/returns` | 7 天鑑賞期、退換條件、4 步驟流程（靜態） |
| 運費說明 | `/shipping` | 超商取貨 / 宅配到府費用與出貨時程說明（靜態） |
| 常見問題 | `/faq` | Accordion Q&A（靜態） |
| 品牌故事 | `/brand-story` | 三段式品牌敘事（靜態） |
| 聯絡我們 | `/contact` | 聯絡資訊 + 表單（靜態） |
| 錢包 | `/wallet` | 前台錢包頁面（需登入）；顯示目前餘額（深色漸層卡片）；快速選擇金額按鈕（100/300/500/1000/3000）或自訂金額；發票設定（5種：紙本/手機條碼/自然人憑證/捐贈愛心碼/公司戶）；前往藍新付款；交易紀錄列表（類型/金額/前後餘額/時間）；付款成功後輪詢餘額直到入帳（最多20秒每2秒一次） |
| 登入/註冊 | `/login` | Email 登入/註冊、Facebook OAuth（FB f logo，藍色 #1877F2）、忘記密碼；**⚠️ 等待客戶提供 FB App ID/Secret** |
| 重設密碼 | `/reset-password` | 密碼重設表單 |
| OAuth 回調 | `/auth/callback` | OAuth 登入回調處理 |

---

## 後台（管理員）

> 進入條件：需登入 + `S_SYS_AdminUserList` 中 `IsActive = true`（Sidebar 依權限動態過濾功能模組）
>
> 後台風格：深色側欄（`#1a1714`）、暖米色主體（`#faf7f4`）、Cormorant Garamond 品牌字、金色（`#C8A882`）Bootstrap 覆寫（按鈕、卡片、表格、表單、Modal、Tab、分頁）

| 頁面 | 路由 | 權限 | 說明 |
|------|------|------|------|
| 儀表板 | `/admin` | 全部 | 後台首頁 |
| 商品列表 | `/admin/products` | CanManageProducts | 搜尋/狀態/分類篩選、商品縮圖、進編輯頁 |
| 商品編輯 | `/product/products/:id` | CanManageProducts | 基本資料（名稱/分類/售價/原價/描述）；**上架開關**（`IsActive`）；**預購設定**（`IsPreOrder` + 預計出貨日 + 預購說明）；圖片/影片上傳至 Storage（`product-pictures`）、設主圖/排序/刪除；顏色 × 尺寸 variant 矩陣（庫存數量）；尺寸規格表 |
| 顏色設定 | `/admin/products/setcolors` | CanManageProducts | 管理顏色選項（`S_PRD_ColorList`） |
| 尺寸設定 | `/admin/products/setsizes` | CanManageProducts | 管理尺寸選項（`S_PRD_SizeList`） |
| 分類設定 | `/admin/products/setcategories` | CanManageProducts | 管理商品分類（`S_PRD_CategoryList`） |
| 標籤設定 | `/admin/products/settags` | CanManageProducts | 管理商品標籤（`S_PRD_TagList`） |
| 庫存總覽 | `/admin/inventory/overview` | CanManageProducts | 所有上架商品各 variant 庫存、低庫存（≤5）/售完警示、可直接修改數量並建立異動紀錄 |
| 庫存紀錄 | `/admin/inventory/logs` | CanManageProducts | 庫存異動歷史（異動量、前後庫存、原因、時間） |
| 訂單列表 | `/admin/orders` | CanManageOrders | 全部訂單；依訂單號/Email 搜尋、付款狀態/訂單狀態篩選；點開 Modal 分三 Tab：**訂單資訊**（可修改收件資訊、備注、訂單狀態）、**品項**、**狀態紀錄**；**宅配出貨**：填物流公司 + 單號 → 標記已出貨（更新 `HomeDeliveryNo`/`HomeDeliveryCompany`/`ShippingStatus`）；**退款**：信用卡訂單可發起退款（呼叫 `refund-payment`）；**⚠️ 待測試 — 電子發票**：已付款訂單可手動開立發票（呼叫 `issue-invoice`，B2C/含稅 5%/PrintFlag=Y）、作廢發票（全額退款用）、開立折讓（部分退款用）；發票狀態 badge 顯示於訂單資訊卡；**全錢包訂單**：顯示灰色「儲值時已開立，本筆無需開立」badge 替代開立發票按鈕；訂單詳情顯示錢包折抵/藍新實付金額分開 |
| 訂單狀態管理 | `/admin/orders/setstatus` | CanManageOrders | 管理訂單狀態選項（`S_ORD_StatusList`） |
| 優惠券設定 | `/admin/marketing/setcoupons` | CanManageMarketing | 建立/管理優惠券（優惠碼、折扣金額、最低消費門檻、`IsAutoApply`、有效期、使用次數） |
| Banner 設定 | `/admin/marketing/setbanners` | CanManageMarketing | 建立/管理 Banner（`S_MKT_BannerList`）；**圖片直接上傳** Supabase Storage（`banners` bucket）或貼外部 URL；**顯示位置**：`home-hero`（首頁 Hero 裝飾框內，建議 3:4）/ `home-banner`（Ticker 下方全寬，建議 16:5）；日期排程；列表快速開關顯示/隱藏；刪除同步移除 Storage 檔案 |
| 會員列表 | `/admin/members` | CanManageMembers | 全部一般會員（排除管理員帳號）、搜尋/等級篩選、可直接切換會員等級 |
| 會員等級設定 | `/admin/members/levels` | CanManageMembers | 管理會員等級（`S_MBR_MemberLevelList`） |
| **錢包管理** | `/admin/wallet` | CanManageMembers | 管理員錢包管理；搜尋並選擇會員；查看餘額與交易紀錄；手動調整餘額（需填備注） |
| 付款方式設定 | `/admin/settings/setpaymethods` | CanManageSettings | 管理付款方式（`S_PAY_PayMethodList`） |
| 配送方式設定 | `/admin/settings/setshippingmethods` | CanManageSettings | 管理配送方式（名稱、`MethodCode`、`Fee`、啟用）；`MethodCode` 決定結帳流程（`cvscom` / `home`） |
| 系統設定分類 | `/admin/settings/setconfigcategories` | CanManageSettings | 管理設定分類（`S_SYS_ConfigCategoryList`） |
| 系統設定 | `/admin/settings/setconfig` | CanManageSettings | 全站 Key-Value 參數（`S_SYS_Config`）；前台透過 `useSiteConfigStore` 讀取；已實作：`announcement`（公告欄）、`maintenance_mode`、`payment_disabled` |
| 管理者帳號 | `/admin/settings/admin-users` | IsAdmin（超管）| 管理後台帳號與細項權限（`S_SYS_AdminUserList`）；僅超管可進入 |
| **報表 — 銷售總覽** | `/admin/reports/sales` | 全部 | 今日/本週/本月/自訂區間切換；4 張 stat card（已付款營收、訂單數、客單價、退款金額）；低庫存警示卡片；每日已付款營收折線圖（Chart.js） |
| **報表 — 商品排行** | `/admin/reports/products` | 全部 | 已付款訂單統計；依銷售金額或數量排序；時間區間可選（本週/本月/近3月/自訂）；前3名 🥇🥈🥉 |
| **報表 — 優惠券效益** | `/admin/reports/coupons` | 全部 | 各券：使用次數/使用率進度條/折扣總額/帶動營收；7天內到期標黃；手動碼 vs 自動折抵分類顯示 |
| **報表 — 訂單狀態分佈** | `/admin/reports/orders` | 全部 | 全部訂單甜甜圈圖（付款狀態4種：待付款/已付款/付款失敗/已退款）；佔比表格；點擊跳訂單列表 |
| **報表 — 會員成長趨勢** | `/admin/reports/members` | 全部 | 近12個月月新增柱狀圖；3張 stat card（累積總數/本月活躍/回購會員數） |

---

## Supabase Edge Functions

| Function | JWT 驗證 | 說明 |
|----------|----------|------|
| `create-payment` | ✅ 需要 | 後端驗證手動優惠券（有效期/使用次數/`IsActive`/`MinOrderAmount`）；後端自動偵測滿額折抵（`IsAutoApply=true`，挑選符合門檻最高折扣一張）；計算 `FinalAmount = 小計 + 運費 − 手動折扣 − 自動折抵`；建立訂單（`C_ORD_OrderList` / `C_ORD_OrderItemList`）；**儲存客戶發票偏好**（`InvoiceCarrierType`/`InvoiceCarrierNum`/`InvoiceLoveCode`/`InvoiceBuyerUBN`/`InvoiceBuyerName`）；扣除手動與自動優惠券 `UsageCount`；依 `shippingMethodCode` 決定是否加 CVSCOM 參數；AES 加密藍新參數，回傳 Gateway URL；**錢包折抵**：接受 `walletDeductAmt` 參數；計算 `walletDeduct = min(walletBalance, finalAmount)`，`newebpayAmt = finalAmount - walletDeduct`；若 walletDeduct > 0 則先扣錢包（若後續失敗自動回補）；若 newebpayAmt = 0 → 全錢包支付，直接建立已付款訂單並扣庫存，return `{ walletOnly: true, orderNo }`，不走藍新；藍新付款金額改為 newebpayAmt；訂單新增 WalletDeductAmt / NewebpayAmt 欄位 |
| `payment-notify` | ❌ 關閉 | 藍新背景 webhook：驗簽解密、更新付款狀態為 `paid`、扣庫存、儲存 CVSCOM 門市資訊（`StoreCode`/`LgsNo`） |
| `payment-return` | ❌ 關閉 | 藍新前台導回：儲存付款方式、ATM 帳號、CVSCOM 門市資訊，導向 `/order-success/:orderNo` |
| `retry-payment` | ✅ 需要 | 對同一訂單重新產生藍新付款參數（訂單號加 `_R1/_R2` 後綴），不重建訂單 |
| `refund-payment` | ✅ 需要 | 呼叫藍新 NPA-B032 退款 API；僅支援信用卡類付款（CREDIT、ApplePay、GooglePay 等） |
| `logistics-notify` | ❌ 關閉 | 藍新物流 NPA-B58 webhook：接收貨態推播，更新 `ShippingStatus`/`ShippingStatusText` |
| `issue-invoice` ⚠️ 待測試 | ✅ 需要 | ezPay 電子發票操作；支援三個 action：`issue`（開立，讀取訂單的發票偏好自動判斷：B2C/B2B Category、PrintFlag、CarrierType/CarrierNum、LoveCode、BuyerUBN；B2B 以未稅金額作為 ItemPrice，B2C 以含稅金額；商品費用+運費拆列）、`void`（作廢，填作廢原因「訂單退款」）、`allowance`（開立折讓，立即確認 Status=1）；AES-256-CBC 加密（block size 32，`node:crypto` 實作）；結果寫回 `C_ORD_OrderList` 的 Invoice* 欄位；環境變數：`EZPAY_MERCHANT_ID` / `EZPAY_HASH_KEY` / `EZPAY_HASH_IV` / `EZPAY_ENV`（test/prod）；**全錢包支付訂單**（NewebpayAmt=0 且 WalletDeductAmt>0）直接拒絕開立（儲值時已開過）；**混合付款訂單**發票金額為 NewebpayAmt（非 FinalAmount）；運費按比例分攤 |
| `store-map` | ✅ 需要 | （舊流程殘留）產生超商地圖選店參數，現已不在結帳流程使用 |
| `store-callback` | ❌ 關閉 | （舊流程殘留）接收門市選擇回呼，現已不在結帳流程使用 |
| `wallet-topup` | ✅ 需要 | 前端呼叫建立儲值訂單；驗證金額（正整數）；生成 TopupNo（TU_YYYYMMDD_XXXXX）；寫入 C_MBR_WalletTopupList；建立藍新 MPG 付款參數（ReturnURL=wallet-topup-return, NotifyURL=wallet-topup-notify）；回傳加密付款參數 |
| `wallet-topup-notify` | ❌ 關閉 | 藍新儲值 server-to-server webhook；驗簽解密；冪等檢查（已處理就跳過）；更新 PaymentStatus；入帳 C_MBR_WalletList（upsert）；寫入 C_MBR_WalletTxList；自動呼叫 ezPay 開立發票 |
| `wallet-topup-return` | ❌ 關閉 | 藍新儲值付款後瀏覽器 redirect；解密結果；導向 /wallet?topup=success 或 /wallet?topup=fail |
| `wallet-adjust` | ✅ 需要 | 管理員手動調整錢包餘額；GET：取得餘額+交易紀錄；POST：驗證金額（非零整數）與備注、確認餘額不低於0、upsert C_MBR_WalletList、寫入 C_MBR_WalletTxList (TxType='adjust') |

---

## Pinia Stores

| Store | 說明 |
|-------|------|
| `auth.js` | 使用者 session、登入（Email / Facebook OAuth，`signInWithFacebook`，provider: "facebook"）/登出/重設密碼；查 `S_SYS_AdminUserList` 取得 `isAdmin`/`isActive`/`permissions`（5 個 Can*）；getter `canEnterAdmin`（IsActive=true）、`canAccess(perm)` |
| `cart.js` | 購物車以 DB 為主（`C_CART_CartList` / `C_CART_CartItemList`）；登入後自動建立會員記錄；加入/修改數量/刪除/清空；品項帶入商品圖片/顏色/尺寸資訊；**品項預購判斷**：`IsPreOrder=true && variant.StockQty <= 0` 雙重條件，同一商品不同 variant 可各自獨立判斷現貨/預購；**選取狀態**：state `selectedItemIds`；getter `selectedItems`（已選品項）/ `selectedTotal`（已選合計）；action `initSelection()`（預設勾選所有非預購品項）/ `toggleSelection(id)` |
| `wishlist.js` | 收藏清單 toggle（`C_MBR_WishList`）；`has(id)` 判斷是否收藏 |
| `siteConfig.js` | 從 `S_SYS_Config` 一次性載入所有 Key-Value 設定（`loaded` 守衛防重複請求）；getter：`get(key)`、`announcement`、`maintenanceMode`、`paymentDisabled`；`FrontendLayout` 掛載時呼叫 `load()` |
| `wallet.js` | 錢包餘額（balance）與交易紀錄（transactions）；fetchBalance（查 C_MBR_WalletList）；fetchTransactions（查 C_MBR_WalletTxList，最近50筆）；topup（呼叫 wallet-topup Edge Function，回傳藍新付款參數）；reset() |

---

## 主要資料庫資料表

### 商品
- `C_PRD_ProductList` — 商品主檔（含 `IsPreOrder`/`PreOrderShipDate`/`PreOrderNote`）
- `C_PRD_ProductVariantList` — 商品 variant（顏色 × 尺寸 × `StockQty`）
- `C_PRD_ProductPictureList` — 圖片/影片媒體（Storage 路徑）
- `C_PRD_ProductSizeSpecList` — 尺寸規格（胸/腰/臀等）
- `S_PRD_ColorList` / `S_PRD_SizeList` / `S_PRD_CategoryList` / `S_PRD_TagList` — 系統選項

### 會員與購物
- `C_MBR_MemberList` — 會員資料（`UserID`/`Email`/`Phone`/`Gender`/`Birthday`/`MemberLevelID`）
- `C_MBR_WishList` — 收藏清單
- `C_CART_CartList` / `C_CART_CartItemList` — 購物車
- `C_MBR_WalletList` — 錢包主表（MemberID/Balance/CreatedDate/UpdatedDate）；RLS：僅本人可讀
- `C_MBR_WalletTxList` — 交易流水帳（TxType: topup/order_deduct/refund/adjust；Amount 正=入負=扣；BalanceBefore/BalanceAfter；RelatedOrderNo/RelatedTopupNo；CreatedBy 管理員調整時填入）；RLS：僅本人可讀
- `C_MBR_WalletTopupList` — 儲值訂單（TopupNo/MemberID/Amount/PaymentStatus/InvoiceStatus 及完整 Invoice* 欄位）；RLS：僅本人可讀

### 訂單
- `C_ORD_OrderList` — 訂單主檔（付款狀態、配送方式/運費/地址、`DiscountAmount`/`FinalAmount`、`HomeDeliveryNo`/`HomeDeliveryCompany`、`ShippingStatus`/`ShippingStatusText`、ATM 帳號、超商門市資訊；**⚠️ 待測試** — 電子發票欄位：`InvoiceStatus`/`InvoiceNo`/`InvoiceNumber`/`InvoiceRandomNum`/`InvoiceIssuedAt`/`InvoiceAllowanceNo`/`InvoiceAllowanceAmt`；**客戶發票偏好**：`InvoiceCarrierType`（null=紙本/`0`=手機條碼/`1`=自然人憑證/`2`=ezPay 載具/`D`=捐贈/`B2B`=公司戶）/`InvoiceCarrierNum`/`InvoiceLoveCode`/`InvoiceBuyerUBN`/`InvoiceBuyerName`；migration：`add_invoice_preference_fields.sql`；**錢包欄位**：`WalletDeductAmt`（integer，錢包折抵金額）/`NewebpayAmt`（integer，藍新實付金額，0=全錢包支付）；migration：`add_wallet_tables.sql`）
- `C_ORD_OrderItemList` — 訂單明細
- `C_ORD_OrderLogList` — 訂單狀態異動紀錄

### 行銷
- `S_PRM_CouponList` — 優惠券（`Name`/`DiscountValue`/`MinOrderAmount`/`IsAutoApply`/`UsageCount`/有效期）
- `S_MKT_BannerList` — Banner（`ImagePath`/`Position`/`LinkURL`/`AltText`/`SortOrder`/`StartDate`/`EndDate`/`IsActive`）

### 庫存
- `C_INV_StockLog` — 庫存異動紀錄

### 會員等級
- `S_MBR_MemberLevelList` — 會員等級設定

### 系統設定
- `S_SYS_AdminUserList` — 管理員帳號（`IsAdmin`/`IsActive`/5 個 Can* 欄位）
- `S_SHP_ShippingMethodList` — 配送方式（`Fee`/`MethodCode`/`IsActive`）
- `S_PAY_PayMethodList` — 付款方式
- `S_SYS_ConfigCategoryList` / `S_SYS_Config` — 全站 Key-Value 設定（前台透過 `useSiteConfigStore` 消費）
- `S_ORD_StatusList` — 訂單狀態選項

---

## Storage Buckets

| Bucket | 用途 |
|--------|------|
| `product-pictures` | 商品圖片與影片（Public；管理員上傳/刪除） |
| `banners` | 首頁 Banner 圖片（Public；管理員上傳/刪除） |

## Edge Function JWT 例外設定（supabase/config.toml）

以下 Edge Functions 設定 `verify_jwt = false`（接收藍新 webhook 或瀏覽器 redirect，無法帶 JWT）：
- `payment-notify`
- `payment-return`
- `logistics-notify`
- `store-callback`
- `wallet-topup-notify`
- `wallet-topup-return`

---

## 第三方整合

| 服務 | 用途 |
|------|------|
| 藍新金流 (NewebPay) MPG | 信用卡、ATM 轉帳付款；`CVSCOM=1` 讓藍新 MPG 頁面處理超商門市選擇 |
| 藍新物流 (NewebPay Logistics) | 7-11 C2C 超商取貨不付款；藍新自動建立物流單並回傳 `LgsNo`；NPA-B58 推播貨態 |
| 藍新退款 NPA-B032 | 信用卡類訂單退款 API |
| ezPay 電子發票加值服務 ⚠️ 待測試 | 開立/作廢/折讓電子發票；測試環境：`cinv.ezpay.com.tw`；正式環境：`inv.ezpay.com.tw`；API 文件整理於 `ezpay.md` |
| Supabase Auth | Email 登入/註冊/重設密碼、Facebook OAuth（程式碼已完成，等待客戶提供 FB App ID/Secret） |
| Supabase Storage | 商品圖片/影片、Banner 圖片存放 |
| Chart.js | 後台報表圖表（折線圖、甜甜圈圖、柱狀圖）；僅後台報表頁使用，lazy load |
| Google Analytics 4 | `src/lib/gtag.js`；`initGA()` 啟動時注入 gtag.js；追蹤 4 個事件：`view_item`（商品詳情）、`add_to_cart`（加入購物車）、`begin_checkout`（進入結帳）、`purchase`（付款成功，sessionStorage 防重複）；Measurement ID 存 `.env` `VITE_GA_MEASUREMENT_ID`；後台 `/admin/reports/analytics` 頁面顯示追蹤狀態 + Looker Studio 嵌入（`ga_looker_studio_url` 存 S_SYS_Config） |

---

## UI / 樣式

### 前台
- 色系：暖米色（`--fe-cream` / `--fe-linen`）+ 金色（`--fe-gold: #C8A882`）點綴
- 字型：標題用 Cormorant Garamond 襯線體，內文用系統字
- RWD 斷點：768px / 1200px
- **LINE OA 浮動按鈕**：`FrontendLayout` 右下角固定 `position:fixed` 綠色圓形按鈕（`#06C755`）；讀取 `S_SYS_Config` 的 `line_oa_url`，未設定時自動隱藏；hover 有放大動效

### 後台
- 側欄：深色 `#1a1714` 背景、Cormorant Garamond 品牌名稱、金色 `#C8A882` 啟用指示
- 主體：暖米色 `#faf7f4` 背景、`#fdf9f5` 頂欄
- Bootstrap 5 + 全域覆寫（`.admin-layout` 限縮作用域）：`btn-primary` → 金色、`.card` → 暖邊框、`.table thead` → 暖色背景、表單 focus → 金色外框、Nav Tab 啟用 → 金色底線
