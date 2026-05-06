<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

const order     = ref(null)
const items     = ref([])
const isLoading = ref(true)
const notFound  = ref(false)

const isRetrying    = ref(false)
const retryError    = ref('')
const paymentForm   = ref(null)
const paymentParams = ref(null)

async function retryPayment() {
  retryError.value = ''
  isRetrying.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retry-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderNo: order.value.OrderNo }),
      }
    )
    const data = await res.json()
    if (!res.ok || data.error) { retryError.value = data.error || '重新付款失敗，請稍後再試'; return }
    paymentParams.value = data
    await nextTick()
    paymentForm.value.submit()
  } catch {
    retryError.value = '重新付款失敗，請稍後再試'
  } finally {
    isRetrying.value = false
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function payStatusLabel(s) {
  return s === 'paid' ? '已付款' : s === 'failed' ? '付款失敗' : '待付款'
}

function shippingMethodLabel(m) {
  return m === 'cvscom' ? '超商取貨不付款' : '宅配到府'
}

onMounted(async () => {
  if (!auth.isLoggedIn) { router.push('/login'); return }

  const { data: orderData } = await db
    .from('C_ORD_OrderList')
    .select('*')
    .eq('OrderNo', route.params.orderNo)
    .eq('CustomerEmail', auth.user.email)
    .maybeSingle()

  if (!orderData) { notFound.value = true; isLoading.value = false; return }

  order.value = orderData

  const { data: itemsData } = await db
    .rpc('get_order_items', { p_order_no: route.params.orderNo })

  items.value = itemsData || []
  isLoading.value = false
})
</script>

<template>
  <!-- Hidden form that POSTs to NewebPay for retry -->
  <form
    v-if="paymentParams"
    ref="paymentForm"
    :action="paymentParams.gatewayUrl"
    method="POST"
    style="display:none"
  >
    <input type="hidden" name="MerchantID"      :value="paymentParams.MerchantID" />
    <input type="hidden" name="TradeInfo"        :value="paymentParams.TradeInfo" />
    <input type="hidden" name="TradeSha"         :value="paymentParams.TradeSha" />
    <input type="hidden" name="TimeStamp"        :value="paymentParams.TimeStamp" />
    <input type="hidden" name="Version"          :value="paymentParams.Version" />
    <input type="hidden" name="MerchantOrderNo"  :value="paymentParams.MerchantOrderNo" />
  </form>

  <div class="od-root">

    <div v-if="isLoading" class="od-loading">
      <div class="od-spinner"></div>
    </div>

    <div v-else-if="notFound" class="od-notfound">
      <p>找不到此訂單</p>
      <RouterLink to="/account" class="od-back">返回帳號</RouterLink>
    </div>

    <template v-else>
      <div class="od-header">
        <RouterLink to="/account" class="od-back-link">← 返回訂單紀錄</RouterLink>
        <p class="od-eyebrow">Order Detail</p>
        <h1 class="od-title">訂單明細</h1>
      </div>

      <div class="od-body">

        <!-- Order info -->
        <section class="od-card">
          <div class="od-info-grid">
            <div class="od-info-item">
              <span class="od-info-item__label">訂單編號</span>
              <span class="od-info-item__val">{{ order.OrderNo }}</span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">訂單日期</span>
              <span class="od-info-item__val">{{ formatDate(order.CreatedDate) }}</span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">付款狀態</span>
              <span :class="['od-pay-badge', `od-pay-badge--${order.PaymentStatus}`]">
                {{ payStatusLabel(order.PaymentStatus) }}
              </span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">訂單金額</span>
              <span class="od-info-item__val od-info-item__val--strong">NT$ {{ order.FinalAmount?.toLocaleString() }}</span>
            </div>
          </div>

          <!-- ATM / CVS pending: waiting for transfer, no retry -->
          <div v-if="order.PaymentStatus === 'pending' && (order.ATMBankCode || order.PaymentMethod === 'atm' || order.PaymentMethod === 'cvs')" class="od-retry-wrap">
            <p class="od-atm-waiting">付款待確認中，請依照上方資訊完成付款。</p>
          </div>

          <!-- ATM / CVS failed: deadline passed -->
          <div v-else-if="order.PaymentStatus === 'failed' && (order.ATMBankCode || order.PaymentMethod === 'atm' || order.PaymentMethod === 'cvs')" class="od-retry-wrap">
            <p class="od-retry-error">付款期限已過，此訂單已失效。如需購買請重新下訂。</p>
          </div>

          <!-- Credit card / WebATM: allow retry -->
          <div v-else-if="order.PaymentStatus !== 'paid'" class="od-retry-wrap">
            <p v-if="retryError" class="od-retry-error">{{ retryError }}</p>
            <button class="od-retry-btn" :disabled="isRetrying" @click="retryPayment">
              <span v-if="isRetrying">處理中...</span>
              <span v-else>重新付款</span>
            </button>
          </div>
        </section>

        <!-- Shipping info -->
        <section class="od-card">
          <h2 class="od-card__title">配送資訊</h2>
          <div class="od-info-grid">
            <div class="od-info-item">
              <span class="od-info-item__label">收件人</span>
              <span class="od-info-item__val">{{ order.ShippingName }}</span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">電話</span>
              <span class="od-info-item__val">{{ order.ShippingPhone }}</span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">配送方式</span>
              <span class="od-info-item__val">{{ shippingMethodLabel(order.ShippingMethod) }}</span>
            </div>
            <div v-if="order.ShippingStatus" class="od-info-item">
              <span class="od-info-item__label">物流狀態</span>
              <span class="od-ship-badge">{{ order.ShippingStatusText || order.ShippingStatus }}</span>
            </div>

            <!-- 宅配：顯示地址 -->
            <div v-if="order.ShippingMethod !== 'cvscom'" class="od-info-item od-info-item--full">
              <span class="od-info-item__label">收件地址</span>
              <span class="od-info-item__val">{{ order.ShippingAddress }}</span>
            </div>

            <!-- 超商取貨：顯示門市 + 取貨代碼 -->
            <template v-if="order.ShippingMethod === 'cvscom'">
              <div class="od-info-item od-info-item--full">
                <span class="od-info-item__label">取貨門市</span>
                <span class="od-info-item__val">{{ order.StoreName || order.ShippingAddress }}</span>
              </div>
              <div v-if="order.LgsNo" class="od-info-item">
                <span class="od-info-item__label">寄件代碼（ibon）</span>
                <span class="od-info-item__val od-info-item__val--strong od-lgsno">{{ order.LgsNo }}</span>
              </div>
              <div v-if="order.StorePrintNo" class="od-info-item">
                <span class="od-info-item__label">門市列印代碼</span>
                <span class="od-info-item__val od-lgsno">{{ order.StorePrintNo }}</span>
              </div>
              <div v-if="order.LgsNo" class="od-info-item od-info-item--full">
                <span class="od-info-item__label">取貨說明</span>
                <span class="od-info-item__val od-info-item__val--hint">
                  請攜帶以上寄件代碼至任一 7-11 門市，在 ibon 機器選擇「超商物流 → 店到店」輸入代碼列印寄件單後交由門市寄出。
                </span>
              </div>
            </template>

            <div v-if="order.CustomerNote" class="od-info-item od-info-item--full">
              <span class="od-info-item__label">備註</span>
              <span class="od-info-item__val">{{ order.CustomerNote }}</span>
            </div>
          </div>
        </section>

        <!-- ATM virtual account info -->
        <section v-if="order.ATMBankCode || order.ATMAccount" class="od-card od-atm-card">
          <h2 class="od-card__title">ATM 轉帳資訊</h2>
          <p class="od-atm-hint">請於期限內至 ATM 轉帳，完成付款後系統將自動確認。</p>
          <div class="od-info-grid">
            <div class="od-info-item">
              <span class="od-info-item__label">銀行代碼</span>
              <span class="od-info-item__val od-lgsno">{{ order.ATMBankCode }}</span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">虛擬帳號</span>
              <span class="od-info-item__val od-lgsno">{{ order.ATMAccount }}</span>
            </div>
            <div class="od-info-item">
              <span class="od-info-item__label">轉帳金額</span>
              <span class="od-info-item__val od-info-item__val--strong">NT$ {{ order.FinalAmount?.toLocaleString() }}</span>
            </div>
          </div>
        </section>

        <!-- Items -->
        <section class="od-card">
          <h2 class="od-card__title">商品明細</h2>

          <div class="od-items">
            <div class="od-items__header">
              <span>商品</span>
              <span>規格</span>
              <span class="od-right">單價</span>
              <span class="od-right">數量</span>
              <span class="od-right">小計</span>
            </div>

            <div v-for="(item, i) in items" :key="i" class="od-item">
              <span class="od-item__name">{{ item.ProductName }}</span>
              <span class="od-item__variant">
                <span v-if="item.ColorName">{{ item.ColorName }}</span>
                <span v-if="item.ColorName && item.SizeName"> / </span>
                <span v-if="item.SizeName">{{ item.SizeName }}</span>
              </span>
              <span class="od-right">NT$ {{ item.UnitPrice?.toLocaleString() }}</span>
              <span class="od-right">{{ item.Qty }}</span>
              <span class="od-right od-item__sub">NT$ {{ item.SubTotal?.toLocaleString() }}</span>
            </div>
          </div>

          <div class="od-summary">
            <div class="od-summary__row">
              <span>商品小計</span>
              <span>NT$ {{ order.ItemsTotal?.toLocaleString() }}</span>
            </div>
            <div class="od-summary__row">
              <span>運費</span>
              <span class="od-summary__free">免運費</span>
            </div>
            <div class="od-summary__row od-summary__row--total">
              <span>訂單總計</span>
              <span>NT$ {{ order.FinalAmount?.toLocaleString() }}</span>
            </div>
          </div>
        </section>

      </div>
    </template>
  </div>
</template>

<style scoped>
.od-root {
  padding-top: 68px;
  min-height: 100vh;
  background: var(--fe-cream);
  padding-bottom: 96px;
}

.od-loading {
  display: flex;
  justify-content: center;
  padding: 120px 0;
}

.od-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.od-notfound {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 120px 24px;
  color: var(--fe-muted);
}

.od-back {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fe-text);
  text-decoration: none;
  border-bottom: 1px solid var(--fe-border);
}

