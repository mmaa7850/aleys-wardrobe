# ezPay 電子發票 API 串接手冊

> 文件版本：EZP_INVI_1.2.2（2024/4/22）
> 適用功能：開立、作廢、折讓、作廢折讓、查詢發票

---

## 環境網址

| 環境 | 說明 |
|------|------|
| 測試 | `https://cinv.ezpay.com.tw` |
| 正式 | `https://inv.ezpay.com.tw` |

---

## 通用規則

### 傳送方式
- HTTP POST（標準 Form Post）
- 編碼：UTF-8
- 回應：Web Service

### Post 外層參數（每支 API 共用）

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantID_` | ✅ | 商店代號（Varchar 15）|
| `PostData_` | ✅ | AES-256-CBC 加密後的資料（見加密方法）|

> 注意：`MerchantID_` 與 `PostData_` 後方都有底線 `_`。

### PostData_ 內共用欄位

| 參數 | 必填 | 說明 |
|------|------|------|
| `RespondType` | ✅ | 回傳格式：`JSON` 或 `String` |
| `Version` | ✅ | 各 API 版本（見各章說明）|
| `TimeStamp` | ✅ | Unix timestamp（秒）|

---

## 加密方法（PostData_）

演算法：**AES-256-CBC**，輸出為 **hex 字串（小寫）**

- Key：商店 Hash Key（32 bytes）
- IV：商店 Hash IV（16 bytes）
- Padding：PKCS#7，block size = 32

### PHP 範例（7+）
```php
function addpadding($string, $blocksize = 32) {
    $pad = $blocksize - (strlen($string) % $blocksize);
    return $string . str_repeat(chr($pad), $pad);
}

$post_data_str = http_build_query($post_data_array);
$post_data = trim(bin2hex(openssl_encrypt(
    addpadding($post_data_str),
    'AES-256-CBC',
    $key,
    OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING,
    $iv
)));
```

### .NET C# 範例
```csharp
var aes = new RijndaelManaged();
aes.Key = Encoding.UTF8.GetBytes(hashKey);  // 32 bytes
aes.IV  = Encoding.UTF8.GetBytes(hashIV);   // 16 bytes
aes.Mode    = CipherMode.CBC;
aes.Padding = PaddingMode.None;
// 先手動加 PKCS#7 padding（block 32），再 CreateEncryptor
// 輸出轉 hex 小寫
```

---

## CheckCode 產生規則

用於驗證回傳資料合法性。

**步驟：**
1. 取出 5 個欄位：`InvoiceTransNo`、`MerchantID`、`MerchantOrderNo`、`RandomNum`、`TotalAmt`
2. 按英文字母 A~Z 排序後，用 `&` 串聯
3. 前後加上 `HashIV=...&` 和 `&HashKey=...`
4. SHA256 壓碼後轉**大寫**

**範例：**
```
HashIV=1234567891234567&InvoiceTransNo=xxx&MerchantID=xxx&MerchantOrderNo=xxx&RandomNum=xxx&TotalAmt=xxx&HashKey=abcdefghijklmnopqrstuvwxyzabcdef
→ SHA256 → 大寫
```

---

## 一、開立發票

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/invoice_issue` |
| 正式 | `https://inv.ezpay.com.tw/Api/invoice_issue` |

**Version = `1.5`**

