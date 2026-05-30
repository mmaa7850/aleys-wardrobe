<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db'

const auth   = useAuthStore()
const router = useRouter()

const orders  = ref([])
const loading = ref(true)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function payLabel(s) {
  if (s === 'paid')    return '已付款'
  if (s === 'failed')  return '付款失敗'
  if (s === 'refunded') return '已退款'
  return '待付款'
}

async function fetchOrders() {
  loading.value = true
  const { data } = await db
    .from('C_ORD_OrderList')
    .select('ID, OrderNo, FinalAmount, NewebpayAmt, WalletDeductAmt, PaymentStatus, CreatedDate')
    .eq('CustomerEmail', auth.user.email)
    .order('CreatedDate', { ascending: false })
  orders.value = data || []
  loading.value = false
}

onMounted(() => {
  if (!auth.isLoggedIn) { router.push('/login'); return }
  fetchOrders()
})
</script>

<template>
  <div class="ol-page">

    <!-- Header -->
    <div class="ol-header">
      <div class="ol-header__inner">
        <RouterLink to="/account" class="ol-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回帳號
        </RouterLink>
        <h1 class="ol-title">訂單紀錄</h1>
        <p class="ol-subtitle">共 {{ orders.length }} 筆訂單</p>
      </div>
    </div>

    <!-- Content -->
    <div class="ol-body">

      <!-- Loading -->
      <div v-if="loading" class="ol-empty">
        <div class="ol-spinner"></div>
      </div>

      <!-- Empty -->
      <div v-else-if="orders.length === 0" class="ol-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
        <p class="ol-empty__text">尚無訂單紀錄</p>
        <RouterLink to="/products" class="ol-empty__btn">去逛逛</RouterLink>
      </div>

      <!-- List -->
      <div v-else class="ol-list">

        <!-- Desktop header row -->
        <div class="ol-list__head">
          <span>訂單編號</span>
          <span>下單日期</span>
          <span>實付金額</span>
          <span>付款狀態</span>
          <span></span>
        </div>

        <RouterLink
          v-for="o in orders"
          :key="o.ID"
          :to="'/orders/' + o.OrderNo"
          class="ol-row"
        >
          <span class="ol-row__no">{{ o.OrderNo }}</span>
          <span class="ol-row__date">{{ formatDate(o.CreatedDate) }}</span>
          <span class="ol-row__amount">NT$ {{ Number(o.WalletDeductAmt > 0 ? (o.NewebpayAmt ?? o.FinalAmount) : o.FinalAmount).toLocaleString() }}</span>
          <span :class="['ol-badge', `ol-badge--${o.PaymentStatus}`]">
            {{ payLabel(o.PaymentStatus) }}
          </span>
          <span class="ol-row__arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </span>
        </RouterLink>

      </div>
    </div>

  </div>
</template>

<style scoped>
.ol-page {
  min-height: 100vh;
  background: var(--fe-cream);
  padding-top: 68px;
}

/* Header */
.ol-header {
  background: var(--fe-white);
  border-bottom: 1px solid var(--fe-border);
  padding: 36px 24px 32px;
}

.ol-header__inner {
  max-width: 800px;
  margin: 0 auto;
}

.ol-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--fe-muted);
  text-decoration: none;
  letter-spacing: 0.04em;
  margin-bottom: 14px;
  transition: color 0.15s;
}
.ol-back:hover { color: var(--fe-text); }

.ol-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 28px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 4px;
}

.ol-subtitle {
  font-size: 13px;
  color: var(--fe-muted);
  margin: 0;
}

/* Body */
.ol-body {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

/* Empty */
.ol-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0 40px;
  color: var(--fe-muted);
}

.ol-empty__text {
  font-size: 14px;
  margin: 0;
  letter-spacing: 0.04em;
}

.ol-empty__btn {
  display: inline-block;
  padding: 11px 28px;
  background: var(--fe-text);
  color: #fff;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: opacity 0.2s;
}
.ol-empty__btn:hover { opacity: 0.8; }

/* List */
.ol-list {
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  border-radius: 12px;
  overflow: hidden;
}

.ol-list__head {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 32px;
  gap: 12px;
  padding: 12px 20px;
  background: var(--fe-linen);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fe-muted);
  font-weight: 500;
  border-bottom: 1px solid var(--fe-border);
}

.ol-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 32px;
  gap: 12px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--fe-border);
  text-decoration: none;
  color: var(--fe-text);
  transition: background 0.15s;
}

.ol-row:last-child { border-bottom: none; }
.ol-row:hover { background: var(--fe-cream); }

.ol-row__no {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
}

.ol-row__date {
  font-size: 13px;
  color: var(--fe-muted);
  white-space: nowrap;
}

.ol-row__amount {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.ol-badge {
  display: inline-block;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ol-badge--paid     { background: rgba(34,197,94,0.12);  color: #15803D; }
.ol-badge--pending  { background: rgba(180,180,180,0.15); color: var(--fe-muted); }
.ol-badge--failed   { background: rgba(220,38,38,0.08);  color: #DC2626; }
.ol-badge--refunded { background: rgba(99,102,241,0.1);  color: #4338CA; }

.ol-row__arrow { color: var(--fe-muted); display: flex; justify-content: flex-end; }

.ol-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 80px auto;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Mobile */
@media (max-width: 640px) {
  .ol-header { padding: 28px 16px 24px; }
  .ol-body { padding: 20px 16px 60px; }

  .ol-list__head { display: none; }

  .ol-row {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 6px 12px;
    padding: 14px 16px;
  }

  .ol-row__no    { grid-column: 1; grid-row: 1; font-size: 12.5px; }
  .ol-row__arrow { grid-column: 2; grid-row: 1 / 3; align-self: center; }
  .ol-row__date  { grid-column: 1; grid-row: 2; font-size: 12px; }
  .ol-row__amount { display: none; }
  .ol-badge { grid-column: 1; grid-row: 2; display: inline-block; width: fit-content; }

  /* On mobile show amount + badge inline */
  .ol-row__date::after {
    content: attr(data-amount);
  }
}
</style>