/* Header */
.od-header {
  padding: 40px 24px 32px;
  text-align: center;
  max-width: 760px;
  margin: 0 auto;
}

.od-back-link {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--fe-muted);
  text-decoration: none;
  margin-bottom: 20px;
  transition: color 0.15s;
}

.od-back-link:hover { color: var(--fe-text); }

.od-eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 10px;
}

.od-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 500;
  margin: 0;
  color: var(--fe-text);
}

/* Body */
.od-body {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Card */
.od-card {
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  border-radius: 12px;
  padding: 24px 28px;
}

.od-card__title {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
  margin: 0 0 20px;
  font-weight: 500;
}

/* Info grid */
.od-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.od-info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.od-info-item--full { grid-column: 1 / -1; }

.od-info-item__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fe-muted);
}

.od-info-item__val {
  font-size: 13.5px;
  color: var(--fe-text);
}

.od-info-item__val--strong {
  font-weight: 600;
  font-size: 15px;
}

/* Status badge */
.od-pay-badge {
  font-size: 11px;
  letter-spacing: 0.05em;
  padding: 4px 12px;
  border-radius: 20px;
  width: fit-content;
  margin-top: 2px;
}

.od-pay-badge--paid    { background: rgba(34,197,94,0.12); color: #15803D; }
.od-pay-badge--pending { background: rgba(180,180,180,0.15); color: var(--fe-muted); }
.od-pay-badge--failed  { background: rgba(220,38,38,0.08); color: #DC2626; }

/* Shipping status badge */
.od-ship-badge {
  font-size: 12px;
  letter-spacing: 0.04em;
  padding: 3px 12px;
  border-radius: 20px;
  width: fit-content;
  margin-top: 2px;
  background: rgba(59, 130, 246, 0.1);
  color: #1D4ED8;
}

/* Logistics code highlight */
.od-lgsno {
  font-family: 'Courier New', monospace;
  font-size: 15px;
  letter-spacing: 0.08em;
  color: var(--fe-text);
}

/* Pickup hint */
.od-info-item__val--hint {
  font-size: 12.5px;
  color: var(--fe-muted);
  line-height: 1.6;
}

/* Items table */
.od-items__header {
  display: grid;
  grid-template-columns: 1fr 120px 90px 60px 90px;
  gap: 12px;
  padding: 0 0 10px;
  border-bottom: 1px solid var(--fe-border);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fe-muted);
}

.od-item {
  display: grid;
  grid-template-columns: 1fr 120px 90px 60px 90px;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--fe-linen);
  align-items: center;
  font-size: 13px;
  color: var(--fe-text);
}

