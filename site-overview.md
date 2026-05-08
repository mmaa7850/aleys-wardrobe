# Aley's Wardrobe — 網站功能總覽

> 更新時間：2026-05-08
> 技術棧：Vue 3 + Pinia + Vue Router + Supabase (PostgreSQL + Edge Functions + Storage)

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | Vue 3 (Composition API) |
| 狀態管理 | Pinia |
| 路由 | Vue Router 4，`createWebHistory` |
| 後端 / 資料庫 | Supabase (PostgreSQL) |
| 伺服器端邏輯 | Supabase Edge Functions (Deno) |
| 圖片儲存 | Supabase Storage |
| 金流 | 藍新金流 (NewebPay) |
| 多語系 | vue-i18n（中文 / English） |
| 後台 UI | Bootstrap 5 + 自訂暖色系覆寫 |
| Schema 分離 | `staging`（開發） / `public`（正式），`db.js` 依 `VITE_DB_SCHEMA` 切換 |

---

## 一、前台（Frontend）

前台使用 `FrontendLayout.vue` 包裹，包含頂部導覽列、頁腳，所有一般顧客頁面都在這個 layout 之下。

---

### 1. 首頁 `/`

**HomeView.vue**

- **Hero 區塊**：左側展示品牌標語（Curated Style）、說明文字、「探索新品」按鈕。右側為裝飾框，若後台有設定 `home-hero` banner 則顯示 banner 圖片（填入框內），沒有時顯示原本的裝飾格。
- **Ticker 跑馬燈**：黑底白字，無限滾動，顯示品牌關鍵字。
- **活動橫幅（home-banner）**：Ticker 下方的全寬活動圖，從資料庫即時讀取，多張時每 6 秒自動輪播，可點擊連結。
- **最新上架**：從資料庫撈最新 8 件上架商品，顯示商品卡片（圖片、名稱、售價、原價劃線、SALE 標籤），點擊進商品詳細頁。支援圖片與影片主圖。
- **探索風格**：三個風格卡片（日系、韓系、配件），目前為靜態連結導向商品列表並帶 query 參數。
- **品牌故事**：簡短介紹品牌理念的靜態文字區塊。
- **Admin FAB**：登入管理員才顯示的右下角浮動按鈕，快速進入後台。

---

### 2. 商品列表 `/products`

**ProductListView.vue**

- 顯示全部上架商品（`IsActive = true`），以 4 欄 grid 排列。
- 支援依**分類**篩選（從 `S_PRD_CategoryList` 撈選項）。
- 支援**關鍵字搜尋**（商品名稱模糊比對）。
- 商品卡片顯示：主圖（圖片或影片）、商品名稱、售價、原價（若有折扣則劃線）、SALE 標籤。
- Hover 時顯示「查看商品」覆蓋層。
- 無資料時顯示空狀態提示。

---

### 3. 商品詳細頁 `/products/:id`

**ProductDetailView.vue**

- 讀取單一商品的完整資料：基本資訊、所有圖片/影片、所有規格（顏色 × 尺寸 × 庫存）。
- **媒體展示**：左側主圖大圖（支援圖片與影片），下方縮圖列可切換。
- **顏色選擇**：依商品現有規格顯示顏色按鈕，選色後自動過濾可選尺寸。
- **尺寸選擇**：只顯示所選顏色下有效的尺寸。
- **庫存狀態**：
  - 選了規格後顯示「庫存充足 / 剩餘 N 件 / 已售完」。
  - 若商品 `IsPreOrder = true` 且庫存為 0，自動切換為預購模式：顯示預購 badge、預計出貨日、預購說明，按鈕改為「立即預購」，加入購物車後照常處理。
- **數量選擇**：`+` / `-` 按鈕，不得超過庫存上限。
- **加入購物車**：呼叫 Cart Store，寫入 `C_CART_CartItemList`，按鈕有 loading 與成功動畫。
- **願望清單**：心形按鈕，切換收藏/取消收藏（`C_MBR_WishList`），登入才可使用。
- **Tab 切換**：商品描述 / 尺寸規格，顯示商品的詳細說明與尺寸表。

---

### 4. 購物車 `/cart`

**CartView.vue**

- 顯示目前購物車所有品項（商品圖、名稱、顏色、尺寸、單價、數量、小計）。
- 數量可直接在頁面調整（`+` / `-`），即時更新資料庫。
- 可個別刪除品項。
- 顯示購物車合計金額。
- 「前往結帳」按鈕，導向結帳頁（需登入）。
- 未登入時提示登入，空購物車時顯示提示。

