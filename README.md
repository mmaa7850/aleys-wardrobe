# aley's wardrobe — 後台管理系統

Vue 3 + Vite + Supabase 電商後台，支援商品管理、訂單處理、耗材成本追蹤、財務報表。

---

## 技術棧

| 層級 | 技術 |
|---|---|
| 前端框架 | Vue 3 (Composition API / `<script setup>`) |
| 建構工具 | Vite |
| 狀態管理 | Pinia |
| UI | Bootstrap 5 |
| 後端 / DB | Supabase (PostgreSQL + Auth + RLS) |
| 部署 | Vercel |
| 國際化 | vue-i18n |

---

## 環境設定

### 環境變數（`.env`）

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DB_SCHEMA=public          # 正式區用 public；測試區用 staging
```

> ⚠️ `VITE_*` 為 build-time 變數，Vercel 上修改後需重新部署才生效。

### 兩個 Supabase 專案

| 環境 | Schema | Vercel 專案 |
|---|---|---|
| 正式區（Production） | `public` | aleys-wardrobe（main branch）|
| 測試區（Staging） | `staging` | aleys-wardrobe-staging |

---

## 啟動開發

```bash
npm install
npm run dev
```

---

## 資料庫 Migration

所有 migration 檔位於 `supabase/migrations/`，需手動至 Supabase SQL Editor 執行。

| 檔案 | 說明 |
|---|---|
| `add_purchase_system.sql` | 商品進貨單系統 |
| `add_product_live_code.sql` | 商品直播碼 |
| `add_member_level_spending.sql` | 會員等級累積消費 |
| `fix_cron_and_cart_preorder.sql` | Cron job 修正、購物車預購邏輯 |
| `add_consumables_system.sql` | 耗材管理 + 月度費用系統 |

> 每支 SQL 內分為 `public`（正式）與 `staging`（測試）兩區，請依環境擇一執行。

---

## 主要功能模組

### 庫存管理
- **商品管理**：規格、成本、庫存、直播碼
- **進貨單**：新增進貨 → 確認後自動更新商品加權平均成本與庫存
- **耗材品項**：包材、贈品等非販售耗材（分類：包材 / 贈品 / 其他）
- **耗材進貨**：耗材採購記錄，確認後更新耗材加權平均成本與庫存

### 訂單管理
- 訂單列表、詳情、狀態流轉
- 標記出貨（宅配物流單號）、記錄實際運費成本
- **耗材用量**：出貨時選擇用了哪些包材/贈品，記錄進訂單成本
- 退換貨額外成本記錄
- 電子發票（藍新 API）：開立、作廢、折讓
- 退款（藍新 API 信用卡退款 / 手動標記）

### 財務管理
- **費用分類**：自訂月度費用類別（租金、水電費、設備…）
- **月度費用**：按年月記錄固定/非固定營運費用

### 報表
- **訂單收支報表**：依已付款訂單列出商品售價、顧客運費、折價券、實收、金流手續費、實際物流、耗材、其他額外成本與淨收；不讀取商品進貨成本

### 其他
- 會員管理、會員等級、錢包（購物金）
- 直播場次、直播留言出單
- 系統設定（運費成本、金物流設定）

---

## 成本架構

```
訂單毛利
  = 營收
  − 商品進貨成本（加權平均）
  − 金流手續費（信用卡 1.5% 或 DB 實際值）
  − 出貨運費成本
  − 耗材成本（包材 / 贈品，出貨時逐筆記錄）
  − 退換貨額外費用

賣場月度淨利
  = 該月訂單毛利合計
  − 月度固定費用（租金、水電、設備…）
```

---

## 權限設計

| 函數 | 說明 |
|---|---|
| `is_staff()` | 登入且為有效管理員（`C_*` / 一般操作表） |
| `is_admin()` | 登入且為超級管理員（`S_*` / 設定表） |

RLS Policy 搭配 Table-level GRANT，兩者缺一不可。
