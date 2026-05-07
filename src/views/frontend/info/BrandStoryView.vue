<template>
  <div class="info-hero">
    <p class="info-hero__eyebrow">Our Story</p>
    <h1 class="info-hero__title">品牌故事</h1>
    <div class="info-hero__line"></div>
    <p class="info-hero__sub">從一份對美的執著，到你衣櫃裡的每一件珍藏</p>
  </div>

  <!-- Opening quote -->
  <div class="story-quote">
    <blockquote>
      「穿上你喜歡的自己，<br>是每天早晨最美好的儀式。」
    </blockquote>
  </div>

  <div class="info-wrap">

    <section class="story-section">
      <div class="story-section__label">Chapter 01</div>
      <h2 class="story-section__title">一切從衣櫃開始</h2>
      <p>Aley's Wardrobe 創立於對日韓時尚的深深著迷。創辦人 Aley 在旅居日本與韓國的期間，被當地街頭迥異於台灣的穿著美學深深吸引——那種輕盈、有質感、又充滿個人風格的日常穿搭，讓她相信：穿衣服不只是蔽體，而是一種自我表達。</p>
      <p>回台後，Aley 發現市場上難以找到同時兼具品質與風格的日韓選品，於是決定自己開始選品，從一個小小的衣櫃分享，逐漸成長為今天的 Aley's Wardrobe。</p>
    </section>

    <div class="story-divider">
      <span>· · ·</span>
    </div>

    <section class="story-section">
      <div class="story-section__label">Chapter 02</div>
      <h2 class="story-section__title">選品的堅持</h2>
      <p>每一件上架的商品，都是我們親自試穿、把關材質與版型後的精挑細選。我們相信，好的選品必須同時通過三個標準：</p>
      <div class="story-values">
        <div class="story-value">
          <h4>質感</h4>
          <p>材質觸感、車縫細節、穿著舒適度，都是我們評估的重點。</p>
        </div>
        <div class="story-value">
          <h4>風格</h4>
          <p>具備獨特的設計語言，能融入日常穿搭又不失亮點。</p>
        </div>
        <div class="story-value">
          <h4>耐看</h4>
          <p>不只追求當季流行，更注重能跨季、長久穿著的時尚感。</p>
        </div>
      </div>
      <p>我們不求多，只求精。每次上新都是一次精心策劃的選品旅程。</p>
    </section>

    <div class="story-divider">
      <span>· · ·</span>
    </div>

    <section class="story-section">
      <div class="story-section__label">Chapter 03</div>
      <h2 class="story-section__title">關於你，關於我們</h2>
      <p>Aley's Wardrobe 的顧客，是那些在意生活品味、享受穿著樂趣的人。不論你喜歡日系的簡約淡雅，還是韓系的時髦有型，我們都希望能在你的衣櫃裡找到屬於你的那一件。</p>
      <p>我們不只是一間網路服飾店，更希望成為你探索個人風格的夥伴。每一次下單，都是我們之間一次小小的信任，而我們會用最真誠的選品與服務來回應。</p>
    </section>

    <div class="story-cta">
      <p>準備好探索了嗎？</p>
      <RouterLink to="/products" class="story-cta__btn">
        探索新品
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </RouterLink>
    </div>

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

/* Opening quote */
.story-quote {
  background: var(--fe-linen);
  padding: 56px 24px;
  text-align: center;
}
.story-quote blockquote {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(20px, 3.5vw, 28px);
  font-style: italic;
  color: var(--fe-text);
  margin: 0;
  line-height: 1.8;
  letter-spacing: 0.04em;
}

.info-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 72px 24px 96px;
}

/* Story section */
.story-section {
  margin-bottom: 16px;
}
.story-section__label {
  font-size: 10.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin-bottom: 14px;
}
.story-section__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 30px;
  font-weight: 400;
  color: var(--fe-text);
  margin: 0 0 24px;
  letter-spacing: 0.04em;
}
.story-section p {
  font-size: 15px;
  line-height: 2.1;
  color: var(--fe-muted);
  margin: 0 0 16px;
}

/* Values */
.story-values {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 24px 0 28px;
}
@media (max-width: 560px) {
  .story-values { grid-template-columns: 1fr; }
}
.story-value {
  background: var(--fe-cream);
  border: 1px solid var(--fe-border);
  border-radius: 10px;
  padding: 22px 20px;
}
.story-value h4 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 8px;
  letter-spacing: 0.04em;
}
.story-value p {
  font-size: 13.5px !important;
  line-height: 1.8 !important;
  margin: 0 !important;
}

/* Divider */
.story-divider {
  text-align: center;
  padding: 32px 0;
  color: var(--fe-gold);
  font-size: 18px;
  letter-spacing: 0.3em;
}

/* CTA */
.story-cta {
  margin-top: 64px;
  text-align: center;
  padding: 56px 32px;
  background: var(--fe-cream);
  border-radius: 16px;
}
.story-cta p {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 26px;
  color: var(--fe-text);
  margin: 0 0 24px;
  font-style: italic;
}
.story-cta__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 32px;
  background: var(--fe-text);
  color: #fff;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: background 0.2s;
}
.story-cta__btn:hover { background: var(--fe-gold-d); }
</style>
