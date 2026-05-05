# Aley's Wardrobe — 現有功能總覽

> 專案技術棧：Vue 3 + Pinia + Vue Router + Supabase (PostgreSQL + Storage + Auth) + Supabase Edge Functions + NewebPay 藍新金流

---

## 前台（顧客端）

### 頁面

| 頁面 | 路由 | 說明 |
|------|------|------|
| 首頁 | `/` | Hero 區塊、跑馬燈、新品 8 件、品牌故事、分類卡片；管理員可見 FAB 快速進入後台 |
| 商品列表 | `/products` | 分類 pill 篩選 + 排序下拉、Load More 分頁、商品卡片（售價/原價/sale badge/收藏愛心）|
| 商品詳情 | `/products/:id` | 圖片/影片 Gallery、顏色→尺寸選擇、**數量選擇器（上限卡庫存）**、規格表、加入購物車（未登入自動導 /login）、收藏 |
| 購物車 | `/cart` | 商品列表、數量 ± 控制、刪除、訂單摘要（小計/運費/總計）|
| 結帳 | `/checkout` | 收件人表單、配送方式（宅配/7-11 C2C）、7-11 門市地圖選擇（popup）、付款方式（信用卡/超商/ATM/WebATM）、備註欄、串接藍新金流 |
| 結帳成功 | `/order-success/:orderNo` | 動畫打勾、訂單編號、回首頁/查訂單連結 |
| 訂單詳情 | `/orders/:orderNo` | 訂單狀態、付款狀態 badge、收件人資訊、商品明細、ATM 繳費帳號（如適用）、重新付款按鈕 |
| 會員中心 | `/account` | 個人資料（姓名/電話/性別/生日）、訂單歷史、收藏捷徑、登出 |
| 收藏清單 | `/wishlist` | 收藏商品格狀顯示、移除收藏 |
| 登入/註冊 | `/login` | Email 登入、LINE OAuth、註冊、忘記密碼 |
| 重設密碼 | `/reset-password` | 密碼重設表單 |
| OAuth 回調 | `/auth/callback` | LINE 登入回調處理 |

---

## 後台（管理員）

> 進入條件：需登入 + `S_SYS_AdminUserList` 中 `IsAdmin = true` 且 `IsActive = true`

| 頁面 | 路由 | 說明 |
|------|------|------|
| 儀表板 | `/admin` | 後台首頁 |
| 庫存總覽 | `/admin/inventory/overview` | 所有上架商品各 variant 剩餘庫存、低庫存（≤5）/售完警示、篩選、點擊跳編輯商品 |
| 商品列表 | `/admin/products` | 商品管理（搜尋/篩選/CRUD）|
| 商品編輯 | `/admin/products/:id` | 建立/編輯商品（詳情、圖片/影片上傳、顏色尺寸 variant、價格）|
| 顏色設定 | `/admin/products/setcolors` | 管理顏色選項 |
| 尺寸設定 | `/admin/products/setsizes` | 管理尺寸選項 |
| 分類設定 | `/admin/products/setcategories` | 管理商品分類 |
| 標籤設定 | `/admin/products/settags` | 管理商品標籤 |
| 訂單列表 | `/admin/orders` | 全部訂單、依狀態/日期/顧客篩選 |
| 訂單狀態管理 | `/admin/orders/setstatus` | 修改訂單狀態 |
| 優惠券設定 | `/admin/marketing/setcoupons` | 建立/管理折扣優惠券 |
| Banner 設定 | `/admin/marketing/setbanners` | 首頁促銷 Banner 管理 |
| 付款方式設定 | `/admin/settings/setpaymethods` | 設定可用付款方式 |
| 配送方式設定 | `/admin/settings/setshippingmethods` | 設定配送選項 |
| 系統設定分類 | `/admin/settings/setconfigcategories` | 設定分類類型 |
| 系統設定 | `/admin/settings/setconfig` | 全站設定 |

---

## Supabase Edge Functions

| Function | 說明 |
|----------|------|
| `create-payment` | 建立訂單（驗庫存、寫入 DB）、加密藍新金流參數、回傳 Gateway URL |
| `payment-notify` | 藍新付款回調 webhook：解密驗簽、更新付款狀態、扣庫存、啟動 7-11 物流 |
| `retry-payment` | 重新付款：在訂單號加 `_R1/_R2` 後綴、回傳新加密參數 |
| `store-map` | 產生 7-11 門市選擇地圖的加密表單參數 |
| `store-callback` | 接收門市選擇結果，透過 postMessage 傳回結帳頁 |
| `logistics-notify` | 7-11 出貨狀態 webhook：更新訂單物流資訊 |

---

## Pinia Stores

| Store | 說明 |
|-------|------|
| `auth.js` | 使用者 session（登入/登出/LINE OAuth）、admin 權限判斷 |
| `cart.js` | 購物車 CRUD、自動建立 MemberList、帶入商品圖片/顏色/尺寸資訊 |
| `wishlist.js` | 收藏清單 toggle（`C_MBR_WishList`）|

---

## 主要資料庫資料表

### 商品
- `C_PRD_ProductList` — 商品主檔
- `C_PRD_ProductVariantList` — 商品 variant（顏色 × 尺寸 × 庫存）
- `C_PRD_ProductPictureList` — 圖片/影片媒體
- `C_PRD_ProductSizeSpecList` — 尺寸規格尺（胸/腰/臀等）
- `S_PRD_ColorList` / `S_PRD_SizeList` / `S_PRD_CategoryList` — 系統選項

### 會員與購物
- `C_MBR_MemberList` — 會員資料
- `C_MBR_WishList` — 收藏清單
- `C_CART_CartList` / `C_CART_CartItemList` — 購物車

### 訂單
- `C_ORD_OrderList` — 訂單主檔（含付款狀態、配送方式、ATM 帳號等）
- `C_ORD_OrderItemList` — 訂單明細

### 系統
- `S_SYS_AdminUserList` — 管理員名單

---

## 第三方整合

| 服務 | 用途 |
|------|------|
| 藍新金流 (NewebPay) | 信用卡、超商代碼、ATM、WebATM 付款 |
| 藍新物流 | 7-11 C2C 超商取貨 |
| Supabase Auth | Email 登入、LINE OAuth |
| Supabase Storage | 商品圖片/影片存放 |

---

## UI / 樣式

- **色系**：暖米色 (cream/linen) + 金色 (gold) 點綴
- **字型**：標題用 Cormorant Garamond 襯線體、內文用系統字
- **RWD 斷點**：768px / 1024px / 1200px
- **動畫**：hover zoom、shimmer 載入、結帳成功打勾動畫