### 開立方式（Status）
| 值 | 說明 |
|----|------|
| `1` | 即時開立 |
| `0` | 等待觸發（暫存，需另呼叫觸發 API）|
| `3` | 預約自動開立（需填 `CreateStatusTime`）|

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.5` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `TransNum` | | Varchar(20) | ezPay 簡單付交易序號（使用金流服務時填）|
| `MerchantOrderNo` | ✅ | Varchar(20) | 商店自訂編號（英數字底線，同商店不可重複）|
| `Status` | ✅ | Varchar(1) | 開立方式：1/0/3 |
| `CreateStatusTime` | | Date | 預計開立日（Status=3 時必填，格式 YYYY-MM-DD）|
| `Category` | ✅ | Varchar(5) | `B2B`（營業人）/ `B2C`（個人）|
| `BuyerName` | ✅ | Varchar(60/30) | B2B 最多 60 字；B2C 最多 30 字（可填會員編號）|
| `BuyerUBN` | | Varchar(8) | 買受人統一編號（B2B 必填，純數字）|
| `BuyerAddress` | | Varchar(100) | 買受人地址 |
| `BuyerEmail` | | Varchar(50) | 買受人 Email（CarrierType=2 時必填）|
| `CarrierType` | | Varchar(2) | 載具類別（B2C 才用）：`0`=手機條碼 / `1`=自然人憑證 / `2`=ezPay 載具 |
| `CarrierNum` | | Varchar(50) | 載具號碼（CarrierType 有值時必填，需 rawurlencode）|
| `LoveCode` | | Int(7) | 捐贈碼（3~7 碼純數字，B2C 才用，與 CarrierType 互斥）|
| `PrintFlag` | ✅ | Varchar(1) | `Y`=索取紙本 / `N`=不索取（B2B 必填 Y；B2C 無載具無捐贈必填 Y）|
| `KioskPrintFlag` | | Varchar(1) | `1`=中獎後開放超商 Kiosk 列印（CarrierType=2 才用）|
| `TaxType` | ✅ | Varchar(2) | `1`=應稅 / `2`=零稅率 / `3`=免稅 / `9`=混合（B2C）|
| `TaxRate` | ✅ | Float(6,4) | 應稅填 `5`（或特種稅率）；零稅率/免稅填 `0` |
| `CustomsClearance` | | Varchar(1) | 零稅率時填：`1`=非經海關 / `2`=經海關 |
| `Amt` | ✅ | Int(10) | 銷售額合計（未稅）|
| `AmtSales` | | Int(10) | TaxType=9 時，應稅銷售額 |
| `AmtZero` | | Int(10) | TaxType=9 時，零稅率銷售額 |
| `AmtFree` | | Int(10) | TaxType=9 時，免稅銷售額 |
| `TaxAmt` | ✅ | Int(10) | 稅額 |
| `TotalAmt` | ✅ | Int(10) | 發票總金額（含稅，= Amt + TaxAmt）|
| `ItemName` | ✅ | Varchar(30) | 商品名稱，多項用 `|` 分隔 |
| `ItemCount` | ✅ | Int(5) | 商品數量，多項用 `|` 分隔（純數字）|
| `ItemUnit` | ✅ | Varchar(2) | 商品單位，多項用 `|` 分隔（中文 2 字或英數 6 字）|
| `ItemPrice` | ✅ | Int(10) | 商品單價，多項用 `|` 分隔（B2B 未稅；B2C 含稅）|
| `ItemAmt` | ✅ | Int(10) | 商品小計（數量×單價），多項用 `|` 分隔 |
| `ItemTaxType` | | Int(2) | TaxType=9 時各商品課稅別，多項用 `|` 分隔（1/2/3）|
| `Comment` | | Varchar(200) | 發票備註 |

### 回應（JSON）

```json
{
  "Status": "SUCCESS",
  "Message": "電子發票開立成功",
  "Result": {
    "MerchantID": "商店代號",
    "InvoiceTransNo": "ezPay 發票開立序號",
    "MerchantOrderNo": "自訂編號",
    "TotalAmt": 500,
    "InvoiceNumber": "發票號碼（Status=1 立即開立才回傳）",
    "RandomNum": "4 碼防偽隨機碼",
    "CreateTime": "2014-09-25 12:12:12",
    "CheckCode": "SHA256 驗證碼",
    "BarCode": "條碼（PrintFlag=Y 才回傳）",
    "QRcodeL": "左側 QRCode（PrintFlag=Y 才回傳）",
    "QRcodeR": "右側 QRCode（PrintFlag=Y 才回傳）"
  }
}
```

> String 格式回傳時，結尾會多一個 `EndStr=##`。

