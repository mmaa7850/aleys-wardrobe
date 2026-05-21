<template>
  <div class="info-page">
    <div class="info-container">

      <h1 class="info-title">隱私權政策</h1>
      <p class="info-subtitle">Privacy Policy</p>
      <p class="info-updated">最後更新：2026 年 5 月</p>

      <p class="info-intro">
        Aley's Wardrobe（以下簡稱「本網站」）非常重視您的隱私權。本政策說明我們如何蒐集、使用及保護您的個人資料。
        使用本網站即表示您同意本政策之內容。
      </p>

      <!-- 1 -->
      <section class="info-section">
        <h2 class="info-section-title">一、蒐集的資料類型</h2>
        <p>當您使用本網站時，我們可能蒐集以下資料：</p>
        <ul class="info-list">
          <li><strong>帳號資料：</strong>電子郵件地址、姓名、電話號碼、性別、生日。</li>
          <li><strong>Facebook 資料：</strong>當您使用「以 Facebook 繼續」登入時，我們會取得您的 Facebook 顯示名稱（Display Name）及 Facebook 帳號識別碼，用以建立或關聯您在本網站的會員帳號。</li>
          <li><strong>Facebook 直播留言：</strong>若您透過 Facebook 直播留言參與購物，我們的系統會讀取您在本網站管理之粉絲專頁直播底下的留言，以自動識別您的購買意願並建立訂單。此功能使用 Facebook Graph API 的 <code>pages_read_engagement</code> 權限，且僅限本網站經營者所管理之粉絲專頁。</li>
          <li><strong>LINE 資料：</strong>若您選擇綁定 LINE 帳號，我們會儲存您的 LINE User ID，用於傳送訂單通知及付款連結。</li>
          <li><strong>交易資料：</strong>訂單內容、付款狀態、配送地址、發票資訊。</li>
          <li><strong>瀏覽資料：</strong>IP 位址、裝置類型、瀏覽器版本（由 Supabase 及 Vercel 自動記錄）。</li>
        </ul>
      </section>

      <!-- 2 -->
      <section class="info-section">
        <h2 class="info-section-title">二、資料的使用目的</h2>
        <ul class="info-list">
          <li>建立及管理您的會員帳號。</li>
          <li>處理訂單、付款及配送。</li>
          <li>透過 LINE 傳送訂單確認及付款連結通知。</li>
          <li>識別 Facebook 直播留言中的購買意願，自動建立訂單（需您主動在直播中留言下單）。</li>
          <li>開立電子發票（透過 ezPay 電子發票加值服務）。</li>
          <li>改善網站功能與使用者體驗。</li>
          <li>遵循法律義務。</li>
        </ul>
      </section>

      <!-- 3 -->
      <section class="info-section">
        <h2 class="info-section-title">三、Facebook 資料使用說明</h2>
        <p>本網站使用 Facebook 提供的以下功能：</p>
        <ul class="info-list">
          <li>
            <strong>Facebook 登入（Facebook Login）：</strong>
            我們僅取得您的公開顯示名稱及帳號識別碼，用於建立本網站帳號。我們不會存取您的 Facebook 好友清單、私訊或其他個人貼文。
          </li>
          <li>
            <strong>粉絲專頁留言讀取（pages_read_engagement）：</strong>
            此權限僅用於讀取本網站經營者所管理之 Facebook 粉絲專頁直播底下的公開留言，目的是讓系統自動識別留言中的購買指令並建立訂單，以提升直播購物效率。我們不會讀取您在其他粉絲專頁或個人動態的任何資料。
          </li>
        </ul>
        <p>
          您可隨時前往 <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener">Facebook 應用程式設定</a>
          解除本網站對您 Facebook 帳號的授權。
        </p>
      </section>

      <!-- 4 -->
      <section class="info-section">
        <h2 class="info-section-title">四、資料分享與第三方服務</h2>
        <p>我們不會出售您的個人資料。我們使用以下第三方服務處理部分業務，這些服務擁有各自的隱私政策：</p>
        <ul class="info-list">
          <li><strong>Supabase</strong>：資料庫、身份驗證及後端服務。</li>
          <li><strong>Vercel</strong>：網站託管服務。</li>
          <li><strong>藍新金流（NewebPay）</strong>：線上付款處理。</li>
          <li><strong>ezPay</strong>：電子發票開立服務。</li>
          <li><strong>LINE</strong>：訂單通知推播服務。</li>
          <li><strong>Facebook</strong>：帳號登入及直播留言讀取。</li>
          <li><strong>Google Analytics</strong>：網站流量分析（匿名統計）。</li>
        </ul>
        <p>
          若法律要求或為保護本網站合法權益，我們可能依法提供資料予主管機關。
        </p>
      </section>

      <!-- 5 -->
      <section class="info-section">
        <h2 class="info-section-title">五、資料安全</h2>
        <p>
          我們採用業界標準的安全措施保護您的個人資料，包括 HTTPS 加密傳輸、資料庫存取控制（Row Level Security）及服務金鑰管理。
          付款相關資料由藍新金流處理，本網站不儲存完整信用卡資料。
        </p>
      </section>

      <!-- 6 -->
      <section class="info-section">
        <h2 class="info-section-title">六、Cookie 使用</h2>
        <p>
          本網站使用 Cookie 及瀏覽器本地儲存（LocalStorage）維持您的登入狀態及購物車資料。
          您可透過瀏覽器設定拒絕 Cookie，但部分功能可能因此無法正常運作。
        </p>
      </section>

      <!-- 7 -->
      <section class="info-section">
        <h2 class="info-section-title">七、您的權利</h2>
        <p>依據中華民國個人資料保護法，您擁有以下權利：</p>
        <ul class="info-list">
          <li>查詢或閱覽您的個人資料。</li>
          <li>請求補充或更正您的個人資料。</li>
          <li>請求停止蒐集、處理或利用您的個人資料。</li>
          <li>請求刪除您的個人資料。</li>
        </ul>
        <p>如需行使上述權利，請透過下方聯絡方式與我們聯繫。</p>
      </section>

      <!-- 8 -->
      <section class="info-section">
        <h2 class="info-section-title">八、未成年人</h2>
        <p>
          本網站不刻意蒐集 13 歲以下兒童的個人資料。若您為未成年人，請在家長或監護人同意下使用本網站。
        </p>
      </section>

      <!-- 9 -->
      <section class="info-section">
        <h2 class="info-section-title">九、政策更新</h2>
        <p>
          本隱私政策可能因業務調整或法規變動而更新。更新後將於本頁面公告，並修改頁面頂端的「最後更新」日期。
          重大變更將另行通知。繼續使用本網站即表示您接受更新後的政策。
        </p>
      </section>

      <!-- 10 -->
      <section class="info-section">
        <h2 class="info-section-title">十、聯絡我們</h2>
        <p>
          若您對本隱私政策有任何疑問，或需行使您的個人資料權利，請透過以下方式聯繫：
        </p>
        <ul class="info-list">
          <li>電子郵件：<a href="mailto:contact@aleys-wardrobe.com">contact@aleys-wardrobe.com</a></li>
          <li>Instagram：<a href="https://www.instagram.com/aleys.wardrobe" target="_blank" rel="noopener">@aleys.wardrobe</a></li>
        </ul>
      </section>

    </div>
  </div>
