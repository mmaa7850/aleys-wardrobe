# Facebook App Review 總整理

> 更新時間：2026-05-23

---

## 目前 App 架構

| App | App ID | 類型 | 用途 |
|-----|--------|------|------|
| **Aley's Wardrobe**（Consumer）| `1554260969463280` | Consumer | 消費者 FB 登入（Supabase Auth） |
| **Aley's Wardrobe**（Business）| `1460450088945134` | Business | 管理者讀取直播留言（未來功能） |

> **重要**：Supabase Auth 只用 Consumer App 的 ID/Secret。
> Business App 的 Page Access Token 由管理者另外授權取得，不走 Supabase。

---

## App 1：Consumer App（消費者 FB 登入）

**App ID**：`1554260969463280`

### 需要的權限

| 權限 | 狀態 | 說明 |
|------|------|------|
| `email` | ⚠️ 開發模式可用，上線前需審查 | 取得使用者 Email，供建立會員帳號 |
| `public_profile` | ⚠️ 開發模式可用，上線前需審查 | 取得使用者姓名（FbName），供直播留言比對 |

### 上線前需完成

1. **App Review**：送審 `email` + `public_profile`（基本權限，審查相對快）
2. **商家驗證**（Business Verification）：Facebook 要求驗證是合法商業實體
3. **隱私政策**：`https://aleys-wardrobe-test.vercel.app/privacy-policy` ✅ 已有
4. **服務條款**：✅ 已有
5. **App 圖示**：需上傳 1024×1024 圖示
6. **切換 Live 模式**：完成以上後才能讓所有消費者使用 FB 登入

### 目前狀態

- ✅ 開發模式可用（App 管理員可測試登入）
- ✅ Supabase Auth 已更新 App ID/Secret（2026-05-23）
- ✅ FB 登入測試成功（2026-05-23）
- ⚠️ 上線前需 App Review 才能開放所有消費者使用

---

## App 2：Business App（管理者讀取直播留言）

**App ID**：`1460450088945134`

> ⚠️ **此功能尚未開發完成**，等直播即時搶標後台功能完整測試後再送審。

### 需要的權限

| 權限 | 狀態 | 說明 |
|------|------|------|
| `pages_show_list` | ❌ 需 App Review | 列出管理者可管理的粉絲專頁 |
| `pages_read_engagement` | ❌ 需 App Review + 商家驗證 | 讀取粉專直播留言（核心功能） |
| `pages_manage_engagement` | ❌ 需 App Review + 商家驗證 | 代發結標線 / 結標公告到 FB 直播 |
| `business_management` | ❌ 需 App Review + 商家驗證 | Business API 存取 |

### 送審前需準備

1. **直播即時功能完整測試完成**（目前尚未完成）
2. **商家驗證**（Business Verification）
3. **示範影片**（全程英文旁白或字幕，建議 2〜5 分鐘）：

   | 段落 | 內容 | 時長 |
   |------|------|------|
   | 第一段 | 說明業務背景：台灣服飾電商透過 FB 直播銷售，客人留言搶商品 | 30 秒 |
   | 第二段 | 示範購物網站：商品列表、購物車、結帳流程 | 1 分鐘 |
   | 第三段 | 示範直播留言讀取：開測試直播 → 留言 → 後台偵測 → 自動建單 | 2〜3 分鐘 |
   | 第四段 | 說明為何需要 `pages_read_engagement`：沒有此權限無法讀留言 | 30 秒 |

### 送審時機

> 直播即時搶標功能（`live-bid-poll`）**完整測試通過後**再送審。
> 功能尚未上線前送審，FB 可能因無法驗證實際使用情境而拒絕。

---

## 整體送審時程建議

```
現在（開發中）
  ├─ Consumer App：開發模式，只有 App 管理員可測試 FB 登入 ✅
  └─ Business App：尚未開始送審

↓ 正式上線前

  Step 1：Consumer App 送審（email + public_profile）
    準備項目：App 圖示（1024×1024）、商家驗證、隱私政策確認
    預估時程：約 5〜14 工作天

  Step 2：直播功能測試完成後，Business App 送審
    準備項目：商家驗證、示範影片（英文）、說明文件
    申請權限：pages_show_list / pages_read_engagement / pages_manage_engagement
    預估時程：約 5〜14 工作天（pages_read_engagement 較嚴，可能更長）
```

---

## 其他上線前準備（非 FB 相關）

| 項目 | 說明 | 狀態 |
|------|------|------|
| **GA4 Measurement ID — Vercel 正式專案** | 在 Vercel `aleys-wardrobe`（正式版）→ Settings → Environment Variables 新增 `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`，勾 Production + Preview（不需 Development）| ⚠️ 待設定 |
| **GA4 Measurement ID — Vercel 測試專案** | 同上，在 `aleys-wardrobe-test` 也要設定，驗證追蹤碼是否正常收資料 | ⚠️ 待設定 |
| **批次進貨 migration** | 執行 `supabase/migrations/add_purchase_system.sql`（見 toAdd.md） | ⚠️ 待執行 |
| **批次進貨 系統設定** | 後台「系統設定」新增 `shipping_cost_cvscom` / `shipping_cost_home` 兩個 Key | ⚠️ 待設定 |
| **ezPay 切換正式環境** | Supabase Secrets 將 `EZPAY_ENV` 改為 `prod` | ⚠️ 上線時設定 |

---

## 注意事項

| 項目 | 說明 |
|------|------|
| **開發模式限制** | FB 登入只有 App「管理員 / 開發者 / 測試員」可使用，一般消費者無法登入 |
| **加測試員** | Developers → Roles → Testers → 加入帳號，可在上線前讓特定人測試 |
| **隱私政策** | 已有頁面，確認有提到 FB 資料使用方式 ✅ |
| **審查語言** | 送審說明需用英文 |
| **兩 App 不混用** | Consumer App 不加粉專權限；Business App 不用於消費者登入 |
| **App Secret 保管** | Consumer App Secret 存在 Supabase Dashboard，不提交到 Git |
