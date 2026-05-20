# Aley's Wardrobe — 待開發功能清單

> 更新時間：2026-05-20（下午）

---

## 🚀 正式上線前：帳號 & 憑證切換清單

> 目前所有第三方服務均使用**開發測試帳號**，正式上線前必須換成使用者自己的帳號。

### 需要切換的服務

| 服務 | 設定位置 | 狀態 | 需要什麼 |
|------|----------|------|----------|
| **藍新金流 MPG** | Vercel 環境變數 | ⚠️ 待切換 | 商店代號、Hash Key、Hash IV、`RespondURL`/`NotifyURL` 改正式網址 |
| **藍新物流** | Vercel 環境變數 | ⚠️ 待切換 | 物流商店代號、Hash Key、Hash IV |
| **Supabase 專案** | Vercel 環境變數 + Edge Function Secrets | ⚠️ 待切換 | 已確認上線時需新建正式環境 Supabase 專案（目前 `xyqznatwbfuscocycqtb` 為 staging 用）。上線前需：新建 prod 專案、遷移 schema / RLS、重新設定所有 Edge Function Secrets（LINE、藍新、ezPay）、更新 Vercel 環境變數（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`），同時更新 LINE Developers Webhook URL |
| **Facebook OAuth** | Supabase Dashboard → Auth → Providers → Facebook | ✅ 測試成功（2026-05-20）。⚠️ 上線前需切換正式模式 | 目前 App「Aley's Wardrobe Test」為開發模式，只有 App 擁有者可用 FB 登入。正式上線前需在 FB Developer 將 App 切換為 Live 模式（需通過 App Review） |
| **LINE OA 浮動按鈕** | 後台系統設定 → `line_oa_url` | ✅ 測試成功（2026-05-20）。⚠️ 上線前需在正式後台重新設定 | 測試帳號「Aley's Test」已設定，前台按鈕正常顯示。正式上線時需在 public schema 後台填入正式 LINE OA 連結（staging 和 public 是不同的 S_SYS_Config） |
| **Google Analytics 4** | Vercel 環境變數 `VITE_GA_MEASUREMENT_ID` | ⚠️ 待切換 | 使用者申請自己的 GA4 屬性，取得 `G-XXXXXXXXXX` |
| **ezPay 電子發票** | Supabase Edge Function Secrets + ezPay 商家後台 | ✅ Secrets 已填入，字軌已申請完成 | 正式上線前將 `EZPAY_ENV` 從 `test` 改為 `prod` |
| **Vercel 部署** | Vercel 專案設定 | ⚠️ 待確認 | 正式網域綁定（目前用 vercel.app 預設網址） |

### 額外要在後台設定的（不是環境變數）

| 設定 | 位置 | 說明 |
|------|------|------|
| 公告文字 | 後台 → 系統設定 → `announcement` | 上線時可設定開幕公告 |
| LINE OA 網址 | 後台 → 系統設定 → `line_oa_url` | 右下角浮動按鈕 |
| GA Looker Studio | 後台 → 系統設定 → `ga_looker_studio_url` | 報表頁嵌入連結（選填） |
| 付款方式名稱 | 後台 → 付款方式設定 | 確認顯示名稱符合正式環境 |
| 配送方式與運費 | 後台 → 配送方式設定 | 確認費用正確 |
| 管理員帳號 | 後台 → 管理者帳號 | 確認正式帳號都有設定權限 |
| LINE OA 網址（正式） | 後台 → 系統設定 → `line_oa_url` | 正式上線時填入正式 LINE OA 的加入好友連結（格式：`https://lin.ee/XXXXXXX`） |

### 未來可能需要
| 服務 | 狀態 | 說明 |
|------|------|------|
| **Resend / SendGrid（SMTP）** | ❌ 尚未決定 | 訂單通知信、發票通知信用；需先決定是否要做 Email 通知 |
| **FB App Review（直播留言權限）** | ⏳ 待申請（直播功能做好後送審） | `pages_read_engagement` 權限，讀取粉專直播留言；需先完成直播後台功能 + 隱私政策頁面 + 錄示範影片再送審 |

---

## 📋 FB App Review 示範影片規劃

> 送審 `pages_read_engagement`（直播留言讀取）時需附上的示範影片。
> **送審時機：** 直播代建訂單後台功能完成後。

### 影片內容（建議 2〜5 分鐘）