---

### 5. 結帳 `/checkout`（需登入）

**CheckoutView.vue**

- **自動填入**：從會員資料（`C_MBR_MemberList`）讀取姓名、電話，預先填入收件人欄位。
- **配送方式**：從 `S_SHP_ShippingMethodList` 撈取啟用中的配送方式，顯示名稱與運費，讓顧客選擇。超商取貨（`MethodCode = cvscom`）額外顯示門市選擇相關欄位；宅配到府（`MethodCode = home`）顯示收件地址欄位。
- **優惠券**：
  - 手動輸入優惠碼，驗證後套用折扣（`IsAutoApply = false`）。
  - 自動套用：系統主動讀取所有 `IsAutoApply = true` 的有效券，找出滿足消費門檻的最高折扣自動套用。
  - 顯示「再消費 NT$ X 可享折扣」提示，引導加購。
- **金額明細**：商品小計 + 運費 - 手動折扣 - 自動折扣 = 最終金額。
- **送出訂單**：呼叫 Supabase Edge Function `create-payment`，建立訂單並取得藍新付款表單參數，自動 submit HTML form 導向藍新金流頁面。

---

### 6. 訂單成功頁 `/order-success/:orderNo`（需登入）

**OrderSuccessView.vue**

- 顯示訂單編號、感謝文字。
- 提供「查看訂單詳情」和「繼續購物」按鈕。

---

### 7. 訂單詳細頁 `/orders/:orderNo`（需登入）

**OrderDetailView.vue**

- 顯示訂單完整資訊：訂單編號、建立時間、付款狀態、配送狀態。
- 顯示訂購品項清單（商品名稱、規格、數量、單價、小計）。
- 顯示配送資訊（收件人、電話、地址）。
- **物流查詢**：若後台已填入宅配物流單號（`HomeDeliveryNo`），顯示物流公司與單號，並提供「查詢物流狀態 →」連結，直接導向對應物流公司的查詢頁（支援黑貓宅急便、新竹物流、台灣郵局）。
- **重新付款**：若付款狀態為「未付款」或「失敗」，顯示「重新付款」按鈕，呼叫 Edge Function `retry-payment` 取得新的付款表單並提交。

---

### 8. 會員帳戶 `/account`（需登入）

**AccountView.vue**

- 顯示會員基本資料：姓名、Email、電話、性別、生日、加入日期、會員等級。
- 可編輯並儲存：姓名、電話、性別、生日。
- 最近訂單列表：顯示最新 30 筆訂單（訂單號、金額、付款狀態、日期），可點擊進訂單詳細頁。
- 登出功能（呼叫 Supabase Auth signOut）。

---

### 9. 願望清單 `/wishlist`（需登入）

**WishlistView.vue**

- 顯示所有收藏商品的卡片（同商品列表樣式）。
- 可從願望清單移除商品。
- 點擊商品卡片進商品詳細頁。

---

### 10. 我的優惠券 `/coupons`（需登入，且非管理員）

**CouponsView.vue**

- 顯示目前所有有效的優惠券清單（`IsActive = true`，在有效日期內）。
- 呈現每張優惠券的折扣金額、使用條件（最低消費）、有效期限、使用說明。
- 純展示頁，讓顧客查看可用的折扣資訊。

---

### 11. 資訊靜態頁（6 頁）

以下頁面目前均為靜態內容：

| 路徑 | 頁面 | 內容 |
|------|------|------|
| `/size-guide` | 尺寸指南 | 上衣、下著、洋裝尺寸對照表 |
| `/returns` | 退換貨政策 | 退換貨條件、流程、注意事項 |
| `/shipping` | 配送說明 | 各配送方式說明、時效、費用 |
| `/faq` | 常見問題 | Q&A 格式，購物、金流、配送相關問題 |
| `/brand-story` | 品牌故事 | 品牌理念、選品哲學 |
| `/contact` | 聯絡我們 | 客服 Email、Line、社群媒體連結 |

---

### 12. 登入 / 註冊 `/login`

**LoginView.vue**

- Email + Password 登入 / 註冊（Supabase Auth）。
- LINE 社群登入（OAuth 2.0，`provider: "custom:line"`）。
- 忘記密碼：寄送重設密碼信（Supabase Auth）。
- 登入後自動讀取管理員身份（查 `S_SYS_AdminUserList`），有身份者可進後台。
- 成功後導向原本想去的頁面（`redirect` query 參數）。

---

### 13. 重設密碼 `/reset-password`

**ResetPasswordView.vue**

