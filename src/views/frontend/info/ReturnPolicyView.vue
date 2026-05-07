<template>
  <div class="info-hero">
    <p class="info-hero__eyebrow">Shopping Guide</p>
    <h1 class="info-hero__title">退換貨政策</h1>
    <div class="info-hero__line"></div>
    <p class="info-hero__sub">我們重視每一位顧客的購物體驗，讓您安心選購</p>
  </div>

  <div class="info-wrap">

    <div class="policy-banner">
      <div class="policy-banner__item">
        <span class="policy-banner__icon">📦</span>
        <span>收到商品 7 天內申請</span>
      </div>
      <div class="policy-banner__item">
        <span class="policy-banner__icon">✅</span>
        <span>商品未穿著、吊牌完整</span>
      </div>
      <div class="policy-banner__item">
        <span class="policy-banner__icon">🔄</span>
        <span>換貨以同款不同尺寸為原則</span>
      </div>
    </div>

    <section class="info-section">
      <h2 class="info-section__title">退貨條件</h2>
      <ul class="info-list">
        <li>收到商品後 <strong>7 個日曆天</strong>內申請（以物流送達日期為準）。</li>
        <li>商品須保持<strong>全新未穿著</strong>狀態，所有吊牌、包裝、配件完整。</li>
        <li>商品須無異味、無污漬、無損傷。</li>
        <li>若為商品本身瑕疵（如車縫線鬆脫、染色不均），不受 7 天限制，請盡快聯繫我們。</li>
      </ul>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">不受理退換貨情況</h2>
      <ul class="info-list warn">
        <li>已超過 7 天申請期限。</li>
        <li>商品已穿著、洗滌或有使用痕跡。</li>
        <li>吊牌、包裝被拆除或遺失。</li>
        <li>因消費者不喜歡款式、尺寸選錯（請參考尺寸指南）等個人因素，商品本身無瑕疵。</li>
        <li>特賣品、出清品、限時優惠商品（商品頁面會標示）。</li>
        <li>內衣、貼身衣物基於衛生理由恕不退換。</li>
      </ul>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">退換貨流程</h2>
      <div class="steps">
        <div class="step">
          <div class="step__num">01</div>
          <div class="step__body">
            <h4>申請退換貨</h4>
            <p>透過「聯絡我們」或 Instagram 私訊，提供訂單編號、商品名稱及退換原因，並附上商品照片。</p>
          </div>
        </div>
        <div class="step">
          <div class="step__num">02</div>
          <div class="step__body">
            <h4>等待確認</h4>
            <p>我們將於 1~2 個工作天內回覆審核結果及退貨寄送方式。</p>
          </div>
        </div>
        <div class="step">
          <div class="step__num">03</div>
          <div class="step__body">
            <h4>寄回商品</h4>
            <p>確認後請依指示將商品以原包裝寄回，寄件費用說明如下：
              <br>・商品瑕疵 → 運費由本店負擔
              <br>・其他原因 → 退貨運費由顧客自行負擔
            </p>
          </div>
        </div>
        <div class="step">
          <div class="step__num">04</div>
          <div class="step__body">
            <h4>收到商品並處理</h4>
            <p>收到退回商品並確認狀況無誤後，<br>
              ・退款：原付款方式退回，信用卡退款約 5~14 個工作天<br>
              ・換貨：盡快安排重新出貨，確認有庫存後寄出
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">聯絡客服</h2>
      <p>如有退換貨相關問題，歡迎透過以下方式聯繫，我們將盡快為您處理：</p>
      <p>
        客服信箱：<strong>service@aleyswardrobe.com</strong><br>
        客服時間：週一至週五 10:00–18:00（例假日除外）<br>
        Instagram：<strong>@aleyswardrobe</strong>（私訊亦可）
      </p>
    </section>

  </div>
</template>

<style scoped>
.info-hero {
  background: var(--fe-cream);
  padding: 120px 24px 64px;
  text-align: center;
}
.info-hero__eyebrow {
  font-size: 11px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 16px;
}
.info-hero__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(36px, 6vw, 54px);
  font-weight: 400;
  color: var(--fe-text);
  margin: 0 0 20px;
  letter-spacing: 0.04em;
}
.info-hero__line {
  width: 40px;
  height: 1px;
  background: var(--fe-gold);
  margin: 0 auto 20px;
}
.info-hero__sub {
  font-size: 14px;
  color: var(--fe-muted);
  margin: 0;
  line-height: 1.8;
}
.info-wrap {
  max-width: 820px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}
.info-section {
  margin-bottom: 56px;
}
.info-section__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--fe-border);
  letter-spacing: 0.04em;
}
.info-section p {
  font-size: 14.5px;
  line-height: 2;
  color: var(--fe-muted);
  margin: 0 0 10px;
}
.info-section strong {
  color: var(--fe-text);
  font-weight: 500;
}

/* Policy banner */
.policy-banner {
  display: flex;
  gap: 16px;
  margin-bottom: 56px;
  flex-wrap: wrap;
}
.policy-banner__item {
  flex: 1;
  min-width: 180px;
  background: var(--fe-linen);
  border-radius: 10px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13.5px;
  color: var(--fe-text);
  font-weight: 400;
}
.policy-banner__icon {
  font-size: 22px;
}

/* List */
.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.info-list li {
  font-size: 14.5px;
  line-height: 2;
  color: var(--fe-muted);
  padding-left: 20px;
  position: relative;
  margin-bottom: 4px;
}
.info-list li strong {
  color: var(--fe-text);
  font-weight: 500;
}
.info-list li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--fe-gold);
}
.info-list.warn li::before {
  color: #d97706;
}

/* Steps */
.steps { display: flex; flex-direction: column; gap: 24px; }

.step {
  display: flex;
  gap: 20px;
}
.step__num {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 36px;
  color: var(--fe-gold);
  line-height: 1;
  min-width: 48px;
}
.step__body h4 {
  font-size: 15px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 4px 0 8px;
  letter-spacing: 0.04em;
}
.step__body p {
  font-size: 14px;
  color: var(--fe-muted);
  line-height: 1.9;
  margin: 0;
}
</style>
