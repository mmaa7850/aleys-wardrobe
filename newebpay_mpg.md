# 藍新金流 MPG 幕前支付 API 參考手冊
文件版本：NDNF-1.2.2｜程式版本號：2.3

---

## 1. 串接網址

| 環境 | 網址 |
|------|------|
| 測試 | `https://ccore.newebpay.com/MPG/mpg_gateway` |
| 正式 | `https://core.newebpay.com/MPG/mpg_gateway` |

---

## 2. 加密流程

### Step 1：組成 TradeInfo 明文字串
將所有內層參數以 `key=value&key=value` 格式串接（URL encode）。

### Step 2：AES-256-CBC 加密
```
tradeInfo = AES-256-CBC-PKCS7( plaintext, HashKey, HashIV )
結果轉 hex string（小寫）
```

### Step 3：SHA256 產生 TradeSha
```
TradeSha = SHA256( "HashKey=" + HashKey + "&" + tradeInfo + "&HashIV=" + HashIV ).toUpperCase()
```

### Step 4：Form POST 發出
```html
<form method="POST" action="https://ccore.newebpay.com/MPG/mpg_gateway">
  <input name="MerchantID" value="...">
  <input name="TradeInfo"  value="...">   <!-- AES 加密後 hex -->
  <input name="TradeSha"   value="...">   <!-- SHA256 大寫 -->
  <input name="Version"    value="2.3">
</form>
```

---

## 3. 請求參數（POST 外層）

| 參數名稱 | 必填 | 說明 |
|----------|------|------|
| `MerchantID` | V | 商店代號 |
| `TradeInfo` | V | AES 加密後 hex 字串 |
| `TradeSha` | V | SHA256 大寫字串 |
| `Version` | V | 固定 `2.3` |
| `EncryptType` | | `1`=AES/GCM，`0`/不填=AES/CBC（預設） |

---

## 4. TradeInfo 內層參數

### 4.1 基本必填

| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `MerchantID` | String(15) | V | 商店代號 |
| `RespondType` | String(6) | V | `JSON` 或 `String` |
| `TimeStamp` | String(50) | V | Unix timestamp（容許誤差 120 秒） |
| `Version` | String(5) | V | `2.3` |
| `MerchantOrderNo` | String(30) | V | 商店訂單編號（英數字底線，不可重複） |
| `Amt` | Int(10) | V | 訂單金額，純數字，新台幣 |
| `ItemDesc` | String(50) | V | 商品描述，UTF-8，勿用特殊符號 |

### 4.2 選填基本參數

| 參數 | 型態 | 說明 |
|------|------|------|
| `TradeLimit` | Int(3) | 交易有效秒數（60~900，0=不限） |
| `ExpireDate` | String(10) | 非即時支付繳費期限，格式 `Ymd`，預設 7 天，最多 180 天 |
| `ExpireTime` | String(6) | 繳費截止時間（超商代碼/凱基ATM），格式 `His` |
| `ReturnURL` | String(200) | 付款完成後 Form POST 導回商店（僅接受 80/443 port） |
| `NotifyURL` | String(200) | 背景 Notify 通知網址（幕後回傳付款結果） |
| `CustomerURL` | String(200) | 取號完成後 Form POST 通知（非即時支付用） |
| `ClientBackURL` | String(200) | 藍新頁面「返回商店」按鈕目標 |
| `Email` | String(50) | 付款人 Email（交易完成通知用） |
| `EmailModify` | Int(1) | `1`=開放修改（預設），`0`=不可修改 |
| `OrderComment` | String(300) | 商店備註，顯示於 MPG 頁面 |
| `LangType` | String(5) | `zh-tw`（預設）、`en`、`jp` |
| `P3D` | Varchar(5) | `1`=強制 3D 驗證 |

### 4.3 付款方式開關（1=啟用，0/不填=不啟用）

| 參數 | 說明 | 限制 |
|------|------|------|
| `CREDIT` | 信用卡一次付清 | |
| `InstFlag` | 信用卡分期：`1`=全開，或指定 `3,6,12,18,24,30`（閘道商店可加 8 期） | |
| `CreditRed` | 信用卡紅利折抵 | |
| `APPLEPAY` | Apple Pay | |
| `ANDROIDPAY` | Google Pay | |
| `SAMSUNGPAY` | Samsung Pay | |
| `CREDITAE` | 美國運通卡 | |
| `UNIONPAY` | 銀聯卡 | |
| `WEBATM` | 網路 ATM | 上限 49,999，手機裝置不顯示 |
| `VACC` | ATM 轉帳 | 上限 49,999 |
| `CVS` | 超商代碼繳費（付款在超商） | 30 元以上，2 萬元以下 |
| `BARCODE` | 超商條碼繳費 | 20 元以上，4 萬元以下 |
| `LINEPAY` | LINE Pay | |
| `TAIWANPAY` | 台灣 Pay | 上限 49,999 |
| `ESUNWALLET` | 玉山 Wallet | |
| `TWQR` | TWQR/簡單付電子錢包 | |
| `BITOPAY` | BitoPay 加密貨幣 | 100~49,999 元 |
| `AFTEE` | AFTEE 先享後付：`1`=一般，`2`=一般+分期 | 上限 49,999 |

