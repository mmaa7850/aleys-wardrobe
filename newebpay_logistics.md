# 藍新金流 物流服務 API 參考手冊
文件版本：NDNSv1.0.0｜程式版本號：3.0

---

## 1. 服務說明

| 項目 | C2C 店到店（四大超商） | B2C 大宗寄倉（7-ELEVEN） |
|------|----------------------|------------------------|
| 啟用審核 | 不需要 | 需要 |
| 是否需要測標 | 不需要 | 需要 |
| 列印方式 | 商店直接列印 / Kiosk 列印 | 商店直接列印後黏貼出貨 |
| 寄送地點 | 商店→四大超商門市寄件 | 商店送貨→物流倉庫驗收 |
| 運費 | 從商店預付費用扣款，買家不需繳 | 同左 |
| 退貨 | 退至原寄件門市 | 物流中心宅配退貨 |

**支援超商：**
- C2C：7-ELEVEN、全家、萊爾富、OK mart
- B2C：僅 7-ELEVEN

---

## 2. 串接網址

| 環境 | Base URL |
|------|----------|
| 測試 | `https://ccore.newebpay.com/API/Logistic/` |
| 正式 | `https://core.newebpay.com/API/Logistic/` |

---

## 3. 共用 POST 外層格式

所有 API 均使用帶底線的外層參數 Form POST：

| 參數 | 必填 | 說明 |
|------|------|------|
| `UID_` | V | 商店代號（NWP 商店代號） |
| `EncryptData_` | V | 內層參數 AES 加密後 hex 字串 |
| `HashData_` | V | SHA256 驗證碼 |
| `Version_` | V | 固定 `1.0` |
| `RespondType_` | V | 固定 `JSON` |

**加密方式（與 MPG 相同）：**
```
EncryptData_ = AES-256-CBC-PKCS7( innerParams, HashKey, HashIV ) → hex
HashData_ = SHA256("HashKey=" + HashKey + "&" + EncryptData_ + "&HashIV=" + HashIV).toUpperCase()
```

**內層參數格式：** `key=value&key=value`（不需 URL encode，直接明文字串）

---

## 4. 共用回傳格式

| 參數 | 說明 |
|------|------|
| `Status` | `SUCCESS` 或錯誤代碼 |
| `Message` | 文字說明 |
| `EncryptData` | AES 加密的回傳資料（需解密） |
| `HashData` | 驗證用 |
| `UID` | 商店代號 |
| `Version` | `1.0` |

---

## 5. API 說明

### 5.1 NPA-B51 門市地圖查詢
**URL：** `.../storeMap`