</template>

<style scoped>
.info-page {
  background: var(--fe-cream, #faf7f4);
  min-height: 60vh;
  padding: 48px 16px 80px;
}

.info-container {
  max-width: 760px;
  margin: 0 auto;
}

.info-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2rem;
  color: #3d2e1e;
  margin-bottom: 4px;
}

.info-subtitle {
  font-size: 0.85rem;
  color: #a08060;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.info-updated {
  font-size: 0.8rem;
  color: #b8a090;
  margin-bottom: 32px;
}

.info-intro {
  font-size: 0.95rem;
  color: #5a4535;
  line-height: 1.8;
  margin-bottom: 36px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e8ddd0;
}

.info-section {
  margin-bottom: 36px;
}

.info-section-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #3d2e1e;
  margin-bottom: 12px;
}

.info-section p {
  font-size: 0.9rem;
  color: #5a4535;
  line-height: 1.8;
  margin-bottom: 10px;
}

.info-list {
  font-size: 0.9rem;
  color: #5a4535;
  line-height: 1.8;
  padding-left: 20px;
  margin-bottom: 10px;
}

.info-list li {
  margin-bottom: 6px;
}

.info-section a {
  color: #c8a882;
  text-decoration: underline;
}

.info-section code {
  background: #f0e8dc;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.85rem;
  color: #7a5c20;
}

@media (max-width: 768px) {
  .info-title {
    font-size: 1.6rem;
  }
}
</style>