### 4.4 ⭐ 超商取貨物流參數（CVSCOM）

| 參數 | 型態 | 說明 |
|------|------|------|
| `CVSCOM` | Int(1) | **物流啟用開關**（需先在藍新後台啟用物流並設定退貨門市）<br>`1` = 啟用超商取貨**不付款**<br>`2` = 啟用超商取貨**付款**<br>`3` = 兩者皆啟用<br>`0`/不填 = 不啟用<br>⚠️ 金額上限 2 萬元 |
| `LgsType` | String(3) | 物流型態（搭配 CVSCOM 使用）<br>`B2C` = 大宗寄倉（目前僅支援 7-ELEVEN）<br>`C2C` = 店到店（7-ELEVEN、全家、萊爾富、OK mart）<br>不填時：優先 B2C，若未啟用則 C2C |

> **重要：** 設定 CVSCOM 後，藍新 MPG 頁面會自動顯示門市選擇介面，消費者在藍新頁面選門市，不需在商店端另行處理門市選擇。

---

## 5. 回應參數

### 5.1 外層（NotifyURL / ReturnURL 接收）

| 參數 | 說明 |
|------|------|
| `Status` | `SUCCESS` 或錯誤代碼 |
| `MerchantID` | 商店代號 |
| `TradeInfo` | AES 加密的回傳資料（需解密） |
| `TradeSha` | SHA256 驗證碼（驗證用） |
| `Version` | 串接版本 |

**驗證 TradeSha：**
```
SHA256( "HashKey=" + HashKey + "&" + TradeInfo + "&HashIV=" + HashIV ).toUpperCase() === TradeSha
```

### 5.2 TradeInfo 解密後（支付完成）—— 所有方式共同欄位

| 參數 | 說明 |
|------|------|
| `Status` | `SUCCESS` / 錯誤代碼 |
| `Message` | 交易狀態描述 |
| `Result` | JSON 格式時，所有回傳參數在此物件下 |
| `MerchantID` | 商店代號 |
| `Amt` | 交易金額 |
| `TradeNo` | 藍新交易序號 |
| `MerchantOrderNo` | 商店訂單編號 |
| `PaymentType` | 支付方式代碼 |
| `RespondType` | 回傳格式 |
| `PayTime` | 支付完成時間（超商取貨時為空值） |
| `IP` | 付款人 IP |
| `EscrowBank` | 款項保管銀行 |

### 5.3 ⭐ 超商物流回傳參數（使用 CVSCOM 時）

> 適用於 `4.2.2 支付完成` 及 `4.2.3 取號完成`

| 參數 | 型態 | 說明 |
|------|------|------|
| `StoreCode` | String(10) | 取貨門市編號 |
| `StoreName` | String(15) | 取貨門市中文名稱 |
| `StoreType` | String(10) | `[7-ELEVEN]`、`[全家]`、`[萊爾富]`、`[OK mart]` |
| `StoreAddr` | String(100) | 取貨門市地址 |
| `TradeType` | Int(1) | `1`=取貨付款，`3`=取貨不付款 |
| `CVSCOMName` | String(20) | 取貨人姓名 |
| `CVSCOMPhone` | String(10) | 取貨人手機號碼 |
| `LgsNo` | String(20) | 物流寄件單號（即寄件代碼） |
| `LgsType` | String(3) | `B2C` 或 `C2C` |

### 5.4 信用卡回傳參數

| 參數 | 說明 |
|------|------|
| `AuthBank` | 收單機構（Esun/Taishin/CTBC/NCCC/CathayBK/Citibank/UBOT/SKBank/Fubon/FirstBank/LINEBank/SinoPac） |
| `CardBank` | 發卡行 |
| `RespondCode` | 金融機構回應碼 |
| `Auth` | 授權碼 |
| `Card6No` / `Card4No` | 卡號前六/後四碼 |
| `Inst` / `InstFirst` / `InstEach` | 分期期別/首期/每期金額 |
| `ECI` | 3D 回傳值（1,2,5,6 代表 3D 交易） |
| `TokenUseStatus` | 0=一般，1=首次記憶，2=使用記憶，9=取消記憶 |
| `PaymentMethod` | CREDIT/FOREIGN/UNIONPAY/APPLEPAY/GOOGLEPAY/SAMSUNGPAY |

### 5.5 其他支付回傳