.od-item:last-child { border-bottom: none; }

.od-item__name { font-weight: 500; line-height: 1.4; }
.od-item__variant { font-size: 12px; color: var(--fe-muted); }
.od-item__sub { font-weight: 500; }
.od-right { text-align: right; }

/* Summary */
.od-summary {
  border-top: 1px solid var(--fe-border);
  margin-top: 4px;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.od-summary__row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--fe-muted);
}

.od-summary__free { color: #15803D; font-size: 12px; }

.od-summary__row--total {
  font-size: 15px;
  font-weight: 600;
  color: var(--fe-text);
  padding-top: 4px;
}

/* ATM card */
.od-atm-card { border-color: #D97706; background: #FFFBEB; }
.od-atm-hint {
  font-size: 12.5px;
  color: #92400E;
  margin: 0 0 16px;
  line-height: 1.6;
}

/* Retry payment */
.od-retry-wrap {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--fe-linen);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.od-retry-btn {
  padding: 10px 28px;
  background: var(--fe-text);
  color: #fff;
  border: 1px solid var(--fe-text);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s, color 0.2s;
  border-radius: 2px;
}

.od-retry-btn:hover:not(:disabled) {
  background: transparent;
  color: var(--fe-text);
}

.od-retry-btn:disabled {
  background: var(--fe-linen);
  border-color: var(--fe-border);
  color: var(--fe-muted);
  cursor: not-allowed;
}

.od-retry-error {
  font-size: 13px;
  color: #DC2626;
  margin: 0;
}

.od-atm-waiting {
  font-size: 13px;
  color: #D97706;
  margin: 0;
}

/* Responsive */
@media (max-width: 600px) {
  .od-card { padding: 20px 16px; }
  .od-info-grid { grid-template-columns: 1fr; }
  .od-info-item--full { grid-column: 1; }

  .od-items__header { display: none; }

  .od-item {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 4px 12px;
  }

  .od-item__name { grid-column: 1; }
  .od-item__variant { grid-column: 1; }
  .od-item__sub { grid-column: 2; grid-row: 1; font-size: 14px; }
  .od-item > span:nth-child(3),
  .od-item > span:nth-child(4) { display: none; }
}
</style>