**第一段：說明業務背景（30 秒）**
- 用旁白或字幕說明：這是一個台灣服飾電商，透過 Facebook 直播銷售商品
- 客人在直播留言商品關鍵字（例如「+1 A001 黑色 M」）下單
- 系統需要即時讀取留言並自動建立訂單

**第二段：示範購物網站（1 分鐘）**
- 打開官網，展示商品列表、購物車、結帳流程
- 說明這是官網，客人平時在這裡購物

**第三段：示範直播留言讀取流程（2〜3 分鐘）**
- 在 FB 粉專開一個測試直播（不公開）
- 用測試帳號在直播留言「+1 商品關鍵字」
- 打開後台系統，顯示留言被讀取進來
- 系統根據關鍵字比對商品，自動建立訂單
- 顯示訂單建立成功的畫面

**第四段：說明為什麼需要這個權限（30 秒）**
- `pages_read_engagement`：讀取粉專直播底下的留言
- 沒有這個權限，系統就無法自動讀取留言建單

### 注意事項
- 影片要全程英文旁白或英文字幕（FB Review 是英文審核）
- 需要準備好隱私政策頁面（Privacy Policy）的網址
- 可以是測試環境的示範，不一定要正式上線的功能

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
- **錢包系統**：儲值（走藍新 MPG）、自動開立 ezPay 發票（⚠️ 待 ezPay 電子發票加值服務開通後完整測試）、錢包餘額折抵結帳（全額/部分）、混合付款（錢包+藍新）、全錢包免走藍新、退款退回錢包、手動調整餘額（後台）、RLS 政策；新增 DB 表：C_MBR_WalletList / C_MBR_WalletTxList / C_MBR_WalletTopupList；C_ORD_OrderList 新增 WalletDeductAmt / NewebpayAmt 欄位；新增 4 個 Edge Functions：wallet-topup / wallet-topup-notify / wallet-topup-return / wallet-adjust；前台 /wallet 頁面；後台 /admin/wallet 頁面；會員中心快捷入口
- **購物車操作限制**：非預購商品（IsPreOrder=false）不顯示刪除按鈕，且數量 ± 控制鍵鎖定（disabled），包含現貨、直播自動入單、小編手動入單；只有預購商品可刪除與調整數量
- **買衣服付款後自動開發票**：`payment-notify` 付款成功後自動呼叫 ezPay 開立發票；支援所有載具類型；NewebpayAmt=0（全錢包）跳過 ⚠️ 待測試
- **退款入錢包**：新增 `wallet-refund` Edge Function；後台訂單 Modal 新增「退款入錢包」操作區塊；全額退款（FinalAmount − ShippingFee）或部分退款（指定金額）；退款後入會員錢包，不走藍新退款 API，不作廢發票 ⚠️ 待測試
- **庫存扣除時機調整**：改為加入購物車時立即扣庫存（`decrement_stock` RPC，FOR UPDATE 原子性）；增加數量扣差量、減少數量還差量；DB 寫入失敗自動回補；`create-payment` 移除結帳前庫存檢查；`payment-notify` 移除付款後庫存扣除；migration：`cart_stock_functions.sql`（`public` + `staging` schema）
- **FB 帳號登入（Facebook OAuth）**：登入頁「以 Facebook 繼續」按鈕移至 Tab 上方（登入/註冊共用）；FB OAuth 回調（`/auth/callback`）整合；首次 FB 登入自動建立 `C_MBR_MemberList` 最小記錄（upsert by UserID）；`FbName`（`user.user_metadata.full_name`）自動存入會員資料，供直播留言比對 ✅ 測試成功（2026-05-20）
- **直播代建訂單工具**：後台直播場次管理（`/admin/live`）+ 場次詳情（`/admin/live/:id`）；商品對照表（代碼/顏色/尺寸 → VariantID + 直播特價）；FB 留言文字貼入 → 客戶端解析（見解析規則）→ 預覽確認 → `live-import` Edge Function 批次建單（比對 FbName 取會員資料 + 預設地址、扣庫存、建 `LIV_YYYYMMDD_XXXXX` 訂單）→ 有 LINE 綁定自動推播付款連結，無綁定列入「待手動通知名單」 ✅ 已完成（2026-05-20）⚠️ 待測試
- **LINE OA 帳號綁定系統**：消費者加入 LINE OA → `line-webhook` 收 Follow 事件 → 產生一次性 UUID Token（存 `LineBindToken` 表）→ LINE Push 傳送綁定連結 → 消費者點連結到 `/bind-line?token=xxx` → 未登入跳 `/login`（redirect 存 localStorage）→ FB 登入完成回 `/auth/callback` → 讀 localStorage 跳回 `/bind-line` → `line-bind` 驗證 token → upsert `LineUserID` 至 `C_MBR_MemberList`；AccountView 顯示 LINE 綁定狀態（已綁定 / 尚未綁定）；封鎖 LINE OA → 清除 `LineUserID` ✅ 測試成功（2026-05-20）

