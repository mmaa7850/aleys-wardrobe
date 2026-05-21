# FB App Review 影片腳本

**用途：** `pages_read_engagement` 權限審核影片  
**建議總長：** 約 2 分鐘  
**格式：** 螢幕錄影 + 英文字幕文字覆蓋（不需要旁白）

## 錄製工具

| 項目 | 建議 |
|------|------|
| 解析度 | 1920×1080 |
| 錄製工具 | OBS（免費）或 Loom |
| 字幕工具 | CapCut（免費，可直接加文字）|
| 字幕字體 | 白色、有黑色陰影，放畫面下方 |
| 字幕時間 | 每段字幕配合對應 Scene 出現 |

---

## 分場腳本

### Scene 1 — 介紹網站（10 秒）

**操作：** 打開 `https://aleys-wardrobe.vercel.app`，讓首頁完整載入，緩慢往下捲一點

**字幕：**
```
Aley's Wardrobe is a fashion e-commerce platform
that supports live-stream shopping on Facebook.
```

---

### Scene 2 — 進入後台（8 秒）

**操作：** 在網址列輸入 `/admin` 進入後台，停在 Dashboard 畫面

**字幕：**
```
Store admins manage live sessions
through the back-office dashboard.
```

---

### Scene 3 — 進入直播管理列表（8 秒）

**操作：** 點左側選單「直播管理」，顯示直播場次列表

**字幕：**
```
Each Facebook Live session is recorded here.
Admins can create and manage live shopping sessions.
```

---

### Scene 4 — 開啟一場直播（10 秒）

**操作：** 點進其中一場直播，顯示直播場次詳細頁面

**字幕：**
```
Inside a live session, admins can see
all products available for purchase during the stream.
```

---

### Scene 5 — 說明留言下單機制（12 秒）

**操作：** 停在該頁面，滾動讓畫面看起來有內容（商品清單區域）

**字幕：**
```
During the live stream, viewers place orders
by commenting keywords in the Facebook Live chat.

Example comment: "+1 Blue Dress M"
```

---

### Scene 6 — 說明 API 用途（12 秒）⭐ 最關鍵

**操作：** 停在同一頁面，把滑鼠移到直播商品清單區域

**字幕：**
```
With the "pages_read_engagement" permission,
our system automatically reads comments
from the Facebook Live stream managed by this page.

Comments are parsed to identify purchase intent
and orders are created instantly.
```

---

### Scene 7 — 展示訂單建立結果（12 秒）

**操作：** 點左側選單「訂單管理」，顯示訂單列表，點開一筆 OrderSource = live 的訂單

**字幕：**
```
Orders created from live stream comments
are automatically recorded in the order management system.

Order source is labeled as "Live".
```

---

### Scene 8 — 說明資料用途與隱私（10 秒）

**操作：** 在網址列打開 `https://aleys-wardrobe.vercel.app/privacy-policy`

**字幕：**
```
Only comments from the admin's own Facebook Page
are accessed. No personal data is shared or sold.

Full privacy policy: aleys-wardrobe.vercel.app/privacy-policy
```

---

### Scene 9 — 結尾（8 秒）

**操作：** 回到首頁

**字幕：**
```
pages_read_engagement is used solely to automate
live-stream order processing on the admin's own Facebook Page.

Thank you for reviewing.
```

---

## 注意事項

- Scene 5、6 是最關鍵的，FB 審查員要看的就是「這個權限被用來做什麼」
- 因為 `pages_read_engagement` 尚未通過審核，影片展示現有後台操作流程，並用字幕說明 API 自動化的部分
- 字幕需全程英文