- 接收 Email 連結的 Token，讓使用者輸入新密碼完成重設。

---

### 14. Auth Callback `/auth/callback`

**AuthCallbackView.vue**

- LINE OAuth 登入完成後的回呼頁面，處理 Supabase Session 建立後導向首頁。

---

## 二、後台（Admin）

後台使用 `AdminLayout.vue` 包裹，路徑全在 `/admin` 下，需登入且在 `S_SYS_AdminUserList` 有有效的帳號（`IsActive = true`）。

側欄 `AdminSidebar.vue` 依權限動態顯示各功能模組。

---

### 1. 儀表板 `/admin`

**AdminHome.vue**

- 後台首頁，目前為簡單的歡迎頁面。

---

### 2. 商品管理

#### 商品列表 `/admin/products`（需 `CanManageProducts`）

**ProductList.vue**

- 顯示全部商品清單（商品圖縮圖、名稱、分類、售價、上架狀態、更新時間）。
- 支援關鍵字搜尋、依狀態篩選（全部 / 上架 / 下架）、依分類篩選。
- 點擊「編輯」進商品編輯頁，「新增商品」進新建頁。

#### 商品編輯 `/product/products/:id` 與 `/product/products/new`

**ProductEdit.vue**

- **基本資料**：商品名稱、分類（下拉選單）、售價、原價、商品描述（長文）。
- **上架控制**：`IsActive` 開關決定前台是否顯示。
- **預購設定**：`IsPreOrder` 開關 — 啟用後，若庫存賣完前台自動切為預購模式。可設定預計出貨日（`PreOrderShipDate`）與預購說明（`PreOrderNote`）。
- **媒體管理**：上傳圖片或影片至 Supabase Storage（`product-pictures` bucket）。可設定主圖（`IsMain`）、調整排序（`SortOrder`）、刪除（同步刪 Storage）。
- **規格矩陣**：選擇顏色與尺寸，自動產生規格組合（`C_PRD_ProductVariantList`）。每個規格可設定庫存數量（`StockQty`）和啟用狀態。
- **尺寸規格**：可輸入商品的詳細尺寸表（`C_PRD_ProductSizeSpec`），例如肩寬、胸圍、衣長等。
- 新建商品時會先建立草稿（取得 ID）才能上傳圖片。

#### 顏色管理 `/admin/products/setcolors`

**SetColors.vue**

- 新增 / 編輯 / 刪除顏色選項（`S_PRD_ColorList`）。
- 欄位：名稱（內部識別碼）、描述（前台顯示名稱，中文）。

#### 尺寸管理 `/admin/products/setsizes`

**SetSizes.vue**

- 新增 / 編輯 / 刪除尺寸選項（`S_PRD_SizeList`）。
- 欄位：名稱、描述。

#### 分類管理 `/admin/products/setcategories`

**SetCategories.vue**

- 新增 / 編輯 / 刪除商品分類（`S_PRD_CategoryList`）。
- 前台商品列表的篩選依據。

#### 標籤管理 `/admin/products/settags`

**SetTags.vue**

- 新增 / 編輯 / 刪除商品標籤（`S_PRD_TagList`）。

---

### 3. 訂單管理

#### 訂單列表 `/admin/orders`（需 `CanManageOrders`）

**OrderList.vue**

- 顯示全部訂單清單（訂單號、顧客 Email、總金額、付款狀態、配送狀態、建立時間）。
- 支援關鍵字搜尋（訂單號 / Email）、付款狀態篩選、訂單狀態篩選。
- 點擊訂單開啟詳細 Modal，分三個 Tab：
  - **訂單資訊**：完整顯示顧客資料、收件資訊、配送方式、金額明細；可修改收件姓名、電話、地址、備注。
  - **品項**：訂購的商品清單（名稱、規格、數量、單價）。
  - **狀態紀錄**：訂單狀態變更的歷史紀錄（`C_ORD_OrderLogList`）。
- **修改訂單狀態**：下拉選單修改狀態（從 `S_ORD_StatusList` 撈選項），附帶 Admin 備注。
- **宅配出貨資訊**：若配送方式非超商取貨，且已付款但尚未填單號，可選擇物流公司（黑貓、新竹、郵局、其他）並填入物流單號，按「標記已出貨」後自動更新 `ShippingStatus = shipped`、`ShippingStatusText = 已出貨`，顧客在訂單詳細頁即可看到追蹤連結。
- **退款**：已付款的信用卡訂單可發起退款，呼叫 Edge Function `refund-payment` 串接藍新 NPA-B032 API。