---

## ⚠️ 已開發，待測試 / 待上線

### 直播代建訂單工具

**程式已完成，需要測試驗證。**（DB migration `add_live_tables.sql` ✅ 已執行 2026-05-20）

**待測試項目：**

| # | 測試項目 | 預期結果 |
|---|---------|---------|
| 1 | 貼上正常留言，解析後預覽正確 | 名字+商品+數量都對應正確 |
| 2 | 貼上含 `作者` 小編回覆，回覆不被解析 | 小編回覆的商品行不出現在預覽 |
| 3 | 同一留言有兩筆商品 → 整個跳過 | 黃色警告顯示被跳過的留言 |
| 4 | 倒序處理：舊留言先扣庫存 | 庫存不足時，新留言被略過 |
| 5 | 同人同代碼留兩次 → ⚠️ 重複標記 | 預覽表格標黃 ⚠️ 重複 |
| 6 | 無法匹配 FbName 的留言 → no_member | 建單結果顯示「找不到會員」 |
| 7 | 庫存不足 → no_stock | 建單結果顯示「庫存不足」 |
| 8 | 成功建單 + 有 LINE 綁定 → LINE Push | 客人收到付款連結 |
| 9 | 成功建單 + 無 LINE 綁定 → 手動通知名單 | 頁面顯示待手動通知清單 |

---

### 電子發票（ezPay）+ 退款入錢包 + 購物車限制

**程式已完成，需要測試驗證。**

**已實作範圍：**
- 結帳頁發票偏好選擇（5 種：紙本 / 手機條碼 / 自然人憑證 / 捐贈愛心碼 / 公司戶統編），存入訂單
- `payment-notify`：買衣服付款成功後**自動開立 ezPay 發票**（NewebpayAmt > 0 時）；全錢包付款自動跳過
- `wallet-topup-notify`：儲值付款成功後**自動開立 ezPay 發票** ✅ 已測試（AA00000002）
- 後台訂單 Modal「電子發票」卡片：顯示狀態/號碼/隨機碼；可手動補開 / 作廢 / 折讓（`issue-invoice`）
- 後台訂單 Modal「退款入錢包」卡片：全額退款（FinalAmount − ShippingFee）或部分退款，退款入會員錢包（`wallet-refund`）
- 購物車操作：僅 IsPreOrder=true 可刪除 / 調整數量，現貨 / 直播入單 / 小編手動入單兩者皆不顯示 / 鎖定

**上線前需完成的步驟：**

1. **執行 migration**（如尚未執行）
   ```
   supabase/migrations/add_invoice_fields.sql
   supabase/migrations/add_invoice_preference_fields.sql
   supabase/migrations/cart_stock_functions.sql
   ```

2. **ezPay Secrets 已設定**（EZPAY_MERCHANT_ID / EZPAY_HASH_KEY / EZPAY_HASH_IV / EZPAY_ENV）

3. **切換正式環境前**：將 `EZPAY_ENV` 從 `test` 改為 `prod`

**待測試項目（⚠️ 請依序確認）：**