| 類型 | 參數 | 說明 |
|------|------|------|
| ATM/WEBATM | `PayBankCode` / `PayerAccount5Code` | 付款行代碼 / 帳號末五碼 |
| 超商代碼 | `CodeNo` / `StoreType` / `StoreID` | 繳費代碼 / 門市類別 / 門市代號 |
| 超商條碼 | `Barcode_1` / `Barcode_2` / `Barcode_3` | 三段條碼 |

---

## 6. 單筆交易查詢 NPA-B02

- 測試：`https://ccore.newebpay.com/API/QueryTradeInfo`
- 正式：`https://core.newebpay.com/API/QueryTradeInfo`

**請求參數（直接 POST，不需 AES，需 CheckValue）：**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantID` | V | 商店代號 |
| `Version` | V | `1.3` |
| `RespondType` | V | `JSON` |
| `CheckValue` | V | 見下方 CheckValue 計算 |
| `TimeStamp` | V | Unix timestamp |
| `MerchantOrderNo` | V | 商店訂單編號 |
| `Amt` | V | 訂單金額 |

**CheckValue 計算：**
```
fields = { Amt, MerchantID, MerchantOrderNo }（按字母排序）
str = "IV=" + HashIV + "&" + "Amt=X&MerchantID=Y&MerchantOrderNo=Z" + "&Key=" + HashKey
CheckValue = SHA256(str).toUpperCase()
```

**回應 `Result` 內：**

| 參數 | 說明 |
|------|------|
| `TradeStatus` | `0`=未付款，`1`=付款成功，`2`=付款失敗，`3`=取消，`6`=退款 |
| `PaymentType` | CREDIT / VACC / WEBATM / CVS / BARCODE / CVSCOM / LINEPAY / AFTEE … |
| `CloseStatus` | 請款狀態 |
| `BackStatus` | 退款狀態 |
| `CreateTime` | 交易建立時間 |
| `AuthBank` | 收單機構（信用卡） |
| `SourceBankId` / `SourceAccountNo` | ATM 付款行代碼/帳號 |

---

## 7. 退款 / 取消授權 API

> **加密方式與 MPG 相同**：`PostData_` = AES-256-CBC → hex（同 `TradeInfo`）。參數名稱改為 `MerchantID_` + `PostData_`（注意結尾底線）。

---

### 7.1 取消授權 NPA-B01（當日授權取消，未請款前）

| 環境 | 網址 |
|------|------|
| 測試 | `https://ccore.newebpay.com/API/CreditCard/Cancel` |
| 正式 | `https://core.newebpay.com/API/CreditCard/Cancel` |

> 適用情境：交易當日、信用卡尚未請款，執行放棄授權。

**POST 外層**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantID_` | V | 商店代號 |
| `PostData_` | V | AES 加密資料 |

**PostData_ 內層**

| 參數 | 必填 | 型態 | 說明 |
|------|------|------|------|
| `RespondType` | V | String(5) | `JSON` 或 `String` |
| `Version` | V | String(5) | `1.0` |
| `TimeStamp` | V | String(30) | Unix timestamp |
| `Amt` | V | Int(10) | 需與授權金額相同 |
| `MerchantOrderNo` | + | String(30) | 與 TradeNo 二擇一 |
| `TradeNo` | + | String(17) | 藍新交易序號，與 MerchantOrderNo 二擇一 |
| `IndexType` | V | Int(1) | `1`=用商店訂單編號，`2`=用藍新交易序號 |

**回應**

| 參數 | 說明 |
|------|------|
| `Status` | `SUCCESS` 或錯誤代碼（`TRA20001`=需批次處理） |
| `Result.MerchantID` | 商店代號 |
| `Result.TradeNo` | 藍新交易序號 |
| `Result.Amt` | 交易金額 |
| `Result.MerchantOrderNo` | 商店訂單編號 |
| `Result.CheckCode` | 驗證碼 |

---

### 7.2 ⭐ 信用卡退款 NPA-B031~34（請款後退款，最常用）

| 環境 | 網址 |
|------|------|
| 測試 | `https://ccore.newebpay.com/API/CreditCard/Close` |
| 正式 | `https://core.newebpay.com/API/CreditCard/Close` |

> **功能對照：**
> - `B031` 請款（CloseType=1）
> - **`B032` 退款（CloseType=2）← 7天鑑賞期退款用此**
> - `B033` 取消請款（CloseType=1, Cancel=1）
> - `B034` 取消退款（CloseType=2, Cancel=1）