---

## 二、觸發開立發票

適用於 Status=0（等待觸發）或 Status=3（預約）的發票。

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/invoice_touch_issue` |
| 正式 | `https://inv.ezpay.com.tw/Api/invoice_touch_issue` |

**Version = `1.0`**

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.0` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `TransNum` | | Varchar(20) | ezPay 簡單付交易序號 |
| `InvoiceTransNo` | ✅ | Varchar(20) | 開立時取得的 ezPay 發票開立序號 |
| `MerchantOrderNo` | ✅ | Varchar(20) | 商店自訂編號 |
| `TotalAmt` | ✅ | Int(10) | 發票金額 |

### 回應（JSON Result 欄位）

`MerchantID`、`InvoiceTransNo`、`MerchantOrderNo`、`TotalAmt`、`InvoiceNumber`、`RandomNum`、`CreateTime`、`CheckCode`

---

## 三、作廢發票

> 限制：奇數月 14 日前，可作廢前兩個月開立的發票（例：7/14 前可作廢 5~6 月）

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/invoice_invalid` |
| 正式 | `https://inv.ezpay.com.tw/Api/invoice_invalid` |

**Version = `1.0`**

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.0` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `InvoiceNumber` | ✅ | Varchar(10) | 欲作廢的發票號碼 |
| `InvalidReason` | ✅ | Varchar(6) | 作廢原因（中文 6 字 / 英文 20 字）|

### 回應（JSON Result 欄位）

`MerchantID`、`InvoiceNumber`、`CreateTime`（作廢時間）、`CheckCode`

---

## 四、開立折讓

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/allowance_issue` |
| 正式 | `https://inv.ezpay.com.tw/Api/allowance_issue` |

**Version = `1.3`**

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.3` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `InvoiceNo` | ✅ | Varchar(10) | 原發票號碼 |
| `MerchantOrderNo` | ✅ | Varchar(20) | 原發票的自訂編號 |
| `ItemName` | ✅ | Varchar(30) | 折讓商品名稱，多項用 `|` 分隔 |
| `ItemCount` | ✅ | Int(5) | 折讓商品數量，多項用 `|` 分隔 |
| `ItemUnit` | ✅ | Varchar(2) | 折讓商品單位，多項用 `|` 分隔 |
| `ItemPrice` | ✅ | Int(10) | 折讓商品單價，多項用 `|` 分隔（含稅時 ItemTaxAmt=0）|
| `ItemAmt` | ✅ | Int(10) | 折讓商品小計，多項用 `|` 分隔 |
| `ItemTaxAmt` | ✅ | Int(10) | 折讓商品稅額，多項用 `|` 分隔（含稅單價時填 0）|
| `TaxTypeForMixed` | | Int(2) | TaxType=9 混合時：`1`=應稅 / `2`=零稅率 / `3`=免稅 |
| `TotalAmt` | ✅ | Int(10) | 折讓總金額 |
| `BuyerEmail` | | Varchar(50) | 買受人 Email |
| `Status` | ✅ | Varchar(1) | `0`=開立後不立即確認 / `1`=立即確認 |

### 回應（JSON Result 欄位）

`MerchantID`、`AllowanceNo`（折讓號）、`InvoiceNumber`、`MerchantOrderNo`、`AllowanceAmt`、`RemainAmt`（確認後發票剩餘金額）、`CheckCode`

---

## 五、觸發確認或取消折讓

適用於 Status=0 的折讓（未立即確認）。

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/allowance_touch_issue` |
| 正式 | `https://inv.ezpay.com.tw/Api/allowance_touch_issue` |