| # | 測試項目 | 如何測試 | 預期結果 |
|---|---------|---------|---------|
| 1 | **買衣服付款後自動開發票** | 下一筆刷卡訂單付款成功後，查 `C_ORD_OrderList.InvoiceStatus` | `issued`，InvoiceNumber 有值 |
| 2 | **消費者收到發票 email** | 同上，看會員信箱 | ezPay 寄出發票通知信 |
| 3 | **手機條碼載具** | 結帳填手機條碼（格式 `/XXXXXXX`），付款後查訂單 | InvoiceNumber 有值，發票綁到手機條碼 |
| 4 | **公司戶三聯式** | 結帳填統編+公司名，付款後查 | Category=B2B，InvoiceNumber 有值 |
| 5 | **全錢包付款不開訂單發票** | 全額使用錢包付款，查 `C_ORD_OrderList.InvoiceStatus` | 仍為 `none`（發票在儲值時已開） |
| 6 | **後台手動補開發票** | 後台訂單 Modal → 開立發票按鈕 | InvoiceNumber 正確顯示 |
| 7 | **後台作廢發票** | 後台訂單 Modal → 作廢發票 | InvoiceStatus → `voided` |
| 8 | **後台開立折讓** | 後台訂單 Modal → 開立折讓，填金額 | InvoiceStatus → `allowance`，AllowanceNo 有值 |
| 9 | **全額退款入錢包** | 後台訂單 Modal → 全額退款入錢包 | 會員錢包增加 FinalAmount−ShippingFee；TxType=refund 紀錄寫入 |
| 10 | **部分退款入錢包** | 後台訂單 Modal → 部分退款，填金額 | 會員錢包增加指定金額；訂單 AdminNote 更新 |
| 11 | **購物車操作限制** | 前台購物車：現貨商品無刪除按鈕、± 按鈕 disabled；預購商品兩者皆可操作 | 符合預期 |

**已解決的問題：**

> ✅ **Q3：退款 + 發票操作流程** — 已決定：退款入錢包（不作廢發票），發票與退款分開處理
> ✅ **Q4：退款金流** — 已決定：退款存入會員錢包，不走藍新退款 API
> ✅ **Q2：發票格式** — 已實作，結帳頁有完整偏好選擇

**待確認的問題：**

> ❓ **Q5：退款後庫存要不要回補？**
> 目前退款入錢包後，已扣的庫存**不會自動加回來**。
> → 退回的商品是否要重新上架？還是直接報損？（影響是否需要自動回補庫存）

---

## 🔴 優先（改動小、業務需要）

> 目前 🔴 清單已全部完成，無待辦項目。

---

## 🟡 中優先（功能重要，工程量中等）

### 1. 後台直播代建訂單工具（FB 留言貼文匯入版）✅ 已完成（2026-05-20）

**適用時機：直播結束後的 24 小時限時 FB 貼文**

直播結束後會開一篇限時 24 小時的 FB 貼文，讓沒在現場的客人可以用直播當下的價格購買。貼文關閉後，小編複製 FB 貼文底下的留言文字，貼到後台匯入工具，系統自動解析並批次建單。

**與直播即時自動化的區別：**
- 直播**當下**搶商品 → 需要 FB API 即時捕捉（見 🟢 第 6 項）
- 直播**結束後** 24 小時貼文留言 → 本工具，小編複製貼文文字，不需要 FB API

**已確認的業務規則：**
- **一則留言 = 一個商品 = 一筆訂單**（同一人可留多則，各自建單）
- 重複留同款 → 顯示 ⚠️ 警告，讓小編確認
- 庫存不足 → 略過，不建單，不轉預購（❌）

**已確認的流程：**
```
直播結束 → 開 24 小時限時 FB 貼文
  → 客人在貼文留言購買（格式：姓名 + 商品代碼顏色尺寸+數量）
  → 貼文關閉後，小編複製全部留言文字
  → 貼到後台「直播留言匯入」頁面 → 系統解析
  → 預覽解析結果（標示 ⚠️ 警告：重複留言、未對應商品）
  → 確認後批次建單
      ├─ 該 variant 還有庫存 → 建立訂單，扣庫存
      └─ 該 variant 庫存已耗盡 → 略過，不建單（❌ 不轉預購）
  → 建單成功的客人批次透過 LINE 傳送付款連結
  → 建單失敗（庫存不足）的客人：產生「未成功名單」供小編手動通知
```

> **範例：** Red/S 庫存 30 件，留言共 40 筆 Red/S
> → 前 30 筆建立訂單 ✅
> → 後 10 筆略過，列入未成功名單 ❌（顯示姓名、電話、商品，供小編手動聯絡）

**留言格式（一則留言一款）：**
```
楊筱婷
Y77藍L+1
```

**解析邏輯（客戶端，`LiveSessionDetail.vue`）：**

