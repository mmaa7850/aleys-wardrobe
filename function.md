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
| 購物車 | `/cart` | 商品列表、數量 ± 控制、刪除、訂單摘要（商品小計，運費顯示「結帳時選擇」）|
| 結帳 | `/checkout` | **配送方式卡片選擇**（從 DB 動態載入，依 MethodCode 驅動流程）：超商取貨僅需訂購人姓名/電話，宅配到府需額外填收件地址；**優惠券輸入欄 + 套用/移除按鈕**（前端預驗、折扣即時顯示，僅限非自動折抵券）；**滿額自動折抵**（頁面載入時自動偵測 IsAutoApply=true 的有效優惠，達門檻自動套用最優惠一張，進度條顯示距下一折扣門檻）；訂單摘要（商品小計 + 運費 − 優惠碼折扣 − 自動折抵 = 實付）；確認後 edge function 驗庫存/驗券/建訂單，導向藍新金流頁；超商門市在藍新頁選擇，宅配直接由填寫的地址處理 |
| 優惠券專區 | `/coupons` | 僅一般登入會員可見（管理員帳號不顯示此連結）；分兩區塊：**滿額自動折抵**（金色 badge、無需輸入）、**優惠碼**（顯示代碼 + 一鍵複製）；資料從 S_PRM_CouponList 動態載入有效期內且 IsActive=true 的優惠券 |
| 結帳成功 | `/order-success/:orderNo` | 動畫打勾、訂單編號、回首頁/查訂單連結 |
| 訂單詳情 | `/orders/:orderNo` | 訂單狀態、付款狀態 badge、收件人資訊、取貨門市、商品明細、ATM 繳費帳號（付款前顯示）、重新付款按鈕 |
| 會員中心 | `/account` | 個人資料（姓名/電話/性別/生日）、訂單歷史、收藏捷徑、登出 |
| 收藏清單 | `/wishlist` | 收藏商品格狀顯示、移除收藏 |
| 尺寸指南 | `/size-guide` | S/M/L/XL 量法說明 + 各尺寸對照表 |
| 退換貨政策 | `/returns` | 7 天鑑賞期、退換條件、4 步驟流程 |
| 運費說明 | `/shipping` | 超商取貨 NT$80 / 宅配到府 NT$100、出貨時程 |
| 常見問題 | `/faq` | Accordion Q&A（FAQ 點擊展開） |
| 品牌故事 | `/brand-story` | 三段式品牌敘事 |
| 聯絡我們 | `/contact` | 聯絡資訊 + 表單（送出後顯示感謝畫面） |
| 登入/註冊 | `/login` | Email 登入、LINE OAuth、註冊、忘記密碼 |
| 重設密碼 | `/reset-password` | 密碼重設表單 |
| OAuth 回調 | `/auth/callback` | LINE 登入回調處理 |

---

## 後台（管理員）

> 進入條件：需登入 + `S_SYS_AdminUserList` 中 `IsActive = true`（任何啟用的管理員帳號均可進入，Sidebar 依權限過濾）

| 頁面 | 路由 | 權限 | 說明 |
|------|------|------|------|
| 儀表板 | `/admin` | 全部 | 後台首頁 |
| 庫存總覽 | `/admin/inventory/overview` | CanManageProducts | 所有上架商品各 variant 剩餘庫存、低庫存（≤5）/售完警示、篩選、點擊跳編輯商品 |
| 商品列表 | `/admin/products` | CanManageProducts | 商品管理（搜尋/篩選/CRUD）|
| 商品編輯 | `/admin/products/:id` | CanManageProducts | 建立/編輯商品（詳情、圖片/影片上傳、顏色尺寸 variant、價格）、**各 variant 庫存數量直接編輯（v-model StockQty，支援批次設定為 0 或 5）**|
| 顏色設定 | `/admin/products/setcolors` | CanManageProducts | 管理顏色選項 |
| 尺寸設定 | `/admin/products/setsizes` | CanManageProducts | 管理尺寸選項 |
| 分類設定 | `/admin/products/setcategories` | CanManageProducts | 管理商品分類 |
| 標籤設定 | `/admin/products/settags` | CanManageProducts | 管理商品標籤 |
| 訂單列表 | `/admin/orders` | CanManageOrders | 全部訂單、依狀態/日期/顧客篩選 |
| 訂單狀態管理 | `/admin/orders/setstatus` | CanManageOrders | 修改訂單狀態 |
| 優惠券設定 | `/admin/marketing/setcoupons` | CanManageMarketing | 建立/管理折扣優惠券 |
| Banner 設定 | `/admin/marketing/setbanners` | CanManageMarketing | 首頁促銷 Banner 管理 |
| 會員列表 | `/admin/members` | CanManageMembers | 全部一般會員列表，可直接切換會員等級 |
| 會員等級設定 | `/admin/members/levels` | CanManageMembers | 建立/編輯會員等級（新增/編輯僅 IsAdmin 可操作）|
| 付款方式設定 | `/admin/settings/setpaymethods` | CanManageSettings | 設定可用付款方式 |
| 配送方式設定 | `/admin/settings/setshippingmethods` | CanManageSettings | 新增/編輯配送方式（名稱、MethodCode、運費、說明、啟用/停用）；Name/MethodCode 建立後不可改；表格直接切換 IsActive |
| 系統設定分類 | `/admin/settings/setconfigcategories` | CanManageSettings | 設定分類類型 |
| 系統設定 | `/admin/settings/setconfig` | CanManageSettings | 全站設定 |
| 管理者帳號 | `/admin/settings/admin-users` | IsAdmin（超管）| 新增/編輯管理員帳號與細項權限 |

