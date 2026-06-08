# Aley's Wardrobe — 現有功能總覽

> 更新時間：2026-06-08
> 技術棧：Vue 3 + Pinia + Vue Router + Supabase (PostgreSQL + Storage + Auth) + Supabase Edge Functions + NewebPay 藍新金流

---

## 前台（顧客端）

### 頁面

| 頁面 | 路由 | 說明 |
|------|------|------|
| 首頁 | `/` | Hero 區塊（左側文字 + 右側裝飾框）、跑馬燈 Ticker、**動態 Banner 橫幅**（`home-banner`，Ticker 下方全寬，多張輪播）、最新上架 8 件商品卡片、探索風格分類卡、品牌故事；管理員可見 FAB 快速進入後台 |
| 商品列表 | `/products` | 分類篩選 + 關鍵字搜尋、商品卡片（圖片/影片、售價/原價劃線/SALE badge）、Hover 顯示「查看商品」 |
| 商品詳情 | `/products/:id` | 圖片/影片 Gallery（主圖 + 縮圖列）、顏色→尺寸選擇（依庫存過濾）、數量選擇器（上限卡庫存）、商品描述/尺寸規格 Tab；**預購模式**：`IsPreOrder=true` 且庫存歸零時顯示預購 badge + 預計出貨日 + 說明，按鈕改「立即預購」；加入購物車、收藏按鈕 |
| 購物車 | `/cart` | 品項列表拆為**現貨**與**預購**兩個區塊（各自有獨立「前往結帳」按鈕，以 `?type=stock` / `?type=preorder` 帶入結帳）；數量 ± 控制（加入時已扣庫存，調整時同步增減）、刪除並還庫存；預購品顯示「三週內出貨」固定文字；合計金額分區顯示；已取消（`CancelledAt IS NOT NULL`）品項自動過濾 |
| 結帳 | `/checkout` | 自動從會員資料填入姓名/電話；**電話格式驗證**（台灣手機/市話，`/^0\d{8,9}$/`，允許含連字號）；**錯誤訊息顯示在對應欄位下方**（姓名/電話/地址/發票 分別顯示）；**配送方式**從 DB 動態載入，超商取貨（`cvscom`）/ 宅配到府（`home`）驅動不同表單欄位；**手動優惠碼**輸入驗證；**滿額自動折抵**；**錢包折抵**（勾選後以 `walletDeductAmt` 傳給 Edge Function，全額折抵時不送藍新直接完成訂單）；**電子發票載具選擇**（紙本/手機條碼/自然人憑證/捐贈/公司戶三聯式）；金額明細；送出後呼叫 `create-payment` Edge Function，自動 submit 藍新付款表單 |
| 優惠券專區 | `/coupons` | 僅一般會員可見（管理員導首頁）；分兩區：**滿額自動折抵**（金色 badge、無需輸入）、**優惠碼**（顯示代碼 + 一鍵複製）；從 DB 動態載入有效期內且 `IsActive=true` 的優惠券 |
| 結帳成功 | `/order-success/:orderNo` | 成功訊息、訂單編號、前往訂單詳情 / 繼續購物 |
| 訂單紀錄 | `/orders` | 完整訂單列表（依建立時間倒序）；四色付款狀態 badge（待付款/已付款/付款失敗/已退款）；桌面版表格 header，行動版簡化雙列；空清單提示「去逛逛」 |
| 訂單詳情 | `/orders/:orderNo` | 訂單狀態 badge（從 `S_ORD_StatusList` 查中文名稱）、付款狀態 badge（含已退款）、商品明細；金額計算有錢包折抵時顯示 NewebpayAmt；**宅配物流追蹤**：後台填入單號後顯示物流公司 + 單號 + 可點擊查詢連結；ATM 繳費帳號（待付款時顯示，已退款後隱藏）；**重新付款**按鈕（待付款時顯示，已退款後隱藏，呼叫 `retry-payment`，含 CREDIT/VACC/LINEPAY 三種付款方式） |
| 會員中心 | `/account` | 個人資料（姓名/電話/性別/生日）可編輯儲存、會員等級顯示、最近 3 筆訂單預覽（附「查看全部訂單」連結跳 `/orders`）、登出 |
| 錢包 | `/wallet` | 錢包餘額顯示；**ATM 待付款卡片**（顯示虛擬帳號 + 到期日）；儲值功能（選金額 + 載具類型 → 藍新信用卡/ATM）；儲值記錄、消費記錄 tab |
| 收藏清單 | `/wishlist` | 收藏商品格狀顯示、移除收藏 |
| 尺寸指南 | `/size-guide` | S/M/L/XL 量法說明 + 各尺寸對照表（靜態） |
| 退換貨政策 | `/returns` | 7 天鑑賞期、退換條件、4 步驟流程（靜態） |
| 運費說明 | `/shipping` | 超商取貨 / 宅配到府費用與出貨時程說明（靜態） |
| 常見問題 | `/faq` | Accordion Q&A（靜態） |
| 品牌故事 | `/brand-story` | 三段式品牌敘事（靜態） |
| 聯絡我們 | `/contact` | 聯絡資訊 + 表單（靜態） |
| 登入/註冊 | `/login` | Email 登入/註冊、LINE OAuth、忘記密碼 |
| 重設密碼 | `/reset-password` | 密碼重設表單 |
| OAuth 回調 | `/auth/callback` | LINE 登入回調處理 |
| LINE 帳號綁定 | `/bind-line` | 從 LINE OA 收到綁定連結後跳入；帶 `token` 參數；登入狀態下呼叫 `line-bind` Edge Function 完成綁定，寫入 `C_MBR_MemberList.LineUserID` |

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
| 耗材品項 | `/admin/inventory/consumables` | CanManageProducts | 包材/贈品/其他耗材 CRUD；單位成本與庫存由進貨單自動維護（加權平均）；可啟用/停用 |
| 耗材進貨 | `/admin/inventory/consumable-purchases` | CanManageProducts | 耗材採購單列表（PurchaseNo 自動產生）；點入詳情頁操作品項與確認進貨 |
| 耗材進貨詳情 | `/admin/inventory/consumable-purchases/:id` | CanManageProducts | 新增/編輯/刪除進貨品項；確認進貨後更新耗材加權平均成本與庫存；確認後不可修改 |
| 訂單列表 | `/admin/orders` | CanManageOrders | 全部訂單；依訂單號/Email 搜尋、付款狀態/訂單狀態篩選；點開 Modal 分三 Tab：**訂單資訊**（可修改收件資訊、備注、訂單狀態）、**品項**、**狀態紀錄**；**宅配出貨**：填物流公司 + 單號 → 標記已出貨（更新 HomeDelivery* + ShippingStatus + **StatusID 自動設為 shipped**）；**退款**：依付款方式顯示對應退款按鈕（信用卡→藍新API / ATM/LINE Pay→手動匯款 / 錢包→退回錢包），退款後 **StatusID 自動設為 refunded**；**電子發票**：已付款訂單可手動補開（呼叫 `issue-invoice`）、作廢（全額退款用）、開立折讓（部分退款用）；錢包全額付款訂單顯示「毋需開立」；**耗材用量**：出貨時選擇包材/贈品品項 + 數量，記錄至 `C_ORD_OrderConsumableList`，成本自動帶入該耗材當前單位成本；顯示合計耗材成本；**金流資訊卡**：顯示訂單金額/實收金額/錢包折抵/手續費/**淨收金額**（實付－手續費）；付款方式全中文顯示 |
| 訂單狀態管理 | `/admin/orders/setstatus` | CanManageOrders | 管理訂單狀態選項（`S_ORD_StatusList`） |
| 優惠券設定 | `/admin/marketing/setcoupons` | CanManageMarketing | 建立/管理優惠券（優惠碼、折扣金額、最低消費門檻、`IsAutoApply`、有效期、使用次數） |
| Banner 設定 | `/admin/marketing/setbanners` | CanManageMarketing | 建立/管理 Banner（`S_MKT_BannerList`）；**圖片直接上傳** Supabase Storage（`banners` bucket）或貼外部 URL；**顯示位置**：`home-hero`（首頁 Hero 裝飾框內，建議 3:4）/ `home-banner`（Ticker 下方全寬，建議 16:5）；日期排程；列表快速開關顯示/隱藏；刪除同步移除 Storage 檔案 |
| 會員列表 | `/admin/members` | CanManageMembers | 全部一般會員（排除管理員帳號）、搜尋/等級篩選、可直接切換會員等級；**購物車管理**按鈕（Modal）：顯示該會員購物車內所有品項（含商品名稱/顏色/尺寸/數量），可逐筆移除並回補庫存（呼叫 `manage-member-cart`），或合併同款品項 / 調整數量 |
| 會員等級設定 | `/admin/members/levels` | CanManageMembers | 管理會員等級（`S_MBR_MemberLevelList`） |
| 費用分類設定 | `/admin/finance/expense-categories` | CanManageSettings | 管理月度費用分類（租金/水電費/設備/文具耗材/人事費用/其他）；排序/啟用停用 |
| 月度費用 | `/admin/finance/monthly-expenses` | CanManageSettings | 按年月記錄固定與非固定營運費用（選分類 + 說明 + 金額）；月合計即時顯示 |
| 付款方式設定 | `/admin/settings/setpaymethods` | CanManageSettings | 管理付款方式（`S_PAY_PayMethodList`） |
| 配送方式設定 | `/admin/settings/setshippingmethods` | CanManageSettings | 管理配送方式（名稱、`MethodCode`、`Fee`、啟用）；`MethodCode` 決定結帳流程（`cvscom` / `home`） |
| 系統設定分類 | `/admin/settings/setconfigcategories` | CanManageSettings | 管理設定分類（`S_SYS_ConfigCategoryList`） |
| 系統設定 | `/admin/settings/setconfig` | CanManageSettings | 全站 Key-Value 參數（`S_SYS_Config`）；前台透過 `useSiteConfigStore` 讀取；已實作：`announcement`（公告欄）、`maintenance_mode`、`payment_disabled` |
| 管理者帳號 | `/admin/settings/admin-users` | IsAdmin（超管）| 管理後台帳號與細項權限（`S_SYS_AdminUserList`）；僅超管可進入；**Email → UserId 查詢工具**：輸入 Email 可自動查出對應 `auth.users.id`（UUID），方便新增管理員時填入 |
| 待結清單 | `/admin/orders/pending` | CanManageOrders | **Tab1 購物車待結帳**：列出有購物車品項的會員，可發 LINE 通知付款連結；**Tab2 本週被封鎖名單**：顯示本週銷單後被封鎖的會員（`IsBlocked=true`），列出被取消的購物車品項明細（呼叫 `get-blocked-members`）；**測試按鈕**：手動觸發 `cancel-orders` 銷單（預計正式上線後移除）|
| 直播場次列表 | `/admin/live` | CanManageOrders | 直播場次 CRUD（建立/管理）；顯示場次標題、日期、狀態 |
| 直播場次詳情 | `/admin/live/:id` | CanManageOrders | 三個 Tab：**商品對照表**（代碼↔商品↔直播價，可新增/編輯/刪除）/ **留言解析建單**（貼入 FB 留言文字 → 解析 → 批次建單 → LINE 通知）/ **FB 直播監控**（連接 FB 直播 → 即時輪詢留言 → 自動搶標/截標；起標按鈕顯示開標中 badge，截標按鈕截止）|
| **報表 — 銷售總覽** | `/admin/reports/sales` | 全部 | 今日/本週/本月/自訂區間切換；4 張 stat card（已付款營收、訂單數、客單價、退款金額）；低庫存警示卡片；每日已付款營收折線圖（Chart.js） |
| **報表 — 商品排行** | `/admin/reports/products` | 全部 | 已付款訂單統計；依銷售金額或數量排序；時間區間可選（本週/本月/近3月/自訂）；前3名 🥇🥈🥉 |
| **報表 — 優惠券效益** | `/admin/reports/coupons` | 全部 | 各券：使用次數/使用率進度條/折扣總額/帶動營收；7天內到期標黃；手動碼 vs 自動折抵分類顯示 |
| **報表 — 訂單狀態分佈** | `/admin/reports/orders` | 全部 | 全部訂單甜甜圈圖（付款狀態4種：待付款/已付款/付款失敗/已退款）；佔比表格；點擊跳訂單列表 |
| **報表 — 會員成長趨勢** | `/admin/reports/members` | 全部 | 近12個月月新增柱狀圖；3張 stat card（累積總數/本月活躍/回購會員數） |
| **報表 — 毛利報表** | `/admin/reports/profit` | 全部 | 日期區間篩選；訂單級毛利明細（含耗材成本欄）；成本拆解彙總（進貨成本/手續費/運費/耗材/退換費用） |
| **報表 — 賣場淨利報表** | `/admin/reports/store-profit` | 全部 | 月份選擇；第一層訂單毛利彙總 + 第二層月度固定費用 = 本月淨利；淨利率；訂單明細含耗材欄 |

---

## Supabase Edge Functions

| Function | JWT 驗證 | 說明 |
|----------|----------|------|
| `create-payment` | ✅ 需要 | 後端驗證手動優惠券；後端自動偵測滿額折抵；計算 `FinalAmount`；錢包折抵（`WalletDeductAmt`）；全額錢包付款不送藍新（`walletOnly:true`）；建立訂單並於建立時設 `StatusID`=第一個狀態；全額錢包時補寫 `PaidAt`/`PaymentMethod='wallet'`/`StatusID`=第二個狀態；依 `shippingMethodCode` 決定是否加 CVSCOM 參數；AES 加密藍新參數 |
| `payment-notify` | ❌ 關閉 | 藍新背景 webhook：驗簽解密、更新 `PaymentStatus=paid`/`PaidAt`/`PaymentMethod`/`TradeNo`；計算並存入 `PaymentFee`（信用卡2.8%、ATM1% 上限NT$20、LINE Pay 2.31%）；自動設 `StatusID`=第二個狀態（已付款）；扣庫存；儲存 CVSCOM 門市資訊；呼叫 ezPay 自動開立電子發票（依 InvoiceCarrierType 帶入對應載具參數） |
| `payment-return` | ❌ 關閉 | 藍新前台導回：儲存付款方式、ATM 帳號、CVSCOM 門市資訊，導向 `/order-success/:orderNo` |
| `retry-payment` | ✅ 需要 | 對同一訂單重新產生藍新付款參數（訂單號加 `_R0~R9` 後綴避免重複，不重建訂單）；開放信用卡 + ATM 轉帳 + LINE Pay（CREDIT=1、VACC=1、LINEPAY=1、ExpireDate 3天）；超商取貨訂單附加 CVSCOM/LgsType 參數；使用 `NewebpayAmt`（扣除錢包後的實際付款金額）|
| `refund-payment` | ✅ 需要 | 呼叫藍新 NPA-B032 退款 API；僅支援信用卡類付款（CREDIT、ApplePay、GooglePay 等） |
| `logistics-notify` | ❌ 關閉 | 藍新物流 NPA-B58 webhook：接收貨態推播，更新 `ShippingStatus`/`ShippingStatusText` |
| `issue-invoice` | ✅ 需要 | ezPay 電子發票操作；支援三個 action：`issue`（開立，依 `InvoiceCarrierType` 自動帶入對應載具參數：紙本=B2C/PrintFlag=Y、手機條碼=CarrierType:1、自然人憑證=CarrierType:2、捐贈=LoveCode/PrintFlag:N、公司戶=B2B/BuyerUBN）、`void`（作廢）、`allowance`（開立折讓）；AES-256-CBC 加密（block size 32）；結果寫回 `C_ORD_OrderList` Invoice* 欄位；環境變數：`EZPAY_MERCHANT_ID` / `EZPAY_HASH_KEY` / `EZPAY_HASH_IV` / `EZPAY_ENV` |
| `wallet-topup` | ✅ 需要 | 建立儲值單（`C_MBR_WalletTopupList`）並產生藍新付款參數；支援信用卡 + ATM 轉帳 + LINE Pay（CREDIT=1、VACC=1、LINEPAY=1）；接收載具類型供儲值完成後開發票 |
| `wallet-topup-notify` | ❌ 關閉 | 藍新儲值 webhook：驗簽解密、更新 `PaymentStatus=paid`、加計 `C_MBR_WalletList.Balance`、寫 `C_MBR_WalletTxList` 流水帳；ATM 入帳後自動呼叫 ezPay 開立儲值發票 |
| `wallet-topup-return` | ❌ 關閉 | 藍新儲值前台 redirect：ATM 取號成功時將 `ATMBankCode`/`ATMAccount`/`ATMExpireDate` 寫入 DB，導向 `/wallet?topup=atm_pending` |
| `wallet-adjust` | ✅ 需要 | 後台手動調整錢包餘額（加值或扣減），寫 `WalletTxList` 流水帳 |
| `wallet-refund` | ✅ 需要 | 退款時將金額退回錢包（代替原付款方式退款），寫 `WalletTxList` 流水帳 |
| `store-map` | ✅ 需要 | （舊流程殘留）產生超商地圖選店參數，現已不在結帳流程使用 |
| `store-callback` | ❌ 關閉 | （舊流程殘留）接收門市選擇回呼，現已不在結帳流程使用 |
| `line-webhook` | ❌ 關閉 | LINE Messaging API Webhook：收到 Follow 事件時建立 `LineBindToken`（7天效期）並私訊綁定連結；收到 Unfollow 事件時清除 `C_MBR_MemberList.LineUserID` |
| `line-bind` | ✅ 需要 | LINE 帳號綁定完成：驗證 `LineBindToken`（有效期內且未使用）；寫入 `C_MBR_MemberList.LineUserID`；標記 Token 已使用 |
| `live-import` | ✅ 需要 | 直播代建訂單：解析前端傳入的逐行留言（`FbName + Code + 顏色 + 尺寸 + 數量`）；以 `FbName` 查會員；檢查 `IsBlocked`（封鎖者拒絕）；扣庫存（`decrement_stock`）；建訂單（`OrderSource='live'`）；LINE 推播付款連結 |
| `live-bid-poll` | ✅ 需要 | FB 直播即時監控：`start_monitor` 開始輪詢 FB Live Comments API；`stop_monitor` 停止；`start_bid` 起標（貼起標公告到 FB + 建 `C_LIV_ActiveBidList` 記錄）；`stop_bid` 截標（結算，呼叫 `live-import` 批次建單）；`poll` 單次輪詢（解析留言、比對開標代碼、去重）|
| `cancel-orders` | ✅ 需要 | 銷單 Edge Function（也可由 pg_cron 定時呼叫）：取消所有 `pending`/`failed` 訂單；呼叫 `restore_stock` 回補庫存；軟刪除購物車現貨品（設 `CancelledAt`，預購品保留）；同步回補購物車現貨庫存；設相關會員 `IsBlocked=true` |
| `get-blocked-members` | ✅ 需要 | 取得本週被封鎖會員清單（供 PendingList Tab2 顯示）：查 `IsBlocked=true` 且本週 `UpdatedDate` 的會員；附帶被取消的購物車品項明細（含商品名稱/顏色/尺寸） |
| `manage-member-cart` | ✅ 需要 | 後台會員購物車管理：`GET` 查詢指定會員購物車品項（Join 商品/顏色/尺寸名稱）；`REMOVE` 移除單一品項並呼叫 `restore_stock` 回補庫存（後台硬刪除，軟刪除保留給 cron 使用）|

---

## Pinia Stores

| Store | 說明 |
|-------|------|
| `auth.js` | 使用者 session、登入（Email / LINE OAuth）/登出/重設密碼；查 `S_SYS_AdminUserList` 取得 `isAdmin`/`isActive`/`permissions`（5 個 Can*）；getter `canEnterAdmin`（IsActive=true）、`canAccess(perm)` |
| `cart.js` | 購物車以 DB 為主（`C_CART_CartList` / `C_CART_CartItemList`）；登入後自動建立會員記錄；加入/修改數量/刪除/清空；品項帶入商品圖片/顏色/尺寸資訊 |
| `wishlist.js` | 收藏清單 toggle（`C_MBR_WishList`）；`has(id)` 判斷是否收藏 |
| `siteConfig.js` | 從 `S_SYS_Config` 一次性載入所有 Key-Value 設定（`loaded` 守衛防重複請求）；getter：`get(key)`、`announcement`、`maintenanceMode`、`paymentDisabled`；`FrontendLayout` 掛載時呼叫 `load()` |

---

## 主要資料庫資料表

### 商品
- `C_PRD_ProductList` — 商品主檔（含 `IsPreOrder`/`PreOrderShipDate`/`PreOrderNote`）
- `C_PRD_ProductVariantList` — 商品 variant（顏色 × 尺寸 × `StockQty`）
- `C_PRD_ProductPictureList` — 圖片/影片媒體（Storage 路徑）
- `C_PRD_ProductSizeSpecList` — 尺寸規格（胸/腰/臀等）
- `S_PRD_ColorList` / `S_PRD_SizeList` / `S_PRD_CategoryList` / `S_PRD_TagList` — 系統選項

### 會員與購物
- `C_MBR_MemberList` — 會員資料（`UserID`/`Email`/`Phone`/`Gender`/`Birthday`/`MemberLevelID`/`LineUserID`/`FbName`/`IsBlocked`）
- `C_MBR_WishList` — 收藏清單
- `C_CART_CartList` / `C_CART_CartItemList` — 購物車（含 `Source`/`LiveSessionID`/`IsReward`/`CancelledAt`）
- `C_MBR_WalletList` — 錢包餘額（每個會員一列）
- `C_MBR_WalletTopupList` — 儲值記錄（含 ATM 虛擬帳號、發票欄位）
- `C_MBR_WalletTxList` — 錢包異動流水帳（topup / order_deduct / refund / adjust）
- `LineBindToken` — LINE 帳號綁定 Token（一次性，7天效期）

### 訂單
- `C_ORD_OrderList` — 訂單主檔（付款狀態、配送方式/運費/地址、`DiscountAmount`/`FinalAmount`、`WalletDeductAmt`/`NewebpayAmt`（錢包折抵）、`OrderType`（stock/preorder）、`OrderSource`（web/live）、`LiveSessionID`/`LiveCode`（直播代建）、`TradeNo`（藍新退款用）、`HomeDeliveryNo`/`HomeDeliveryCompany`、`ShippingStatus`/`ShippingStatusText`、ATM 帳號、超商門市資訊、電子發票欄位）
- `C_ORD_OrderItemList` — 訂單明細
- `C_ORD_OrderLogList` — 訂單狀態異動紀錄

### 直播
- `C_LIV_SessionList` — 直播場次（`FbPageId`/`FbLiveVideoId`/`Status`）
- `C_LIV_ProductList` — 場次商品對照表（代碼↔Variant↔直播價）
- `C_LIV_ActiveBidList` — 目前開標中的商品（同場次同代碼最多一個 open）
- `C_LIV_ProcessedCommentList` — 已處理 FB 留言 ID（跨輪詢去重）

### 行銷
- `S_PRM_CouponList` — 優惠券（`Name`/`DiscountValue`/`MinOrderAmount`/`IsAutoApply`/`UsageCount`/有效期）
- `S_MKT_BannerList` — Banner（`ImagePath`/`Position`/`LinkURL`/`AltText`/`SortOrder`/`StartDate`/`EndDate`/`IsActive`）

### 庫存
- `C_INV_StockLog` — 庫存異動紀錄

### 耗材
- `C_INV_ConsumableList` — 耗材品項主檔（Name/Category:包材|贈品|其他/Unit/CostPrice 加權平均/StockQty/IsActive）
- `C_INV_ConsumablePurchaseList` — 耗材進貨單（PurchaseNo/PurchaseDate/Status:draft|confirmed）
- `C_INV_ConsumablePurchaseItemList` — 耗材進貨明細（PurchaseID/ConsumableID/Qty/UnitCost/SubTotal）
- `C_ORD_OrderConsumableList` — 訂單耗材使用記錄（OrderID/ConsumableID/ConsumableName/Unit/Qty/UnitCost/Amount）

### 財務
- `S_FIN_ExpenseCategoryList` — 費用分類設定（Name/Description/SortOrder/IsActive）
- `C_FIN_MonthlyExpenseList` — 月度費用記錄（Year/Month/CategoryID/Name/Amount）

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

---

## 第三方整合

| 服務 | 用途 |
|------|------|
| 藍新金流 (NewebPay) MPG | 信用卡、ATM 轉帳付款；`CVSCOM=1` 讓藍新 MPG 頁面處理超商門市選擇 |
| 藍新物流 (NewebPay Logistics) | 7-11 C2C 超商取貨不付款；藍新自動建立物流單並回傳 `LgsNo`；NPA-B58 推播貨態 |
| 藍新退款 NPA-B032 | 信用卡類訂單退款 API |
| ezPay 電子發票加值服務 | 開立/作廢/折讓電子發票；測試環境：`cinv.ezpay.com.tw`；正式環境：`inv.ezpay.com.tw`；API 文件整理於 `ezpay.md`；支援紙本/手機條碼/MOICA/捐贈碼/公司戶 |
| LINE Messaging API | 直播代建訂單後發送付款連結推播（`line-import` 呼叫 `/message/push`）；LINE OA Follow/Unfollow 事件處理帳號綁定/解綁（`line-webhook`）；Channel Access Token 存 `LINE_CHANNEL_ACCESS_TOKEN` |
| FB Graph API | `pages_read_engagement` + `pages_manage_engagement` 權限；直播即時監控輪詢 `/{live_video_id}/comments`；發表起標公告（`live-bid-poll`）；Page Access Token 存 `FB_PAGE_ACCESS_TOKEN` |
| Supabase Auth | Email 登入/註冊/重設密碼、LINE OAuth |
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