1. **雜訊過濾**：`頭號粉絲`、時間戳（`5天`、`3小時`）、空行；看到 `作者` 標記 → 跳過（小編回覆開頭），同時跳過下一行（品牌名）
2. **分組為 Block**：每個留言人名為一個 block，以下的商品行收進該 block
3. **倒序處理**（⚠️ 重要）：複製貼上為新到舊，倒序後舊留言（先留者）優先扣庫存
4. **一則留言只能有一筆商品**：block 內商品行 > 1 → 整個 block 跳過，在預覽區顯示黃色警告清單，小編手動通知客人重新補留
5. **商品行格式**：`/^([A-Za-z]+\d+)([一-鿿]+)([A-Za-z]+)\+(\d+)$/`（代碼+中文顏色+英文尺寸+數量）
6. **跨留言重複偵測**：同一人同代碼留了多次 → ⚠️ 標記，讓小編確認

**直播前需建立直播活動與商品對應表：**
- 每場直播前，後台新建「直播活動」並填入商品對照：
  `代碼 + 顏色 + 尺寸 → VariantID + 直播特價`
- 此表存於新 table `S_LIV_KeywordList`

---

#### FB User ID 對應官網帳號的問題 ✅ 已有解法

**✅ 已確認：官網要加入 FB 登入 / 帳號綁定**
> 1. 直接用 FB 帳號 Email 在官網註冊/登入（FB OAuth）
> 2. 已有 Email 帳號的會員，可在會員中心「綁定 FB 帳號」
>
> FB User ID 存入現有的 `C_MBR_MemberSocialList`（Platform=`facebook`, SocialUserID=FB_User_ID），與 LINE OAuth 完全相同的模式，**不需改 schema**。

**這解決了什麼：**
- 客人在官網用 FB 登入或綁定後，`C_MBR_MemberSocialList` 就有他的 FB User ID
- Phase 2（FB API 自動化）捕捉到直播留言的 FB User ID，可直接查這張表找到官網會員
- 不再需要靠電話當橋梁（雖然電話比對仍作為 fallback）

**兩階段解法（更新版）：**

**階段一：CSV 手動版（現在要做）**
- 小編手動整理 CSV，沒有 FB User ID，主要靠電話比對：
  ```
  客人留言 → 客人私訊姓名/電話/地址
    → 小編整理 CSV（含電話欄位）
    → 上傳 CSV
    → 系統用「電話」比對 C_MBR_MemberList
        ├─ 找到 → 訂單綁定到該會員
        └─ 找不到 → 建訪客記錄存入 C_LIV_CustomerList
  ```

**階段二：FB API 自動化（未來）**
- 客人留言被 FB API 捕捉（含 FB User ID）
- **優先查詢** `C_MBR_MemberSocialList` WHERE Platform='facebook' AND SocialUserID=`[FB User ID]`
  - 找到 → 直接綁定到該官網會員，建單
  - 找不到 → 查 `C_LIV_CustomerList` 有沒有舊紀錄（電話橋接）
    - 有 → 用該紀錄建單
    - 沒有（全新客人）→ Bot 自動私訊請客人留電話/地址
      → 存入 `C_LIV_CustomerList`，再用電話嘗試比對官網會員

**⚠️ 前置作業：需先完成 FB OAuth 功能（見 🟡 第 2 項）**
FB API 自動化依賴 `C_MBR_MemberSocialList` 有 FB User ID 資料，因此官網的 FB 登入 / 綁定功能需要先上線，讓客人在直播前就綁好帳號。

**需要新增的 DB Table：**

```
C_LIV_CustomerList        -- 直播客人主檔（FB身份橋梁）
──────────────────────────────────────────
ID              bigint
FBUserID        varchar    -- FB User ID（nullable，手動版不需要）
Name            varchar    -- 客人姓名
Phone           varchar    -- 電話（比對官網會員用）
Address         text       -- 預設地址
MemberID        bigint     -- 對應官網會員（nullable）
CreatedDate     timestamptz

S_LIV_KeywordList         -- 直播關鍵字對照表（每場直播前設定）
──────────────────────────────────────────
ID              bigint
SessionID       bigint     -- 所屬直播場次
Keyword         varchar    -- 客人留言的關鍵字
ProductID       bigint
VariantID       bigint     -- 對應商品規格（顏色+尺寸）
LivePrice       bigint     -- 直播特價

C_LIV_SessionList         -- 直播場次
──────────────────────────────────────────
ID              bigint
Title           varchar    -- 場次名稱
LiveDate        timestamptz
Status          varchar    -- planned / active / closed
CreatedDate     timestamptz
```

**需使用者確認的問題：**

> ❓ **Q1：預購客人的付款時機？**
> 選項 A：現在就付款（到貨前先付，訂單狀態維持「待出貨」）
> 選項 B：到貨後才付款（訂單保持「待付款」，到貨再傳付款連結）
> → 這會影響訂單狀態設計，**需要確認後才能動工**。