**Version = `1.0`**

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.0` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `AllowanceStatus` | ✅ | Varchar(1) | `C`=確認折讓 / `D`=取消折讓 |
| `AllowanceNo` | ✅ | Varchar(20) | 折讓號 |
| `MerchantOrderNo` | ✅ | Varchar(20) | 原發票自訂編號 |
| `TotalAmt` | ✅ | Int(10) | 折讓總金額 |

> 已確認的折讓**無法**再取消。

---

## 六、作廢折讓

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/allowanceInvalid` |
| 正式 | `https://inv.ezpay.com.tw/Api/allowanceInvalid` |

**Version = `1.0`**

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.0` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `AllowanceNo` | ✅ | Varchar(25) | 欲作廢的折讓號 |
| `InvalidReason` | ✅ | Varchar(6) | 作廢原因（中文 6 字 / 英文 20 字）|

### 回應（JSON Result 欄位）

`MerchantID`、`AllowanceNo`、`CreateTime`（作廢時間）、`CheckCode`

---

## 七、查詢發票

### API 端點
| 環境 | URL |
|------|-----|
| 測試 | `https://cinv.ezpay.com.tw/Api/invoice_search` |
| 正式 | `https://inv.ezpay.com.tw/Api/invoice_search` |

**Version = `1.3`**

### 請求參數（PostData_ 內）

| 參數 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `RespondType` | ✅ | Varchar(5) | JSON / String |
| `Version` | ✅ | Varchar(5) | 固定 `1.3` |
| `TimeStamp` | ✅ | Varchar(30) | Unix timestamp |
| `SearchType` | | Varchar(1) | `0`=發票號碼+隨機碼查詢（預設）/ `1`=訂單編號+金額查詢 |
| `MerchantOrderNo` | ✅ | Varchar(20) | 訂單編號 |
| `TotalAmt` | ✅ | Varchar(10) | 發票金額 |
| `InvoiceNumber` | ✅ | Varchar(10) | 發票號碼（SearchType=0）|
| `RandomNum` | ✅ | Varchar(4) | 4 碼防偽隨機碼（SearchType=0）|
| `DisplayFlag` | | Varchar(1) | `1`=ezPay 網頁顯示查詢結果 / `2`=回傳查詢結果網址 / 不填=回傳參數 |

### 回應（JSON Result 欄位）

| 欄位 | 說明 |
|------|------|
| `InvoiceTransNo` | ezPay 發票開立序號 |
| `MerchantOrderNo` | 自訂編號 |
| `InvoiceNumber` | 發票號碼 |
| `RandomNum` | 4 碼防偽隨機碼 |
| `BuyerName` / `BuyerUBN` / `BuyerEmail` | 買受人資訊 |
| `InvoiceType` | `07`=一般稅額 / `08`=特種稅額 |
| `Category` | B2B / B2C |
| `TaxType` | 課稅別（1/2/3/9）|
| `TaxRate` | 稅率（e.g. 0.05）|
| `Amt` / `TaxAmt` / `TotalAmt` | 銷售額 / 稅額 / 總金額 |
| `CarrierType` / `CarrierNum` | 載具資訊 |
| `LoveCode` | 捐贈碼 |
| `PrintFlag` / `KioskPrintFlag` | 紙本 / Kiosk 列印旗標 |
| `CreateTime` | 開立時間 |
| `ItemDetail` | 商品明細（JSON 格式）|
| `InvoiceStatus` | `1`=已開立 / `2`=已作廢 |
| `UploadStatus` | `0`=未上傳 / `1`=已上傳 / `2`=上傳中 / `3`=失敗 / `4`=逾時 |
| `BarCode` / `QRcodeL` / `QRcodeR` | 條碼資訊（PrintFlag=Y 才有）|
| `CheckCode` | 驗證碼 |

---

## 錯誤代碼

### KEY 系列（加密/傳送錯誤）