**POST 外層**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantID_` | V | 商店代號 |
| `PostData_` | V | AES 加密資料 |

**PostData_ 內層**

| 參數 | 必填 | 型態 | 說明 |
|------|------|------|------|
| `RespondType` | V | String(5) | `JSON` 或 `String` |
| `Version` | V | String(5) | `1.1` |
| `TimeStamp` | V | String(30) | Unix timestamp |
| `Amt` | V | Int(10) | 請退款金額 |
| `MerchantOrderNo` | V | String(30) | 商店訂單編號 |
| `TradeNo` | V | String(20) | 藍新交易序號 |
| `IndexType` | V | Int(1) | `1`=用商店訂單編號，`2`=用藍新交易序號 |
| `CloseType` | V | Int(1) | `1`=請款，`2`=退款 |
| `Cancel` | | Int(1) | `1`=取消（搭配 CloseType 使用，發動 B033/B034） |

> **退款金額限制：**
> - 一次付清（含三大 Pay / 國外卡）：支援**整筆或部分**退款，可多次退款
> - 分期付款 / 紅利折抵：僅支援**整筆**退款
> - 銀聯卡：請款整筆，退款整筆或部分

**回應**

| 參數 | 說明 |
|------|------|
| `Status` | `SUCCESS` 或錯誤代碼 |
| `Result.MerchantID` | 商店代號 |
| `Result.Amt` | 請退款金額 |
| `Result.TradeNo` | 藍新交易序號 |
| `Result.MerchantOrderNo` | 商店訂單編號 |

---

### 7.3 ATM 付款退款

> **藍新無 ATM 退款 API**，需人工匯款至顧客帳戶，並在自己系統標記退款完成。

---

### 7.4 電子錢包退款 NPA-B06（LINE Pay / 台灣 Pay / 玉山 Wallet / TWQR）

| 環境 | 網址 |
|------|------|
| 測試 | `https://ccore.newebpay.com/API/EWallet/refund` |
| 正式 | `https://core.newebpay.com/API/EWallet/refund` |

> 加密格式與 MPG 相同（AES hex），但外層參數名稱不同：`UID_`、`EncryptData_`、`HashData_`。

**退款期限對照：**

| 付款方式 | 退款期限 | 部分退款 |
|----------|----------|----------|
| 玉山 Wallet | 交易後 89 日曆日 | ✅ |
| 台灣 Pay | 交易後 29 日曆日 | ❌（僅全額） |
| LINE Pay | 交易後 60 天 | ✅ |
| TWQR | 請款日起 89 日曆日 | ✅ |

**PostData_ 內層（JSON 格式）**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantOrderNo` | V | 商店訂單編號 |
| `Amount` | V | 退款金額 |
| `TimeStamp` | V | Unix timestamp |
| `PaymentType` | V | `ESUNWALLET` / `LINEPAY` / `TAIWANPAY` / `TWQR` |

---

## 8. 錯誤代碼（常見）

| 代碼 | 說明 |
|------|------|
| MPG01001 系列 | 商店帳號/金流相關錯誤 |
| MPG01028 | 訂單金額不符 |
| MPG01029 | 訂單細項金額加總不等於 Amt |
| MPG01030 | ItemType 格式錯誤 |
| MPG03010/03011 | BitoPay 相關錯誤 |
| MPG05006~09 | 物流相關錯誤 |
| TRA10031 | 相關交易逾時 |
| TRA20028 | 3D 驗證失敗 |

---

## 8. 注意事項

1. 所有付款方式參數皆未指定時，以藍新商店後台設定為準
2. `ReturnURL` 與 `NotifyURL` 不可設同一網址（否則付款完成會通知兩次）
3. 啟用 `AFTEE` 時，`OrderDetail` 為必填（ItemName、ItemAmt、ItemType、ItemOrderNo）
4. 信用卡記憶卡號：`TokenTerm` 對應會員識別（Email 或會員 ID）
5. `CVSCOM` 使用前須先在藍新後台啟用物流服務並設定退貨門市

---

## 9. 完整 CVSCOM 使用流程

```
商店 → 傳送 CREDIT=1 + CVSCOM=2（或3）+ LgsType=C2C 給藍新 MPG
       ↓
藍新 MPG 頁面顯示：
  - 選擇付款方式（信用卡等）
  - 選擇取貨超商（7-11/全家/萊爾富/OK mart）
  - 選擇取貨門市
  - 填入取貨人資訊
       ↓
付款完成 → NotifyURL 收到通知，TradeInfo 解密後包含：
  - StoreCode / StoreName / StoreType / StoreAddr
  - CVSCOMName / CVSCOMPhone
  - LgsNo（寄件代碼，藍新已自動建立物流單）
  - LgsType / TradeType
       ↓
商店後台確認訂單 → 出貨（將商品送至寄件超商）
```

> **與舊流程的差異：** 使用 CVSCOM 後，藍新自動處理門市選擇與物流建單，商店端不需再呼叫 `store-map` / `store-callback`，也不需在付款後手動呼叫 NPA-B52（建立物流寄貨單）。但仍需呼叫 NPA-B53（取得寄件代碼）以便出貨。