> ❓ **Q2：直播訂單要不要記錄「原價 vs 直播特價」差額？**
> 目前 CSV 的直播價會直接存入 `UnitPrice`，原始商品售價不會留記錄。
> → 這樣可以嗎？還是需要知道每場直播折了多少？

> ❓ **Q3：直播訂單要開電子發票嗎？**
> 直播價通常和官網售價不同，發票金額以直播成交價為準。
> → 若要開發票，直播代建訂單也需要接 ezPay，等電子發票測試完再一起做。

> ❓ **Q4：先做 CSV 手動版，還是直接做 FB API 自動版？**
> 建議先做 CSV 版（`C_LIV_CustomerList.FBUserID` 欄位留著但 nullable），
> 日後 FB 自動化時直接填入，不用改 schema。

---

### 2. FB 帳號登入 / 綁定（FB OAuth）✅ 已完成（2026-05-20）

**測試成功，目前使用開發模式 App「Aley's Wardrobe Test」運作。**

**已完成的範圍：**
- 登入頁「以 Facebook 繼續」按鈕（移至 Tab 上方，登入/註冊共用）
- FB OAuth 回調（`/auth/callback`）自動 upsert 會員資料 + 擷取 `FbName`
- `FbName` 存入 `C_MBR_MemberList.FbName`（供直播留言比對）
- AccountView 顯示 LINE 綁定狀態

**上線前需確認：**
- 目前 FB App 為**開發模式**，只有 App 擁有者帳號可使用 FB 登入
- 正式上線前需在 FB Developer 將 App 切換為 **Live 模式**（需通過 App Review）
- 若直播自動化需要 `pages_read_engagement`，可用同一個 App 一起申請審核

---

### 3. Google Analytics 整合

- 申請 GA4 屬性，取得 Measurement ID
- 在 `.env` 加入 `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`（已預留欄位）
- 追蹤事件：`view_item` / `add_to_cart` / `begin_checkout` / `purchase`

**需使用者確認的問題：**

> ❓ **Q1：GA4 屬性申請了嗎？**
> 有 Measurement ID（G-XXXXXXXXXX）就可以馬上串接，程式端已預留好了。

> ❓ **Q2：後台 sidebar 問題**
> 之前提到後台 sidebar 有問題待查明，這個問題解決了嗎？
> （GA4 報表頁 `/admin/reports/analytics` 已建立，但 sidebar 連結需確認正常）

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

## 🟢 低優先（複雜度高 / 有外部依賴 / 暫緩）

### 6. FB 直播即時留言自動化（直播當下）

**適用時機：直播進行中，客人即時留言搶商品**

直播當下客人在直播間留言搶商品，系統即時捕捉留言、確認庫存，得標後透過 LINE 通知客人並傳送付款連結。

**與 24 小時貼文 CSV 工具的區別：**
- 直播**當下**即時留言搶購 → 本功能，需要 FB API
- 直播**結束後** 24 小時貼文留言 → CSV 工具（🟡 第 1 項），不需 FB API

**確認的流程：**
```
直播進行中
  → 客人留言關鍵字搶商品
  → FB API 即時捕捉留言（含 FB User ID）
  → 系統查庫存 + 依 FIFO 分配
      ├─ 搶到 → LINE OA 通知得標 + 傳付款連結
      └─ 沒搶到 → 庫存不足，不通知（或通知已售完）
```

**技術需求：**
- FB App + `pages_read_engagement` 權限（需 App Review，約 5〜14 工作天）
- ✅ 通知管道：LINE OA（不用 FB Messenger）
- FB User ID ↔ 官網帳號對應：透過 `C_MBR_MemberSocialList`（需先完成 🟡 第 2 項 FB OAuth）

**需使用者確認的問題：**

> ❓ **Q1：願意等 FB App Review（5〜14 工作天）嗎？**
> 建議先把 🟡 第 1 項（CSV 工具）跑起來，FB 自動化在申請期間同步開發。
> 注意：FB OAuth 登入（🟡 第 2 項）和 `pages_read_engagement` 是**同一個 FB App**，可以一起申請。

> ❓ **Q2：直播當下沒搶到的客人，要不要通知「已售完」？**
> 還是靜悄悄就好，讓他去 24 小時貼文繼續搶？

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