#### 訂單狀態管理 `/admin/orders/setstatus`

**SetStatus.vue**

- 新增 / 編輯 / 刪除訂單狀態選項（`S_ORD_StatusList`），例如「待確認」「處理中」「已出貨」「已完成」。

---

### 4. 庫存管理

#### 庫存總覽 `/admin/inventory/overview`（需 `CanManageProducts`）

**StockOverview.vue**

- 列出所有上架商品的每個規格（商品名稱、顏色、尺寸、庫存數量）。
- 支援篩選：全部 / 低庫存（≤ 5）/ 已售完（= 0）。
- 顯示缺貨數量、低庫存數量的摘要統計。
- 可直接在頁面修改各規格的庫存數量，儲存後寫入資料庫，並同時建立庫存異動紀錄（`C_INV_StockLog`）。
- 點擊商品可跳轉至商品編輯頁。

#### 庫存紀錄 `/admin/inventory/logs`（需 `CanManageProducts`）

**StockLogs.vue**

- 顯示所有庫存異動紀錄（商品名稱、規格、異動數量、異動前後庫存、原因、時間）。
- 支援依商品、時間範圍篩選。

---

### 5. 行銷管理

#### 優惠券管理 `/admin/marketing/setcoupons`（需 `CanManageMarketing`）

**SetCoupons.vue**

- 新增 / 編輯 / 刪除優惠券（`S_PRM_CouponList`）。
- 欄位：
  - **Name**：優惠碼（顧客輸入的代碼）。
  - **DiscountValue**：折扣金額（固定金額折扣）。
  - **MinOrderAmount**：最低消費門檻（選填）。
  - **IsAutoApply**：是否自動套用（不需輸入優惠碼）。
  - **StartDate / EndDate**：有效期間。
  - **IsActive**：是否啟用。
  - **UsageCount**：剩餘使用次數（每次成功付款後 -1）。
- 結帳時系統會驗證優惠券有效性（日期、使用次數、最低消費），並在訂單建立時扣除使用次數。

#### Banner 管理 `/admin/marketing/setbanners`（需 `CanManageMarketing`）

**SetBanners.vue**

- 新增 / 編輯 / 刪除活動 Banner（`S_MKT_BannerList`）。
- **圖片上傳**：直接上傳到 Supabase Storage（`banners` bucket），或貼入外部圖片 URL。
- **顯示位置（Position）**：
  - `home-hero`：首頁 Hero 右側的裝飾框內（建議比例 3:4 直式）。
  - `home-banner`：Ticker 下方全寬活動橫幅（建議比例 16:5 橫式）。
- 欄位：Alt 文字、點擊連結（選填）、開始/結束日期（排程顯示）、排序、是否顯示。
- 列表可快速切換顯示/隱藏（無需開 Modal）。
- 刪除時同步刪除 Storage 上的圖片檔案。

---

### 6. 會員管理

#### 會員列表 `/admin/members`（需 `CanManageMembers`）

**MemberList.vue**

- 顯示所有一般會員（排除管理員帳號）。
- 欄位：姓名、Email、電話、性別、註冊來源、會員等級、啟用狀態、加入時間。
- 支援關鍵字搜尋、依會員等級篩選。
- 可在列表直接修改會員等級（下拉選單）。

#### 會員等級管理 `/admin/members/levels`（需 `CanManageMembers`）

**SetMemberLevels.vue**

- 新增 / 編輯 / 刪除會員等級（`S_MBR_MemberLevelList`）。
- 欄位：等級名稱、描述、排序。

---

### 7. 系統設定

#### 付款方式 `/admin/settings/setpaymethods`（需 `CanManageSettings`）

**SetPayMethods.vue**

- 管理可用的付款方式（`S_PAY_PayMethodList`）。
- 欄位：名稱、描述、是否啟用。

#### 配送方式 `/admin/settings/setshippingmethods`（需 `CanManageSettings`）

**SetShippingMethods.vue**

- 管理配送選項（`S_SHP_ShippingMethodList`）。
- 欄位：名稱、描述、運費（`Fee`）、方式代碼（`MethodCode`，例如 `cvscom` / `home`）、是否啟用。
- `MethodCode` 決定結帳頁的表單邏輯（超商取貨 vs. 宅配到府）。

#### 參數分類 `/admin/settings/setconfigcategories`（需 `CanManageSettings`）

**SetConfigCategories.vue**

- 管理網站參數的分類（`S_SYS_ConfigCategoryList`），用來組織 SetConfig 頁面的設定項目。