**內層請求參數：**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantOrderNo` | V | 商店訂單編號（英數字底線，30 字元） |
| `LgsType` | V | `B2C` 大宗寄倉 / `C2C` 店到店 |
| `ShipType` | V | `1`=7-ELEVEN / `2`=全家 / `3`=萊爾富 / `4`=OK mart |
| `ReturnURL` | V | 消費者選完門市後返回的網址 |
| `TimeStamp` | V | Unix timestamp（容許誤差 120 秒） |
| `ExtraData` | | 額外資料，原值回傳 |

**回傳（EncryptData 解密後）：**

| 參數 | 說明 |
|------|------|
| `LgsType` | B2C / C2C |
| `ShipType` | 1~4 |
| `MerchantOrderNo` | 商店訂單編號 |
| `StoreName` | 取貨門市名稱 |
| `StoreTel` | 取貨門市電話 |
| `StoreAddr` | 取貨門市地址 |
| `StoreID` | 取貨門市代碼 ⚠️ 全家/OK mart 以電文回傳的 StoreID 為準，非頁面上顯示的 |
| `ExtraData` | 原值回傳 |

---

### 5.2 ⭐ NPA-B52 建立物流寄貨單
**URL：** `.../createShipment`

> 付款成功後呼叫此 API 建立物流訂單

**內層請求參數：**

| 參數 | 必填 | 型態 | 說明 |
|------|------|------|------|
| `MerchantOrderNo` | V | Varchar(30) | 商店訂單編號 |
| `TradeType` | V | Int(1) | `1`=超商取貨付款 / `3`=超商取貨不付款 |
| `UserName` | V | Varchar(20) | 取件人姓名 |
| `UserTel` | V | Varchar(10) | 取件人手機號碼 |
| `UserEmail` | V | Varchar(50) | 取件人電子信箱 |
| `StoreID` | V | Varchar(10) | 取貨門市編號（來自 B51 的回傳） |
| `Amt` | V | Int(10) | 交易金額 |
| `LgsType` | V | Varchar(3) | `B2C` / `C2C` |
| `ShipType` | V | Varchar(15) | `1`=7-11 / `2`=全家 / `3`=萊爾富 / `4`=OK mart |
| `TimeStamp` | V | Varchar(50) | Unix timestamp |
| `NotifyURL` | | Varchar(100) | 取貨完成通知網址 |
| `ItemDesc` | | Varchar(100) | 產品名稱描述 |

**回傳（EncryptData 解密後）：**

| 參數 | 說明 |
|------|------|
| `MerchantID` | 商店代號 |
| `Amt` | 交易金額 |
| `MerchantOrderNo` | 商店訂單編號 |
| `TradeNo` | 藍新交易序號 |
| `LgsType` | B2C / C2C |
| `ShipType` | 1~4 |
| `StoreID` | 取件門市編號 |
| `TradeType` | 1=付款 / 3=不付款 |

---

### 5.3 ⭐ NPA-B53 取得寄件代碼
**URL：** `.../getShipmentNo`

> 未出貨前取得寄件代碼，商店可至超商 Kiosk 列印寄貨單

**內層請求參數：**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantOrderNo` | V | JSON 陣列格式，一次最多 10 筆，例：`["ORDER001","ORDER002"]` |
| `TimeStamp` | V | Unix timestamp |

**回傳（EncryptData 解密後）：**

| 參數 | 說明 |
|------|------|
| `SUCCESS` | JSON 陣列，成功的訂單資訊 |
| `ERROR` | JSON 陣列，失敗的訂單資訊 |

每筆資料包含：

| 欄位 | 說明 |
|------|------|
| `MerchantOrderNo` | 商店訂單編號 |
| `ErrorCode` | `SUCCESS` 或錯誤代碼 |
| `LgsNo` | 寄件代碼（上游商回傳的出貨單序號） |
| `StorePrintNo` | 超商 Kiosk 列印專用代碼 |
| `ShipType` | 1~4 |
| `LgsType` | B2C / C2C |

---

### 5.4 NPA-B54 列印寄貨單
**URL：** `.../printLabel`（限 Form POST 前景送出）

**內層請求參數：**

| 參數 | 必填 | 說明 |
|------|------|------|
| `LgsType` | V | B2C / C2C |
| `ShipType` | V | 1~4 |
| `MerchantOrderNo` | V | JSON 陣列（7-11：18 筆，全家：8 筆，萊爾富/OK mart：18 筆） |
| `TimeStamp` | V | Unix timestamp |

---

### 5.5 NPA-B55 查詢物流寄貨單
**URL：** `.../queryShipment`

**內層請求參數：** `MerchantOrderNo`、`TimeStamp`

**回傳（EncryptData 解密後）包含完整訂單資訊：**

| 欄位 | 說明 |
|------|------|
| `MerchantID` | 商店代號 |
| `LgsType` | B2C / C2C |
| `TradeNo` | 藍新交易序號 |
| `MerchantOrderNo` | 商店訂單編號 |
| `Amt` | 交易金額 |
| `ItemDesc` | 產品描述 |
| `NotifyURL` | 取貨完成通知網址 |
| `LgsNo` | 寄件代碼 |
| `StorePrintNo` | Kiosk 列印代碼 |
| `collectionAmt` | 代收金額 |
| `TradeType` | 1=付款 / 3=不付款 |
| `Type` | 1=一般件 / 3=退貨件 |
| `ShopDate` | 出貨日期 |
| `UserName` / `UserTel` / `UserEmail` | 取件人資訊 |
| `StoreID` / `StoreName` / `ShipType` | 門市資訊 |
| `RetId` | 貨態代碼（見附錄） |
| `RetString` | 貨態說明（見附錄） |