| 代碼 | 說明 |
|------|------|
| KEY10002 | 資料解密錯誤 |
| KEY10004 | 資料不齊全 |
| KEY10006 | 商店未申請啟用電子發票 |
| KEY10007 | 頁面停留超過 30 分鐘 |
| KEY10010 | 商店代號空白 |
| KEY10011 | PostData_ 欄位空白 |
| KEY10012 | 資料傳遞錯誤 |
| KEY10013 | 資料空白 |
| KEY10014 | TimeOut |
| KEY10015 | 發票金額格式錯誤 |

### INV 系列（發票業務錯誤）

| 代碼 | 說明 |
|------|------|
| INV10003 | 商品資訊格式錯誤或缺少資料 |
| INV10004 | 商品小計計算錯誤 |
| INV10006 | 稅率格式錯誤 |
| INV10012 | 發票金額、課稅別驗證錯誤 |
| INV10013 | 發票欄位資料不齊全或格式錯誤 |
| INV10014 | 自訂編號格式錯誤 |
| INV10015 | 無未稅金額 |
| INV10016 | 無稅金 |
| INV10017 | 版本不支援混合稅率功能 |
| INV10019 | 資料含有控制碼 |
| INV10020 | 暫停使用 |
| INV10021 | 異常終止 |
| INV20006 | 查無發票資料 |
| INV70001 | 欄位資料格式錯誤 |
| INV70002 | 上傳失敗之發票不得作廢 |
| INV90005 | 未簽定合約或合約已到期 |
| INV90006 | 可開立張數已用罄 |

### LIB 系列（業務限制錯誤）

| 代碼 | 說明 |
|------|------|
| LIB10003 | 商店自訂編號重覆 |
| LIB10005 | 發票已作廢過 |
| LIB10007 | 無法作廢（已執行過折讓）|
| LIB10008 | 超過可作廢期限 |
| LIB10009 | 發票已開立但未上傳財政部，無法作廢 |

### IAI 系列（作廢折讓錯誤）

| 代碼 | 說明 |
|------|------|
| IAI10001 | 缺少參數 |
| IAI10002 | 查詢失敗 |
| IAI10003 | 更新失敗 |
| IAI10004 | 參數錯誤 |
| IAI10005 | 新增失敗 |
| IAI10006 | 異常終止 |

### 其他

| 代碼 | 說明 |
|------|------|
| NOR10001 | 網路連線異常 |

---

## 重要注意事項

### 金額計算規則
- 商品小計 = 商品數量 × 商品單價
- 發票金額 = 銷售額 + 稅額
- 折讓總金額 = 折讓商品小計 + 折讓商品稅額
- **務必與財會人員確認計算方式**

### 發票上傳財政部時程
- 每日 **01:00** 上傳前一日 00:00~23:59 的開立/作廢/折讓資料
- 每日 **06:00** 更新上傳狀態

### 作廢發票期限
- 奇數月 14 日前，可作廢前兩個月開立的發票
- 例：7/14 前可作廢 5/1~6/30 開立的發票

### 載具規則（CarrierNum 格式）
- **手機條碼**：第 1 碼為 `/`，後 7 碼為英數字（限大寫，字元限 `0-9A-Z+-`.）
- **自然人憑證**：2 碼大寫英字 + 14 碼數字
- **ezPay 載具**：自訂識別碼（e-mail / 手機 / 會員編號），需 `rawurlencode()`，值前後不得有空白

### 折讓注意事項
- Status=0（不立即確認）：折讓暫存本平台，需另外呼叫觸發確認 API
- Status=1（立即確認）：隔日自動上傳財政部
- 已確認的折讓無法取消，只能作廢

### B2C 發票法規要求
依財政部規定，開立 B2C 發票時，營業人需在購物網站提供以下選項供買受人選擇：
1. 手機條碼載具
2. 自然人憑證條碼載具
3. ezPay 電子發票載具（會員載具）
4. 捐贈發票（填捐贈碼）
5. 索取紙本電子發票