#### 網站參數 `/admin/settings/setconfig`（需 `CanManageSettings`）

**SetConfig.vue**

- 管理全站可設定的參數（`S_SYS_ConfigList`）。
- 例如：公告文字、聯絡資訊、社群媒體連結等 Key-Value 設定。

#### 管理員帳號 `/admin/settings/admin-users`（僅 `IsAdmin = true` 可進入）

**AdminUsers.vue**

- 管理後台使用者帳號（`S_SYS_AdminUserList`）。
- 欄位：Email、是否為超級管理員（`IsAdmin`）、帳號啟用、各模組權限（商品、訂單、行銷、設定、會員）。
- 只有超級管理員（`IsAdmin = true`）才能進入此頁面。

---

## 三、Supabase Edge Functions（金流與物流）

所有 Edge Functions 均在 Deno 環境執行，部署在 Supabase Functions。

| Function | 觸發時機 | 功能 |
|----------|----------|------|
| `create-payment` | 顧客送出結帳表單 | 驗證訂單、套用優惠券、計算最終金額、建立訂單記錄（`C_ORD_OrderList`、`C_ORD_OrderItemList`）、AES 加密參數、回傳藍新付款表單參數 |
| `payment-notify` | 藍新付款完成 Webhook（背景通知） | 驗證藍新 SHA256 簽章、更新訂單付款狀態為 `paid`、減少商品庫存（`StockQty -= qty`）、扣除優惠券使用次數 |
| `payment-return` | 顧客完成付款後導回（前台） | 與 `payment-notify` 相似但為同步流程，讓顧客看到成功畫面 |
| `retry-payment` | 顧客點「重新付款」 | 對同一訂單重新產生藍新付款表單參數，不重建訂單 |
| `refund-payment` | 後台管理員發起退款 | 呼叫藍新 NPA-B032 退款 API，僅支援信用卡類付款方式（CREDIT、ApplePay、GooglePay 等） |
| `store-callback` | 超商門市選擇回呼 | 接收超商地圖選門市的回呼，回傳門市代碼與名稱 |
| `store-map` | 顧客點「選擇門市」 | 產生超商地圖選店的啟動參數，導向藍新超商地圖頁面 |
| `logistics-notify` | 藍新物流狀態 Webhook | 接收物流配送進度通知，更新訂單配送狀態 |

---

## 四、Pinia 狀態管理

### auth.js
- 儲存登入使用者（`user`）、管理員身份（`isAdmin`）、帳號啟用（`isActive`）、各模組權限（`permissions`）。
- `canEnterAdmin`：有帳號且 `isActive = true` 即可進後台（非超管也可，但功能受限）。
- 提供：Email 登入、LINE OAuth 登入、登出、密碼重設。

### cart.js
- 購物車以資料庫為主（`C_CART_CartList`、`C_CART_CartItemList`），不用 localStorage。
- 登入後自動載入購物車。若會員尚無記錄，自動在 `C_MBR_MemberList` 建立。
- 支援：載入品項、加入品項（重複規格自動加量）、修改數量、刪除、清空。

### wishlist.js
- 以資料庫為主（`C_MBR_WishList`），儲存已收藏的商品 ID。
- `has(id)`：判斷某商品是否已收藏。
- `toggle(productId)`：加入或移除收藏。

---

## 五、Storage Buckets

| Bucket | 用途 | 存取設定 |
|--------|------|----------|
| `product-pictures` | 商品圖片與影片 | Public（前台顯示）；管理員可上傳、刪除 |
| `banners` | 首頁 Banner 圖片 | Public（前台顯示）；管理員可上傳、刪除 |

---

## 六、權限控制架構

| 身份 | 條件 | 可做的事 |
|------|------|----------|
| 未登入 | — | 瀏覽首頁、商品、靜態資訊頁 |
| 一般會員 | 登入 | + 購物車、結帳、訂單、帳戶、願望清單、優惠券頁 |
| 後台人員 | 登入 + `IsActive = true` | + 進後台（依 `CanManage*` 權限決定可看哪些模組） |
| 超級管理員 | 登入 + `IsAdmin = true` | + 全部後台功能 + 管理員帳號管理 |

---

## 七、多語系

- 使用 `vue-i18n`，支援 `zh-TW` 和 `en-US`。
- 語系切換在後台頂欄的語言下拉選單，儲存至 `localStorage`。
- 主要後台頁面（商品、訂單、優惠券等）均有對應的 i18n key。
- 前台目前以中文為主，多語系尚未完整套用至前台頁面。
