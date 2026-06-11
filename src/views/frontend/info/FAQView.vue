<script setup>
import { ref } from 'vue'

const openIndex = ref(null)

function toggle(i) {
  openIndex.value = openIndex.value === i ? null : i
}

const faqs = [
  {
    category: '訂單相關',
    items: [
      {
        q: '如何查看訂單狀態？',
        a: '登入後進入「會員中心 → 訂單記錄」即可查看所有訂單的付款狀態、配送狀態與詳細資訊。'
      },
      {
        q: '可以修改或取消訂單嗎？',
        a: '訂單成立後原則上無法修改，若有緊急狀況請盡快透過客服信箱或 Instagram 私訊聯繫我們，我們將視備貨進度協助處理。訂單出貨後恕無法取消。'
      },
      {
        q: '訂單成立後多久會出貨？',
        a: '付款確認後，工作天（週一至週五）1~2 個工作天內出貨。假日或國定假日訂單於下一個工作日起算。'
      },
      {
        q: '可以一次購買多件商品嗎？',
        a: '可以，在商品詳情頁可選擇數量（上限為當前庫存量），並可將多件商品加入同一購物車一起結帳。'
      },
    ]
  },
  {
    category: '付款相關',
    items: [
      {
        q: '支援哪些付款方式？',
        a: '目前支援信用卡（VISA / MasterCard / JCB）、ATM 轉帳，以及先付款後超商取貨。'
      },
      {
        q: 'ATM 轉帳要在多久內完成？',
        a: '取得虛擬帳號後，請於 3 個日曆天內完成匯款，逾期帳號將失效，訂單自動取消。'
      },
      {
        q: '有優惠券可以使用嗎？',
        a: '是的！在結帳頁面可輸入優惠券代碼套用折扣。優惠券的使用規則請參考各活動說明，每張訂單限用一張。'
      },
      {
        q: '付款後沒有收到確認信怎麼辦？',
        a: '請先確認垃圾郵件資料夾，或登入會員中心確認訂單狀態。如仍有問題，請聯繫客服提供訂單編號協助查詢。'
      },
    ]
  },
  {
    category: '配送相關',
    items: [
      {
        q: '配送範圍有哪些？',
        a: '目前僅配送台灣本島，離島（澎湖、金門、馬祖）暫不支援。'
      },
      {
        q: '超商取貨要選哪個門市？',
        a: '在結帳付款頁面（藍新金流頁面）可選擇取貨門市，支援 7-ELEVEN、全家、萊爾富、OK mart。'
      },
      {
        q: '商品送達超商後多久要取貨？',
        a: '商品送達後會發送簡訊通知，請於 <strong>3 天</strong>內前往取貨。逾期未取將退回，運費恕不退還。'
      },
      {
        q: '可以更改收件地址嗎？',
        a: '訂單出貨前可聯繫客服協助修改，出貨後無法更改。'
      },
    ]
  },
  {
    category: '退換貨相關',
    items: [
      {
        q: '退換貨申請期限是多久？',
        a: '收到商品後 7 個日曆天內（以物流送達日期為準）可申請退換貨，需商品全新未穿著、吊牌完整。'
      },
      {
        q: '退款需要多久時間？',
        a: '確認收到退回商品後，信用卡退款約 5~14 個工作天入帳（依各銀行作業時間不同）；ATM 轉帳退款請提供收款帳號，約 3~5 個工作天匯款。'
      },
      {
        q: '尺寸不合可以換貨嗎？',
        a: '可以，但需商品全新未穿著、吊牌完整，且庫存有相同款式的其他尺寸。建議購買前參考「尺寸指南」頁面選擇適合的尺碼。'
      },
      {
        q: '收到瑕疵品怎麼辦？',
        a: '若商品有製作瑕疵，請於收到商品後盡快聯繫客服並附上照片，我們將優先安排換貨或退款，不受 7 天限制。'
      },
    ]
  },
]

let globalIndex = 0
</script>

<template>
  <div class="info-hero">
    <p class="info-hero__eyebrow">Help Center</p>
    <h1 class="info-hero__title">常見問題</h1>
    <div class="info-hero__line"></div>
    <p class="info-hero__sub">找不到答案？歡迎透過客服與我們聯繫</p>
  </div>

  <div class="info-wrap">
    <div
      v-for="(group, gi) in faqs"
      :key="gi"
      class="faq-group"
    >
      <h2 class="faq-group__title">{{ group.category }}</h2>
      <div
        v-for="(item, ii) in group.items"
        :key="ii"
        class="faq-item"
        :class="{ 'faq-item--open': openIndex === `${gi}-${ii}` }"
      >
        <button class="faq-item__q" @click="toggle(`${gi}-${ii}`)">
          <span>{{ item.q }}</span>
          <span class="faq-item__arrow">{{ openIndex === `${gi}-${ii}` ? '−' : '+' }}</span>
        </button>
        <div class="faq-item__a" v-show="openIndex === `${gi}-${ii}`">
          <p>{{ item.a }}</p>
        </div>
      </div>
    </div>

    <div class="faq-contact">
      <p class="faq-contact__title">還有其他問題？</p>
      <p>歡迎透過以下方式聯繫我們的客服團隊</p>
      <RouterLink to="/contact" class="faq-contact__btn">聯絡我們</RouterLink>
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
.info-wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}

/* FAQ group */
.faq-group {
  margin-bottom: 48px;
}
.faq-group__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 22px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--fe-border);
  letter-spacing: 0.04em;
}

/* FAQ item */
.faq-item {
  border-bottom: 1px solid var(--fe-border);
}
.faq-item__q {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 4px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  gap: 16px;
  font-family: inherit;
}
.faq-item__q span:first-child {
  font-size: 14.5px;
  color: var(--fe-text);
  line-height: 1.6;
  font-weight: 400;
}
.faq-item__arrow {
  font-size: 20px;
  color: var(--fe-gold);
  flex-shrink: 0;
  line-height: 1;
  transition: transform 0.2s;
}
.faq-item--open .faq-item__arrow {
  color: var(--fe-gold-d);
}
.faq-item__a {
  padding: 0 4px 20px;
}
.faq-item__a p {
  font-size: 14px;
  color: var(--fe-muted);
  line-height: 2;
  margin: 0;
}

/* Contact CTA */
.faq-contact {
  margin-top: 64px;
  text-align: center;
  background: var(--fe-cream);
  border-radius: 16px;
  padding: 48px 32px;
}
.faq-contact__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 28px;
  font-weight: 400;
  color: var(--fe-text);
  margin: 0 0 10px;
}
.faq-contact p {
  font-size: 14px;
  color: var(--fe-muted);
  margin: 0 0 24px;
}
.faq-contact__btn {
  display: inline-flex;
  align-items: center;
  padding: 12px 32px;
  background: var(--fe-text);
  color: #fff;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: background 0.2s;
}
.faq-contact__btn:hover { background: var(--fe-gold-d); }
</style>