---

## Supabase Edge Functions

| Function | JWT 驗證 | 說明 |
|----------|----------|------|
| `create-payment` | ✅ 需要 | 驗庫存、**後端驗證手動優惠券**（有效期/使用次數/啟用狀態/MinOrderAmount，防前端繞過）、**後端自動偵測滿額折抵**（IsAutoApply=true，挑選金額最高且符合門檻的一張）、計算 `finalAmount = 商品小計 + 運費 − 手動折扣 − 自動折抵`、建立訂單（CouponID/DiscountAmount/FinalAmount/ShippingMethod/ShippingFee/ShippingAddress）、分別扣除手動與自動優惠券 UsageCount；依 `shippingMethodCode`：超商取貨加入 `CVSCOM=1, LgsType=C2C`，宅配到府不加 CVSCOM；加密藍新參數，回傳 Gateway URL |
| `payment-notify` | ❌ 關閉 | 藍新背景 webhook：驗簽解密、更新付款狀態、扣庫存、儲存 CVSCOM 回傳的 StoreCode/LgsNo 等物流資訊 |
| `payment-return` | ❌ 關閉 | 藍新前台導回：儲存付款方式、ATM 帳號、CVSCOM 門市資訊，導向 /order-success/:orderNo |
| `retry-payment` | ✅ 需要 | 重新付款：在訂單號加 `_R1/_R2` 後綴、回傳新加密參數 |
| `logistics-notify` | ❌ 關閉 | 藍新物流 NPA-B58 webhook：接收貨態推播、更新 ShippingStatus/ShippingStatusText |
| `store-map` | ✅ 需要 | （舊流程殘留）產生 7-11 門市選擇地圖參數，現已不在結帳流程使用 |
| `store-callback` | ❌ 關閉 | （舊流程殘留）接收門市選擇 postMessage，現已不在結帳流程使用 |

---

## Pinia Stores

| Store | 說明 |
|-------|------|
| `auth.js` | 使用者 session（登入/登出/LINE OAuth）、admin 權限判斷；state 含 `isAdmin`、`isActive`、`permissions`（5 個 Can* 欄位）；getter `canEnterAdmin`（IsActive=true 即可）、`canAccess(perm)`（IsAdmin 或對應權限） |
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
- `C_ORD_OrderList` — 訂單主檔（含付款狀態、配送方式、ATM 帳號、DiscountAmount 折扣金額、FinalAmount 實付金額等）
- `C_ORD_OrderItemList` — 訂單明細

### 系統設定
- `S_SYS_AdminUserList` — 管理員名單（含 IsAdmin、IsActive、5 個 Can* 細項權限欄位）
- `S_SHP_ShippingMethodList` — 配送方式（含 Fee/MethodCode/IsActive）
- `S_PRM_CouponList` — 優惠券主檔
- `S_PAY_PayMethodList` — 付款方式

### 會員等級
- `S_MBR_MemberLevelList` — 會員等級設定（預設：一般會員、VIP 會員）

---

## 第三方整合

| 服務 | 用途 |
|------|------|
| 藍新金流 (NewebPay) MPG | 信用卡、ATM 轉帳付款；CVSCOM=1 讓藍新 MPG 頁面處理超商門市選擇 |
| 藍新物流 (NewebPay Logistics) | 7-11 C2C 超商取貨不付款；藍新自動建立物流單並回傳 LgsNo；NPA-B58 推播貨態 |
| Supabase Auth | Email 登入、LINE OAuth |
| Supabase Storage | 商品圖片/影片存放 |

---

## UI / 樣式

- **色系**：暖米色 (cream/linen) + 金色 (gold) 點綴
- **字型**：標題用 Cormorant Garamond 襯線體、內文用系統字
- **RWD 斷點**：768px / 1024px / 1200px
- **動畫**：hover zoom、shimmer 載入、結帳成功打勾動畫
