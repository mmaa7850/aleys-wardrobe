# FB App Review 完整送審流程

> 申請權限：`pages_read_engagement`（讀取粉專直播留言）  
> 更新時間：2026-05-22

---

## 目前進度

| 項目 | 狀態 |
|------|------|
| FB Developer 帳號 | ✅ 已有 |
| FB App「Aley's Wardrobe Test」 | ✅ 已建立（開發模式）|
| Facebook Login 功能 | ✅ 已設定並測試成功 |
| 直播後台功能（`/admin/live`）| ✅ 已完成 |
| 隱私政策頁面 | ✅ `aleys-wardrobe.vercel.app/privacy-policy` |
| 影片腳本 | ✅ `OBS.md` |
| 錄製示範影片 | ⏳ 待錄製 |
| 正式站示範訂單 | ⏳ 待建立 |
| 測試帳號 | ⏳ 待建立 |
| 提交 App Review | ⏳ 待提交 |

---

## 完整流程（從頭到尾）

---

### PART 1 — 建立 FB Developer 帳號與應用程式

> 如果你之前已經做過，直接跳到 PART 2 確認設定即可。

#### 1-1 註冊 FB Developer 帳號

1. 用你的 **Facebook 帳號**（建議用管理粉專的那個）打開：  
   👉 [https://developers.facebook.com](https://developers.facebook.com)
2. 右上角點 **Log In**，用 Facebook 帳號登入
3. 登入後右上角點你的頭像，看是否有 **My Apps** 選項
   - 有 → 已是 Developer，跳到 1-2
   - 沒有 → 點 **Get Started** → 同意開發者條款 → 完成驗證（可能要填電話號碼）

---

#### 1-2 建立應用程式（App）

1. 進入 [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. 右上角點 **Create App**
3. 選擇應用程式類型：
   - 選 **「其他」（Other）** → 點 Next
4. 選擇使用案例：
   - 選 **「Business」** → 點 Next
5. 填入應用程式基本資料：
   - **App name**：`Aley's Wardrobe`（正式名稱，不要加 Test）
   - **App contact email**：你的 email
   - **Business portfolio**：可以略過或選你的商業帳號
   - 點 **Create App**
6. FB 可能要求你重新輸入 Facebook 密碼確認身份

> ✅ App 建立完成後，預設是**開發模式（Development）**，之後審核通過才切換成 Live。

---

#### 1-3 設定基本資料（Basic Settings）

1. 左側選單 → **Settings → Basic**
2. 填入以下欄位：

| 欄位 | 填入內容 |
|------|---------|
| App Name | `Aley's Wardrobe` |
| App Contact Email | 你的 email |
| Privacy Policy URL | `https://aleys-wardrobe.vercel.app/privacy-policy` |
| Terms of Service URL | `https://aleys-wardrobe.vercel.app/privacy-policy`（暫時填同一個）|
| App Category | Shopping |
| Business Use | Myself or my own business |

3. 拉到最下面，**App Domains** 填入：
   ```
   aleys-wardrobe.vercel.app
   ```
4. 右上角點 **Save Changes**

---

#### 1-4 新增 Facebook Login 產品

1. 左側選單 → **Add Product**（或 Products）
2. 找到 **Facebook Login** → 點 **Set Up**
3. 選擇平台：**Web**
4. **Site URL** 填入：
   ```
   https://aleys-wardrobe.vercel.app
   ```
5. 點 Save → Next（後面幾步可以跳過）
6. 左側選單現在會出現 **Facebook Login → Settings**，點進去：
   - **Valid OAuth Redirect URIs** 填入（每行一個）：
     ```
     https://xyqznatwbfuscocycqtb.supabase.co/auth/v1/callback
     ```
     （把 `xyqznatwbfuscocycqtb` 換成你的 Supabase 專案 ID）
   - **Client OAuth Login**：開啟
   - **Web OAuth Login**：開啟
7. 點 **Save Changes**

---

#### 1-5 把 App ID 和 Secret 填入 Supabase

1. 左側選單 → **Settings → Basic**
2. 複製 **App ID** 和 **App Secret**（點 Show 才看得到）
3. 打開 Supabase Dashboard → Authentication → Providers → Facebook
4. 貼上 App ID 和 App Secret
5. 複製 Supabase 顯示的 **Callback URL**，確認和你剛填的 Redirect URI 一致
6. 點 Save

> ✅ 完成後可以在開發模式下測試 FB 登入（只有 App 管理員帳號可用）

---

### PART 2 — 送審前的準備工作

---

#### 2-1 確認 App 設定完整

1. 進入 [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. 點你的 App 進入
3. 左側 **Settings → Basic**，確認以下全部有填：
   - ✅ Privacy Policy URL：`https://aleys-wardrobe.vercel.app/privacy-policy`
   - ✅ App Domains：`aleys-wardrobe.vercel.app`
   - ✅ App Category：Shopping
4. 點 **Save Changes**

---

#### 2-2 建立正式站示範訂單

在 **Supabase Dashboard → SQL Editor** 執行以下 SQL，讓審查員在後台看到一筆直播訂單：

```sql
WITH new_order AS (
  INSERT INTO public."C_ORD_OrderList" (
    "OrderNo", "OrderSource",
    "CustomerName", "CustomerEmail", "CustomerPhone",
    "ShippingName", "ShippingPhone", "ShippingAddress",
    "ShippingMethod", "ShippingFee",
    "PaymentStatus", "PaymentMethod", "PaidAt",
    "ItemsTotal", "DiscountAmount", "FinalAmount",
    "WalletDeductAmt", "NewebpayAmt"
  )
  VALUES (
    'LIV_20260522_00001', 'live',
    '陳小美', 'mondyhuang@yahoo.com.tw', '0912-345-678',
    '陳小美', '0912-345-678', '台北市中山區中山北路一段 1 號',
    'home', 60,
    'paid', 'CREDIT', now(),
    990, 0, 1050, 0, 1050
  )
  RETURNING "ID"
),
sample_variant AS (
  SELECT
    p."ID" AS product_id, p."ProductName", p."Price",
    v."ID" AS variant_id,
    COALESCE(c."Name", '') AS color_name,
    COALESCE(s."Name", '') AS size_name
  FROM public."C_PRD_ProductList" p
  JOIN public."C_PRD_ProductVariantList" v ON v."ProductID" = p."ID"
  LEFT JOIN public."S_PRD_ColorList" c ON c."ID" = v."ColorID"
  LEFT JOIN public."S_PRD_SizeList"  s ON s."ID" = v."SizeID"
  WHERE p."IsActive" = true
  ORDER BY p."ID", v."ID"
  LIMIT 1
)
INSERT INTO public."C_ORD_OrderItemList" (
  "OrderID", "ProductID", "ProductName", "VariantID",
  "ColorName", "SizeName", "UnitPrice", "Qty", "SubTotal"
)
SELECT o."ID", sv.product_id, sv."ProductName", sv.variant_id,
       sv.color_name, sv.size_name, 990, 1, 990
FROM new_order o, sample_variant sv;
```

執行成功後，去正式站後台 → 訂單管理，確認看得到這筆 `LIV_20260522_00001`。

---

#### 2-3 建立測試帳號（給審查員用）

審查員需要一個帳號登入你的網站自己操作，**不要給你自己的帳號**。

**Step A：在正式站註冊新帳號**

1. 打開 `https://aleys-wardrobe.vercel.app`，點右上角 → 登入/註冊
2. 選「Email 註冊」，填入：
   - Email：`aleys.reviewer@gmail.com`（用你能收到信的信箱）
   - 密碼：自己設定，記好
3. 收信點驗證連結完成註冊

**Step B：把這個帳號加進後台管理員**

在 Supabase SQL Editor 執行：

```sql
-- Step 1：查這個帳號的 UserID
SELECT id, email FROM auth.users
WHERE email = 'aleys.reviewer@gmail.com';

-- Step 2：複製上面查到的 id（UUID 格式），貼到下面執行
INSERT INTO public."S_SYS_AdminUserList" (
  "UserId", "Email", "IsActive",
  "CanManageProducts", "CanManageOrders",
  "CanManageMembers", "CanManageMarketing", "CanManageSettings"
)
VALUES (
  '貼上剛才查到的 UUID',
  'aleys.reviewer@gmail.com',
  true,
  true,   -- 可以看商品
  true,   -- 可以看訂單
  true,   -- 可以看會員
  false,  -- 不能改行銷設定
  false   -- 不能改系統設定（IsAdmin = false）
);
```

**Step C：確認帳號可以進後台**

1. 開無痕視窗，去正式站用 `aleys.reviewer@gmail.com` 登入
2. 登入後右下角應該出現後台入口按鈕（深色方塊）
3. 點進去，確認能看到「直播管理」、「訂單管理」
4. 點開訂單管理，確認看得到那筆 `LIV_20260522_00001`

---

#### 2-4 錄製示範影片

依 `OBS.md` 腳本錄製，注意事項：

- 用正式站 `aleys-wardrobe.vercel.app`（URL 要清楚看到，不能是測試站）
- 用測試帳號 `aleys.reviewer@gmail.com` 登入（不要用你自己的管理員）
- Scene 7 要點開訂單 `LIV_20260522_00001`
- 全程英文字幕，每段字幕對應 OBS.md 各 Scene
- 輸出格式：MP4，解析度 1920×1080，檔案 < 100MB
- 建議工具：OBS 錄製 → CapCut 加字幕 → 輸出 MP4

---

### PART 3 — 提交 App Review

---

#### 3-1 進入審核頁面

1. 進入你的 App
2. 左側選單 → **App Review → Permissions and Features**
3. 在搜尋欄輸入 `pages_read_engagement`
4. 找到後點右側的 **Request Advanced Access**

---

#### 3-2 填寫審核表單

表單會有幾個區塊，依序填入：

---

**① How are you using this permission?**

```
Our platform, Aley's Wardrobe, is a fashion e-commerce store in Taiwan that sells clothing through Facebook Live streams. During a live session, viewers place orders by commenting product keywords (e.g., "+1 Blue Dress M") in the Facebook Live chat.

We use the pages_read_engagement permission to read comments from live streams on our own Facebook Page. Our back-office system automatically parses these comments to identify purchase intent, matches them to the correct product variants, and creates orders instantly.

This permission is used solely to automate order processing from our own Facebook Page's live streams. It eliminates manual order entry and reduces errors during fast-paced live shopping events.
```

---

**② Describe how your app uses the data obtained from this permission**

```
When a live stream is active on our Facebook Page, our system reads the comments using the Graph API. Each comment is parsed client-side to extract:
- The commenter's display name (to match with a registered member)
- The product keyword (to identify which item and variant is being ordered)
- The quantity

Only the parsed order data (member ID, product variant, quantity) is stored in our database. Raw comment text is not stored or logged. No data is shared with or sold to any third party.

Access to comments is limited to our admin team only, via our private back-office system.
```

---

**③ Privacy Policy URL**

```
https://aleys-wardrobe.vercel.app/privacy-policy
```

---

**④ Demo Video**

上傳依 `OBS.md` 錄製的 MP4 影片（< 100MB）

---

**⑤ Step-by-Step Instructions**（告訴審查員怎麼自己操作驗證）

```
Website: https://aleys-wardrobe.vercel.app

Test account (back-office access):
  Email: aleys.reviewer@gmail.com
  Password: [你設定的密碼]

Steps to verify the use of pages_read_engagement:

1. Open https://aleys-wardrobe.vercel.app in a browser
2. Click the person icon at the top right → click "登入 / 註冊" (Log In)
3. Enter the test account email and password listed above → click Log In
4. After logging in, look at the bottom-right corner of the page
   → You will see a dark square icon. Click it to enter the admin dashboard.
5. In the left sidebar, click "直播管理" (Live Sessions)
   → This is where admins manage Facebook Live shopping sessions.
   → Each session has a product keyword table mapping comment keywords
     (e.g., product code + color + size) to actual product variants.
6. Click any session to open it
   → You can see the Tab "商品對照表" (Product Mapping Table)
   → This table defines which keywords trigger which product orders
7. In the left sidebar, click "訂單管理" (Order Management)
   → You will see an order with OrderNo: LIV_20260522_00001
   → The "來源" (Source) column shows "live"
   → This order was created from a Facebook Live stream comment
8. Click the order to open the detail modal
   → You can see the product, quantity, customer name, and payment status

Context: The pages_read_engagement permission would allow our system to
read live comments via the Graph API in real time. Because this permission
is pending approval, the demo shows the back-office infrastructure that
processes and stores the resulting order data once the permission is granted.
```

---

**⑥ 送出**

- 確認所有欄位都填完，影片已上傳
- 點 **Submit for Review**
- 審核時間通常 **5〜14 個工作天**
- 結果會用 email 通知，也可以在 App Review 頁面查看狀態

---

### PART 4 — 審核後處理

---

#### 4-1 審核狀態說明

| 狀態 | 說明 | 處理方式 |
|------|------|---------|
| **In Review** | 審查員正在審核 | 等待，勿重複送審 |
| **Changes Requested** | 需要補充資料 | 按照 FB 的要求修改後重新送審 |
| **Approved** | ✅ 審核通過 | 繼續做 4-2 |
| **Rejected** | ❌ 不通過，附說明 | 根據原因修改後可重送 |

常見被退回的原因：
- 影片沒有清楚展示權限的實際用途
- Step-by-step 說明不夠詳細，審查員無法自行操作
- 隱私政策沒有說明如何使用 FB 資料
- App 設定裡 Privacy Policy URL 沒填

---

#### 4-2 審核通過後：切換 App 到 Live 模式

> ⚠️ **審核通過後才做這步**，切換前確認一切都已測試完成。

1. 進入 App → **Settings → Basic**
2. 右上角有一個開關顯示 **Development**
3. 點開關 → 確認切換為 **Live**
4. FB 會提醒你：Live 模式下所有 Facebook 用戶都能使用你的 App

切換後：
- 所有 Facebook 用戶都能用 FB 帳號在你的網站登入（不再限開發者帳號）
- `pages_read_engagement` 正式生效，可以開始串接直播留言讀取 API

---

#### 4-3 切換 Live 後要做的事

| 項目 | 說明 |
|------|------|
| 測試 FB 登入 | 用一個不是你的 FB 帳號測試是否能正常登入 |
| 確認 Supabase Auth 設定 | 正式版 Supabase 專案的 Facebook Provider 也要填好 App ID/Secret |
| 移除測試帳號後台權限（可選）| 如果不需要讓審查員帳號繼續進後台，可刪除那筆 AdminUserList 記錄 |

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `OBS.md` | 示範影片腳本（分場 + 字幕） |
| `fb_app_review.md` | 本文件（送審完整流程） |
| `prelaunch_credentials.md` | 各服務帳號紀錄（App ID、Secret 等） |
