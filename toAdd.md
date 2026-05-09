# Aley's Wardrobe — 待開發功能清單

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

---

## 🔴 優先（改動小、業務需要）

> 目前 🔴 清單已全部完成，無待辦項目。

---

## 🟡 中優先（功能重要，工程量中等）

### 1. 後台直播代建訂單工具（手動版）

直播結束後，小編在後台統一建立訂單，不依賴 FB API，先跑起來再考慮自動化。

**流程：**
1. 後台建立「直播場次」，設定商品 / 直播價 / 數量上限
2. 小編依留言順序一筆筆輸入（搜尋會員 → 選商品 variant → 填直播價）
3. 全部輸入完後點「分配庫存」，系統按輸入順序 FIFO 分配
4. 超出庫存的自動標為預購
5. 每筆訂單產生付款連結，小編複製後透過 LINE 傳給客人

**待確認：**
- 預購客人是現在付款還是到貨後才付款？（影響訂單狀態設計）

---

### 2. Google Analytics 整合

- 申請 GA4 屬性，取得 Measurement ID
- 在 `.env` 加入 `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`（已預留欄位）
- 追蹤事件：`view_item` / `add_to_cart` / `begin_checkout` / `purchase`
- ⚠️ 後台 sidebar 問題待查明後再繼續

---

### 3. 註冊確認信件優化

現況：Supabase 預設寄件人為 `noreply@mail.supabase.io`，體驗不佳。

選項（擇一）：
- **關閉確認信**：Auth → Email → 關閉 Confirm email（最快）
- **自訂 SMTP**：串接 Resend / SendGrid，從自己 domain 寄信（最完整）

---

### 4. 大戶會員標記（暫緩決策）

**決策方向（已討論）：**
- 優先選擇**方案 A（自動計算）**：不動 DB schema；在會員列表和訂單詳情頁根據累積消費金額顯示「大戶」badge；門檻值存 `S_SYS_Config`（key: `vip_threshold`）
- 若未來需要標記「非大額但重要客人」，再疊加方案 B（手動 `IsVIP` 欄位）
- 方案 C（正式等級制）目前側欄已有「會員等級」入口，可未來擴充

**暫緩原因：** 目前資料量尚小，先觀察業績再決定門檻值。

---

## 🟢 低優先（複雜度高 / 有外部依賴 / 暫緩）

### 5. FB 直播留言自動化

讓客人直播留言「+1 商品 顏色 尺寸」後，系統自動建訂單、分配庫存、發結帳連結。

**技術需求：**
- FB App + `pages_read_engagement`、`pages_messaging` 權限（需 App Review，約 5〜14 工作天）
- 識別方式：用 FB User ID 當客人身份，不需事先綁定會員帳號（參考就醬播做法）
- 結帳連結透過 FB Messenger 自動私訊

**決策待確認：**
- 使用者願不願意等 FB App Review？
- 要用 FB Messenger 通知還是 LINE OA 通知？
- 直播後貼文補單要 API 自動抓取，還是小編手動匯入 CSV？

> 建議先做功能 1（手動代建版）跑起來，FB 自動化在申請期間同步開發。

---

### 6. 分批出貨

單筆訂單中部分商品先到貨、部分延後，需拆分出貨記錄與通知。
需先確認業務需求再設計。

---

### 7. 客戶錢包 / 儲值（暫緩，待會計確認）

**⚠️ 實作前需請會計師確認「儲值不開發票、消費開發票」符合記帳需求。**

**功能範圍：**
- 會員錢包餘額，可抵消費
- 儲值走藍新 MPG，消費發票改用藍新獨立電子發票 API 開立完整金額
- 滿額贈贈點（與實付金額分開記錄）

**DB 設計方向：**
- `C_MBR_WalletList`：錢包餘額
- `C_MBR_WalletTransactionList`：每筆異動 log（topup / bonus / consume / refund）
- 餘額只能透過 edge function 異動（RLS 擋前端直接 UPDATE）