---

### 5.6 NPA-B56 修改物流寄貨單
**URL：** `.../modifyShipment`

> 限**未取號前**、**寄件逾期**、**重選門市**的寄貨單可修改

**內層請求參數：**

| 參數 | 必填 | 說明 |
|------|------|------|
| `MerchantOrderNo` | V | 商店訂單編號 |
| `LgsType` | V | B2C / C2C |
| `ShipType` | V | 1~4 |
| `UserName` | | 取件人姓名 |
| `UserTel` | | 取件人手機 |
| `UserEmail` | | 取件人信箱 |
| `StoreID` | + | 取貨門市編號（重選門市時必填，但不可同時改取件人資料） |
| `TimeStamp` | V | Unix timestamp |

---

### 5.7 NPA-B57 貨態歷程追蹤
**URL：** `.../trace`

**內層請求參數：** `MerchantOrderNo`、`TimeStamp`

**回傳（EncryptData 解密後）：**

| 欄位 | 說明 |
|------|------|
| `LgsType` | B2C / C2C |
| `MerchantOrderNo` | 商店訂單編號 |
| `LgsNo` | 寄件代碼 |
| `TradeType` | 1=付款 / 3=不付款 |
| `ShipType` | 1~4 |
| `History` | JSON 陣列，每筆包含：`RetId`、`RetString`、`EventTime` |

---

### 5.8 ⭐ NPA-B58 物流貨態更新即時通知（Push Notify）

> 藍新主動 POST 到商店設定的 NotifyURL

**接收參數（直接 POST，EncryptData_ 需解密）：**

| 參數 | 說明 |
|------|------|
| `Status` | `SUCCESS` 或錯誤代碼 |
| `Message` | 交易狀態描述 |
| `EncryptData_` | AES 加密的貨態資料 |
| `HashData_` | 驗證碼 |
| `UID_` | 商店代號 |

**EncryptData_ 解密後包含：**

| 欄位 | 說明 |
|------|------|
| `LgsType` | B2C / C2C |
| `MerchantOrderNo` | 商店訂單編號 |
| `LgsNo` | 寄件代碼 |
| `TradeType` | 1=付款 / 3=不付款 |
| `ShipType` | 1~4 |
| `RetId` | 貨態代碼（見附錄） |
| `RetString` | 貨態說明 |
| `EventTime` | 紀錄時間 |

---

## 6. 附錄

### 6.1 ShipType 對照

| 值 | 超商 |
|----|------|
| `1` | 7-ELEVEN |
| `2` | 全家 |
| `3` | 萊爾富 |
| `4` | OK mart |

### 6.2 ⭐ 貨態代碼（RetId）對照表

