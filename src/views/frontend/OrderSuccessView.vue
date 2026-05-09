<script setup>
import { onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { db } from '@/lib/db'
import { trackPurchase } from '@/lib/gtag'

const route = useRoute()
const orderNo = route.params.orderNo

onMounted(async () => {
  sessionStorage.removeItem('checkoutDraft')

  // Fire purchase event once per orderNo (guard against page refresh double-counting)
  const fireKey = `ga_purchase_${orderNo}`
  if (sessionStorage.getItem(fireKey)) return
  sessionStorage.setItem(fireKey, '1')

  try {
    const { data: order } = await db
      .from('C_ORD_OrderList')
      .select('ID, FinalAmount')
      .eq('OrderNo', orderNo)
      .maybeSingle()
    if (!order) return
    const { data: items } = await db
      .from('C_ORD_OrderItemList')
      .select('ProductID, ProductName, UnitPrice, Qty')
      .eq('OrderID', order.ID)
    trackPurchase(orderNo, items ?? [], order.FinalAmount)
  } catch {
    // Non-critical — analytics failure must never break the page
  }
})
</script>

<template>
  <div class="os-root">
    <div class="os-card">

      <!-- Checkmark -->
      <div class="os-check-wrap">
        <svg class="os-check-icon" viewBox="0 0 52 52" fill="none">
          <circle class="os-check-circle" cx="26" cy="26" r="25" stroke-width="2"/>
          <path class="os-check-path" d="M14 27l9 9 16-18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <p class="os-eyebrow">Order Confirmed</p>
      <h1 class="os-title">訂單已送出！</h1>

      <div class="os-order-no">
        <span class="os-order-no__label">訂單編號</span>
        <span class="os-order-no__val">{{ orderNo }}</span>
      </div>

      <p class="os-message">
        感謝您的訂購，我們將盡快為您出貨。<br>
        訂單相關通知將發送至您的信箱。
      </p>

      <div class="os-actions">
        <RouterLink to="/" class="os-btn os-btn--outline">返回首頁</RouterLink>
        <RouterLink :to="`/orders/${orderNo}`" class="os-btn os-btn--primary">查看訂單</RouterLink>
      </div>

    </div>
  </div>
</template>

<style scoped>
.os-root {
  padding-top: 68px;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 68px 24px 96px;
  background: var(--fe-cream);
}

.os-card {
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  padding: 56px 48px;
  max-width: 480px;
  width: 100%;
  text-align: center;
}

/* Checkmark animation */
.os-check-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
}

.os-check-icon {
  width: 72px;
  height: 72px;
}

.os-check-circle {
  stroke: var(--fe-gold);
  fill: none;
  stroke-dasharray: 157;
  stroke-dashoffset: 157;
  animation: drawCircle 0.6s ease forwards;
}

.os-check-path {
  stroke: var(--fe-gold-d);
  fill: none;
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: drawCheck 0.4s ease 0.5s forwards;
}

@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}

@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}

/* Text */
.os-eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 10px;
}

.os-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 32px;
  font-weight: 500;
  margin: 0 0 28px;
  color: var(--fe-text);
}

.os-order-no {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--fe-linen);
  padding: 10px 20px;
  margin-bottom: 24px;
}

.os-order-no__label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
}

.os-order-no__val {
  font-size: 13px;
  font-weight: 600;
  color: var(--fe-text);
  letter-spacing: 0.05em;
}

.os-message {
  font-size: 13.5px;
  color: var(--fe-muted);
  line-height: 1.9;
  margin: 0 0 36px;
}

/* Buttons */
.os-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.os-btn {
  display: inline-block;
  padding: 13px 28px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-decoration: none;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  border-radius: 0;
}

.os-btn--primary {
  background: var(--fe-text);
  color: #fff;
  border: 1px solid var(--fe-text);
}

.os-btn--primary:hover {
  background: transparent;
  color: var(--fe-text);
}

.os-btn--outline {
  background: transparent;
  color: var(--fe-text);
  border: 1px solid var(--fe-border);
}

.os-btn--outline:hover {
  border-color: var(--fe-text);
  background: var(--fe-cream);
}

@media (max-width: 480px) {
  .os-card {
    padding: 40px 24px;
  }

  .os-actions {
    flex-direction: column;
  }

  .os-btn {
    text-align: center;
  }
}
</style>
