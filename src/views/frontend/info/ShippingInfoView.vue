<template>
  <div class="info-hero">
    <p class="info-hero__eyebrow">Shopping Guide</p>
    <h1 class="info-hero__title">運費說明</h1>
    <div class="info-hero__line"></div>
    <p class="info-hero__sub">多種配送方式，讓您輕鬆選擇最方便的取貨方式</p>
  </div>

  <div class="info-wrap">

    <div class="shipping-cards">
      <div class="shipping-card">
        <div class="shipping-card__header">
          <span class="shipping-card__icon">🏪</span>
          <h3>超商取貨不付款</h3>
        </div>
        <div class="shipping-card__fee">NT$ 80</div>
        <ul>
          <li>7-ELEVEN、全家、萊爾富、OK mart</li>
          <li>在結帳頁選擇門市</li>
          <li>送達門市後簡訊通知</li>
          <li>限 3 天內取貨</li>
        </ul>
      </div>
      <div class="shipping-card shipping-card--home">
        <div class="shipping-card__header">
          <span class="shipping-card__icon">🏠</span>
          <h3>宅配到府</h3>
        </div>
        <div class="shipping-card__fee">NT$ 100</div>
        <ul>
          <li>黑貓宅急便（台灣本島）</li>
          <li>填寫收件地址</li>
          <li>出貨後約 1~3 個工作天送達</li>
          <li>配送前來電確認</li>
        </ul>
      </div>
    </div>

    <section class="info-section">
      <h2 class="info-section__title">出貨時間</h2>
      <div class="timeline">
        <div class="timeline-item">
          <div class="timeline-item__dot"></div>
          <div class="timeline-item__body">
            <h4>付款確認</h4>
            <p>信用卡付款完成後即時確認；ATM 轉帳請於取號後 3 天內完成匯款，確認入帳後開始備貨。</p>
          </div>
        </div>
        <div class="timeline-item">
          <div class="timeline-item__dot"></div>
          <div class="timeline-item__body">
            <h4>備貨中</h4>
            <p>工作天（週一至週五）接單後 <strong>1~2 個工作天</strong>內出貨。假日、國定假日訂單於下一個工作日起算。</p>
          </div>
        </div>
        <div class="timeline-item">
          <div class="timeline-item__dot"></div>
          <div class="timeline-item__body">
            <h4>配送中</h4>
            <p>超商取貨：商品送達門市後會收到簡訊通知，請於 3 天內取貨。<br>宅配：出貨後 1~3 個工作天送達，可透過訂單頁追蹤狀態。</p>
          </div>
        </div>
      </div>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">注意事項</h2>
      <ul class="info-list">
        <li>目前配送範圍僅限<strong>台灣本島</strong>，離島（澎湖、金門、馬祖）暫不提供配送服務。</li>
        <li>若商品因缺貨或其他因素無法出貨，我們將主動聯繫並全額退款。</li>
        <li>超商取貨訂單金額上限為 NT$ 20,000。</li>
        <li>如需更改收件地址，請在出貨前聯繫客服，出貨後無法更改。</li>
        <li>遇連假期間出貨時間可能順延，請多預留等待時間。</li>
      </ul>
    </section>

    <section class="info-section">
      <h2 class="info-section__title">付款方式</h2>
      <div class="pay-methods">
        <div class="pay-method">
          <span class="pay-method__icon">💳</span>
          <div>
            <h4>信用卡</h4>
            <p>VISA、MasterCard、JCB，可選擇分期（3/6/12 期）</p>
          </div>
        </div>
        <div class="pay-method">
          <span class="pay-method__icon">🏦</span>
          <div>
            <h4>ATM 轉帳</h4>
            <p>取得虛擬帳號後，請於 3 天內至 ATM 或網銀完成匯款</p>
          </div>
        </div>
        <div class="pay-method">
          <span class="pay-method__icon">🏪</span>
          <div>
            <h4>超商取貨不付款</h4>
            <p>先付款（信用卡 / ATM）後至超商取貨，不支援貨到付款</p>
          </div>
        </div>
      </div>
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
.info-section { margin-bottom: 56px; }
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

/* Shipping cards */
.shipping-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 56px;
}
@media (max-width: 560px) {
  .shipping-cards { grid-template-columns: 1fr; }
}
.shipping-card {
  border: 1px solid var(--fe-border);
  border-radius: 14px;
  padding: 28px;
  background: var(--fe-cream);
}
.shipping-card--home {
  background: var(--fe-linen);
}
.shipping-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.shipping-card__icon { font-size: 24px; }
.shipping-card__header h3 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  margin: 0;
  letter-spacing: 0.04em;
}
.shipping-card__fee {
  font-size: 28px;
  font-weight: 300;
  color: var(--fe-gold-d);
  margin-bottom: 16px;
  font-family: 'Cormorant Garamond', Georgia, serif;
}
.shipping-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.shipping-card ul li {
  font-size: 13.5px;
  color: var(--fe-muted);
  padding: 4px 0 4px 16px;
  position: relative;
  line-height: 1.7;
}
.shipping-card ul li::before {
  content: '·';
  position: absolute;
  left: 4px;
  color: var(--fe-gold);
  font-size: 18px;
  line-height: 1.4;
}

/* Timeline */
.timeline { display: flex; flex-direction: column; gap: 0; }
.timeline-item {
  display: flex;
  gap: 20px;
  padding-bottom: 28px;
  position: relative;
}
.timeline-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 7px;
  top: 16px;
  bottom: 0;
  width: 1px;
  background: var(--fe-border);
}
.timeline-item__dot {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--fe-gold);
  flex-shrink: 0;
  margin-top: 5px;
}
.timeline-item__body h4 {
  font-size: 15px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 6px;
  letter-spacing: 0.04em;
}
.timeline-item__body p {
  font-size: 14px;
  color: var(--fe-muted);
  line-height: 1.9;
  margin: 0;
}
.timeline-item__body strong {
  color: var(--fe-text);
  font-weight: 500;
}

/* Pay methods */
.pay-methods { display: flex; flex-direction: column; gap: 16px; }
.pay-method {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 20px;
  background: var(--fe-cream);
  border-radius: 10px;
  border: 1px solid var(--fe-border);
}
.pay-method__icon { font-size: 24px; flex-shrink: 0; }
.pay-method h4 {
  font-size: 15px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 4px;
}
.pay-method p {
  font-size: 13.5px;
  color: var(--fe-muted);
  margin: 0;
  line-height: 1.7;
}

/* List */
.info-list { list-style: none; padding: 0; margin: 0; }
.info-list li {
  font-size: 14.5px;
  line-height: 2;
  color: var(--fe-muted);
  padding-left: 20px;
  position: relative;
  margin-bottom: 4px;
}
.info-list li strong { color: var(--fe-text); font-weight: 500; }
.info-list li::before { content: '—'; position: absolute; left: 0; color: var(--fe-gold); }
</style>