| RetId | RetString | 分類 |
|-------|-----------|------|
| `0_1` | 訂單未處理 | 待處理 |
| `0_2` | 物流單號已過期，請重新取號 | 待處理 |
| `0_3` | 取消出貨 | 待處理 |
| `1` | 訂單處理中 | 處理中 |
| `2` | 超商已收件 | 運送中 |
| `3` | 已重選門市，等待物流重新出貨 | 運送中 |
| `4` | 商品已進物流中心驗收完成 | 運送中 |
| `11` | 取貨門市關店，請重新選取 | 運送中 |
| `5` | 商品送達取貨門市 | 待取貨 |
| `6` | 買家取貨完成 | 已完成 |
| `-1` | 商品已退回廠商 | 已完成 |
| `-6` | 已申請宅配退貨 | 已完成 |
| `-9` | 物流驗收異常等待回覆 | 已完成 |
| `-2` | 商品送達原寄件（指定退貨）門市 | 退貨/賠償 |
| `-3` | 商品退回物流中心驗收完成 | 退貨/賠償 |
| `-4` | 商品退往物流中心（買家未取） | 退貨/賠償 |
| `-5` | 商品即將退回（買家未取） | 退貨/賠償 |
| `10` | 商品即將退回 | 退貨/賠償 |
| `-7` | 已同意/申請異常判賠 | 退貨/賠償 |
| `12` | 退貨門市關店，請重新選取 | 退貨/賠償 |
| `13` | 商品退往物流中心（賣家未取） | 退貨/賠償 |
| `14` | 請申請宅配退貨 | 退貨/賠償 |
| `-10`/`-11`/`15` | 商品已銷毀/拋棄 | 退貨/賠償 |
| `16` | 請確認匯款帳號 | 退貨/賠償 |

### 6.3 錯誤代碼

| 代碼 | 說明 |
|------|------|
| `SUCCESS` | 成功 |
| `1101` | 新增物流訂單失敗 |
| `1102` | 查無合作商店 |
| `1103` | 已存在相同的商店訂單編號 |
| `1104` | 無啟用對應物流商服務 |
| `1105` | 門市資訊有誤或空白 |
| `1106` | 不允許 IP |
| `1107` | 查無金流訂單資料 |
| `1108` | 系統異常，無法查詢物流訂單資料 |
| `1109` | 查無物流訂單資料 |
| `1110` | 系統異常，無法修改物流訂單資料 |
| `1111` | 該筆物流單狀態已無法修改內容 |
| `1112` | 修改物流單失敗 |
| `1113` | 系統異常，無法查詢物流貨態歷程資料 |
| `1114` | 預付費用餘額不足 |
| `1115` | 取寄貨單號失敗 |
| `1116` | 該交易已建立寄貨單資訊 |
| `2100` | 資料格式錯誤 |
| `2101` | 版本錯誤 |
| `2102` | UID_ 不可為空 |
| `2103` | 超商取貨付款金額限 20,000 元內 |
| `2104` | 超商取貨不付款金額限 20,000 元內 |
| `2105` | 一次最多僅能取得 10 筆寄貨單號 |
| `2106` | 標籤數量超限（7-11/萊爾富/OK mart：18 筆，全家：8 筆） |
| `4101` | IP 限制使用 |
| `4103` | HashData_ 資料檢查不符合 |
| `4104` | 加密資料有誤，請確認 HashKey 與 HashIV |

---

## 7. 標準出貨流程

```
消費者下單選取貨門市（藍新 MPG 頁面 / 商店自行串接 B51）
       ↓
付款成功 → payment-notify 收到通知
       ↓
呼叫 NPA-B52 建立物流寄貨單
  MerchantOrderNo, TradeType=1（付款）/3（不付款）
  UserName, UserTel, UserEmail
  StoreID（來自選門市流程）
  LgsType=C2C, ShipType=1（711）
       ↓
呼叫 NPA-B53 取得寄件代碼（LgsNo / StorePrintNo）
       ↓
出貨：商店將商品送至寄件超商
（或至超商 Kiosk 輸入 StorePrintNo 列印，或呼叫 B54 線上列印）
       ↓
NPA-B58 Push Notify → logistics-notify 接收貨態更新
  RetId 5 = 送達門市
  RetId 6 = 買家取貨完成
```

---

## 8. 前置設定確認

在測試/正式環境使用物流服務前：
1. 登入藍新金流後台 → 商店管理 → 商店資料設定 → **物流設定** → 啟用物流服務，勾選服務型態（C2C/B2C），填入退貨門市資訊
2. 帳務中心 → 預付費用 → 確認預付費用餘額（物流費從此扣款）
3. 測試環境：帳務中心 → 預付費用 → 「模擬存入」模擬儲值
