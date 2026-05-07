<template>
  <div class="info-hero">
    <p class="info-hero__eyebrow">Get In Touch</p>
    <h1 class="info-hero__title">聯絡我們</h1>
    <div class="info-hero__line"></div>
    <p class="info-hero__sub">有任何問題或建議，我們很樂意聆聽</p>
  </div>

  <div class="contact-wrap">

    <div class="contact-grid">

      <!-- Left: Info -->
      <div class="contact-info">
        <div class="contact-block">
          <div class="contact-block__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div>
            <h4>客服信箱</h4>
            <p>service@aleyswardrobe.com</p>
            <span>回覆時間約 1~2 個工作天</span>
          </div>
        </div>

        <div class="contact-block">
          <div class="contact-block__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </div>
          <div>
            <h4>Instagram</h4>
            <p>@aleyswardrobe</p>
            <span>私訊亦可，快速回覆</span>
          </div>
        </div>

        <div class="contact-block">
          <div class="contact-block__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </div>
          <div>
            <h4>Facebook</h4>
            <p>Aley's Wardrobe</p>
            <span>粉絲專頁私訊亦可</span>
          </div>
        </div>

        <div class="contact-block">
          <div class="contact-block__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <h4>客服時間</h4>
            <p>週一 至 週五</p>
            <span>10:00 – 18:00（例假日除外）</span>
          </div>
        </div>
      </div>

      <!-- Right: Message form (display only) -->
      <div class="contact-form-wrap">
        <h3 class="contact-form__title">傳送訊息給我們</h3>
        <p class="contact-form__sub">留下您的問題，我們將盡快回覆</p>

        <form class="contact-form" @submit.prevent="onSubmit">
          <div class="contact-form__row">
            <div class="contact-form__field">
              <label>姓名</label>
              <input v-model="form.name" type="text" placeholder="您的姓名" required />
            </div>
            <div class="contact-form__field">
              <label>電子信箱</label>
              <input v-model="form.email" type="email" placeholder="email@example.com" required />
            </div>
          </div>
          <div class="contact-form__field">
            <label>主旨</label>
            <select v-model="form.subject">
              <option value="">請選擇主旨</option>
              <option value="order">訂單問題</option>
              <option value="return">退換貨申請</option>
              <option value="size">尺寸諮詢</option>
              <option value="other">其他問題</option>
            </select>
          </div>
          <div class="contact-form__field">
            <label>訊息內容</label>
            <textarea v-model="form.message" rows="5" placeholder="請詳細說明您的問題，若有訂單相關問題請提供訂單編號" required></textarea>
          </div>
          <button type="submit" class="contact-form__submit" :disabled="submitted">
            <template v-if="submitted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              已送出，我們將盡快回覆
            </template>
            <template v-else>送出訊息</template>
          </button>
        </form>
      </div>

    </div>

    <div class="contact-notice">
      <p>📌 關於退換貨申請，請至<RouterLink to="/returns">退換貨政策</RouterLink>頁面了解詳細流程後再聯繫，並附上訂單編號及商品照片，以便我們快速處理。</p>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const submitted = ref(false)
const form = reactive({ name: '', email: '', subject: '', message: '' })

function onSubmit() {
  submitted.value = true
}
</script>

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

.contact-wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}

/* Grid */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 56px;
  align-items: start;
  margin-bottom: 48px;
}
@media (max-width: 768px) {
  .contact-grid { grid-template-columns: 1fr; gap: 40px; }
}

/* Contact blocks */
.contact-info { display: flex; flex-direction: column; gap: 28px; }

.contact-block {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.contact-block__icon {
  width: 42px;
  height: 42px;
  border: 1px solid var(--fe-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fe-gold-d);
  flex-shrink: 0;
  background: var(--fe-cream);
}
.contact-block h4 {
  font-size: 13px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 4px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.contact-block p {
  font-size: 15px;
  color: var(--fe-text);
  margin: 0 0 3px;
  font-weight: 400;
}
.contact-block span {
  font-size: 12.5px;
  color: var(--fe-muted);
}

/* Form */
.contact-form-wrap {
  background: var(--fe-cream);
  border: 1px solid var(--fe-border);
  border-radius: 16px;
  padding: 40px;
}
@media (max-width: 560px) {
  .contact-form-wrap { padding: 28px 20px; }
}
.contact-form__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 26px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 6px;
  letter-spacing: 0.04em;
}
.contact-form__sub {
  font-size: 13.5px;
  color: var(--fe-muted);
  margin: 0 0 28px;
}
.contact-form { display: flex; flex-direction: column; gap: 18px; }
.contact-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 480px) {
  .contact-form__row { grid-template-columns: 1fr; }
}
.contact-form__field { display: flex; flex-direction: column; gap: 6px; }
.contact-form__field label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fe-text);
  font-weight: 500;
}
.contact-form__field input,
.contact-form__field select,
.contact-form__field textarea {
  padding: 11px 14px;
  border: 1px solid var(--fe-border);
  border-radius: 6px;
  background: var(--fe-white);
  font-family: inherit;
  font-size: 14px;
  color: var(--fe-text);
  outline: none;
  transition: border-color 0.2s;
  resize: vertical;
}
.contact-form__field input::placeholder,
.contact-form__field textarea::placeholder {
  color: var(--fe-muted);
  opacity: 0.7;
}
.contact-form__field input:focus,
.contact-form__field select:focus,
.contact-form__field textarea:focus {
  border-color: var(--fe-gold);
}
.contact-form__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 28px;
  background: var(--fe-text);
  color: #fff;
  border: none;
  border-radius: 2px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-start;
}
.contact-form__submit:hover:not(:disabled) { background: var(--fe-gold-d); }
.contact-form__submit:disabled {
  background: #5a7a5a;
  cursor: default;
}

/* Notice */
.contact-notice {
  border-left: 2px solid var(--fe-gold);
  padding: 14px 20px;
  background: var(--fe-cream);
  border-radius: 0 8px 8px 0;
}
.contact-notice p {
  font-size: 13.5px;
  color: var(--fe-muted);
  margin: 0;
  line-height: 1.8;
}
.contact-notice a {
  color: var(--fe-gold-d);
  text-decoration: underline;
}
</style>
