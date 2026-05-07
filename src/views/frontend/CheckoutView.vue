<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const cart = useCartStore()
const auth = useAuthStore()

const recipientName = ref('')
const recipientPhone = ref('')
const customerNote = ref('')

const isSubmitting = ref(false)
const errorMsg = ref('')

// ── Coupon ────────────────────────────────────────────
const couponCode = ref('')
const couponApplied = ref(null) // { ID, Name, DiscountValue }
const couponError = ref('')
const couponLoading = ref(false)

// ── Shipping methods ──────────────────────────────────
const shippingMethods = ref([])
const selectedMethodId = ref(null)
const shippingAddress = ref('')

const selectedMethod = computed(() => shippingMethods.value.find(m => m.ID === selectedMethodId.value) ?? null)
const shippingFee = computed(() => selectedMethod.value?.Fee ?? 0)
const isHome = computed(() => selectedMethod.value?.MethodCode === 'home')

// ── Coupon / totals ───────────────────────────────────
const discountAmount = computed(() => couponApplied.value?.DiscountValue ?? 0)
const finalTotal = computed(() => Math.max(1, cart.total + shippingFee.value - discountAmount.value))

async function applyCoupon() {
  const code = couponCode.value.trim()
  if (!code) return
  couponLoading.value = true
  couponError.value = ''
  couponApplied.value = null
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await db
      .from('S_PRM_CouponList')
      .select('ID, Name, Description, DiscountValue, IsActive, UsageCount')
      .eq('Name', code)
      .lte('StartDate', today)
      .gte('EndDate', today)
      .maybeSingle()
    if (error) throw error
    if (!data || !data.IsActive || data.UsageCount <= 0) { couponError.value = '優惠券無效或已過期'; return }
    couponApplied.value = { ID: data.ID, Name: data.Name, Description: data.Description, DiscountValue: data.DiscountValue }
  } catch {
    couponError.value = '驗證失敗，請稍後再試'
  } finally {
    couponLoading.value = false
  }
}

function removeCoupon() {
  couponApplied.value = null
  couponCode.value = ''
  couponError.value = ''
}

// Hidden form for POST redirect to NewebPay
const paymentForm = ref(null)
const paymentParams = ref(null)

function validatePhone(val) {
  return /^[\d\-]+$/.test(val)
}

async function prefillFromProfile() {
  const { data } = await db
    .from('C_MBR_MemberList')
    .select('Name, Phone')
    .eq('UserID', auth.user.id)
    .maybeSingle()
  if (data?.Name)  recipientName.value  = data.Name
  if (data?.Phone) recipientPhone.value = data.Phone
}

onMounted(async () => {
  if (!auth.isLoggedIn) { router.push('/login'); return }

  // Restore form data if user navigated back from NewebPay within 30 minutes
  const savedForm = sessionStorage.getItem('checkoutDraft')
  if (savedForm) {
    try {
      const d = JSON.parse(savedForm)
      const age = Date.now() - (d._ts || 0)
      if (age < 30 * 60 * 1000) {
        recipientName.value  = d.recipientName  || ''
        recipientPhone.value = d.recipientPhone || ''
        customerNote.value   = d.customerNote   || ''
      }
    } catch {}
    sessionStorage.removeItem('checkoutDraft')
  }

  const [, , methodsResult] = await Promise.all([
    prefillFromProfile(),
    cart.isEmpty && !cart.cartId ? cart.fetchCart() : Promise.resolve(),
    db.from('S_SHP_ShippingMethodList')
      .select('ID, Name, Description, Fee, MethodCode, IsActive')
      .eq('IsActive', true)
      .order('ID'),
  ])
  if (methodsResult.data?.length) {
    shippingMethods.value = methodsResult.data
    selectedMethodId.value = methodsResult.data[0].ID
  }
  if (cart.isEmpty) router.push('/cart')
})

async function submitOrder() {
  errorMsg.value = ''

  if (!recipientName.value.trim()) {
    errorMsg.value = '請填寫收件人姓名'
    return
  }
  if (!recipientPhone.value.trim()) {
    errorMsg.value = '請填寫收件人電話'
    return
  }
  if (!validatePhone(recipientPhone.value)) {
    errorMsg.value = '電話格式錯誤，請只輸入數字和連字號'
    return
  }
  if (isHome.value && !shippingAddress.value.trim()) {
    errorMsg.value = '請填寫收件地址'
    return
  }
  if (!selectedMethod.value) {
    errorMsg.value = '請選擇配送方式'
    return
  }

  isSubmitting.value = true

  try {
    // Generate order number: AW-YYYYMMDD-XXXXX
    const now = new Date()
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    const orderNo = `AW_${dateStr}_${rand}`

    // Build item description (max 50 chars for NewebPay)
    const itemDesc = cart.items
      .map(i => i.productName)
      .join('、')
      .slice(0, 50)

    // Call Edge Function to create order in DB + get encrypted payment params
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderNo,
          amount: cart.total,
          shippingFee: shippingFee.value,
          shippingMethodCode: selectedMethod.value?.MethodCode ?? 'cvscom',
          shippingAddress: isHome.value ? shippingAddress.value.trim() : '',
          couponCode: couponApplied.value?.Name ?? null,
          email: auth.user.email,
          itemDesc,
          recipientName: recipientName.value.trim(),
          recipientPhone: recipientPhone.value.trim(),
          customerNote: customerNote.value.trim() || null,
          items: cart.items.map(i => ({
            productId: i.productId,
            productName: i.productName,
            variantId: i.variantId,
            colorName: i.colorName,
            sizeName: i.sizeName,
            unitPrice: i.unitPrice,
            qty: i.qty,
          })),
        }),
      }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `HTTP ${res.status}`)
    }

    const data = await res.json()

    // Save form data so it can be restored if user navigates back from NewebPay
    sessionStorage.setItem('checkoutDraft', JSON.stringify({
      _ts:            Date.now(),
      recipientName:  recipientName.value,
      recipientPhone: recipientPhone.value,
      customerNote:   customerNote.value,
    }))

    // Clear cart before redirect
    await cart.clearCart()

    // Set hidden form params and submit to NewebPay
    paymentParams.value = data
    await nextTick()
    paymentForm.value.submit()

  } catch (err) {
    console.error('[checkout] submitOrder error:', err)
    errorMsg.value = '訂單送出失敗，請稍後再試。'
    isSubmitting.value = false
  }
}

</script>

<template>
  <!-- Hidden form that POSTs to NewebPay -->
  <form
    v-if="paymentParams"
    ref="paymentForm"
    :action="paymentParams.gatewayUrl"
    method="POST"
    style="display:none"
  >
    <input type="hidden" name="MerchantID" :value="paymentParams.MerchantID" />
    <input type="hidden" name="TradeInfo" :value="paymentParams.TradeInfo" />
    <input type="hidden" name="TradeSha" :value="paymentParams.TradeSha" />
    <input type="hidden" name="TimeStamp" :value="paymentParams.TimeStamp" />
    <input type="hidden" name="Version" :value="paymentParams.Version" />
    <input type="hidden" name="MerchantOrderNo" :value="paymentParams.MerchantOrderNo" />
  </form>

  <div class="co-root">
    <div class="co-header">
      <p class="co-header__eyebrow">Checkout</p>
      <h1 class="co-header__title">結帳</h1>
    </div>

    <div v-if="cart.isLoading" class="co-loading">
      <div class="co-spinner"></div>
    </div>

    <div v-else class="co-layout">

      <!-- Left: form -->
      <div class="co-form-wrap">

        <!-- Shipping method -->
        <h2 class="co-section-title">配送方式</h2>
        <div v-if="shippingMethods.length === 0" class="co-notice">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>載入配送方式中...</span>
        </div>
        <div v-else class="co-shipping-methods">
          <label
            v-for="m in shippingMethods"
            :key="m.ID"
            class="co-shipping-card"
            :class="{ 'co-shipping-card--active': selectedMethodId === m.ID }"
          >
            <input type="radio" :value="m.ID" v-model="selectedMethodId" class="co-shipping-radio" />
            <div class="co-shipping-card__body">
              <span class="co-shipping-card__name">{{ m.Name }}</span>
              <span class="co-shipping-card__desc">{{ m.Description }}</span>
            </div>
            <span class="co-shipping-card__fee">NT$ {{ m.Fee }}</span>
          </label>
        </div>

        <!-- Recipient info -->
        <h2 class="co-section-title co-section-title--mt">{{ isHome ? '收件資訊' : '訂購人資訊' }}</h2>

        <div class="co-form">
          <div class="co-field">
            <label class="co-label" for="recipientName">
              {{ isHome ? '收件人姓名' : '訂購人姓名' }} <span class="co-required">*</span>
            </label>
            <input
              id="recipientName"
              v-model="recipientName"
              type="text"
              class="co-input"
              placeholder="請輸入姓名"
            />
          </div>

          <div class="co-field">
            <label class="co-label" for="recipientPhone">
              {{ isHome ? '收件人電話' : '訂購人電話' }} <span class="co-required">*</span>
            </label>
            <input
              id="recipientPhone"
              v-model="recipientPhone"
              type="tel"
              class="co-input"
              placeholder="例：0912-345-678"
            />
          </div>

          <!-- Address: only for home delivery -->
          <div v-if="isHome" class="co-field co-field--full">
            <label class="co-label" for="shippingAddress">收件地址 <span class="co-required">*</span></label>
            <input
              id="shippingAddress"
              v-model="shippingAddress"
              type="text"
              class="co-input"
              placeholder="例：台北市中山區中山北路一段100號5樓"
            />
          </div>

          <div class="co-field co-field--full">
            <label class="co-label" for="customerNote">備註（選填）</label>
            <textarea
              id="customerNote"
              v-model="customerNote"
              class="co-textarea"
              rows="3"
              :placeholder="isHome ? '如有到貨時間需求、樓層備注等請填寫' : '如有特殊需求或備注，請在此填寫'"
            ></textarea>
          </div>
        </div>

        <!-- Notice -->
        <div class="co-notice">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span v-if="isHome">送出後將進入藍新金流付款頁面，選擇付款方式（信用卡、ATM 轉帳）完成付款後由黑貓宅急便配送至指定地址。</span>
          <span v-else>送出後將進入藍新金流付款頁面，可選擇付款方式（信用卡、ATM 轉帳）並在該頁面選擇超商取貨門市。</span>
        </div>

        <!-- Error message -->
        <div v-if="errorMsg" class="co-error">
          {{ errorMsg }}
        </div>

        <!-- Submit (mobile) -->
        <button
          class="co-submit-btn co-submit-mobile"
          :disabled="isSubmitting"
          @click="submitOrder"
        >
          <span v-if="isSubmitting">處理中...</span>
          <span v-else>確認送出訂單</span>
        </button>
      </div>

      <!-- Right: order summary -->
      <div class="co-summary">
        <h2 class="co-section-title">訂單摘要</h2>

        <div class="co-summary-items">
          <div v-for="item in cart.items" :key="item.id" class="co-summary-item">
            <div class="co-summary-item__img-outer">
              <div class="co-summary-item__img-wrap">
                <video
                  v-if="item.imgUrl && item.imgType === 'video'"
                  :src="item.imgUrl"
                  class="co-summary-item__img"
                  muted
                  preload="metadata"
                />
                <img
                  v-else-if="item.imgUrl"
                  :src="item.imgUrl"
                  :alt="item.productName"
                  class="co-summary-item__img"
                />
                <div v-else class="co-summary-item__no-img"></div>
              </div>
              <span class="co-summary-item__qty-badge">{{ item.qty }}</span>
            </div>
            <div class="co-summary-item__info">
              <p class="co-summary-item__name">{{ item.productName }}</p>
              <p class="co-summary-item__variant">
                <span v-if="item.colorName">{{ item.colorName }}</span>
                <span v-if="item.colorName && item.sizeName"> / </span>
                <span v-if="item.sizeName">{{ item.sizeName }}</span>
              </p>
            </div>
            <div class="co-summary-item__subtotal">
              NT$ {{ (item.unitPrice * item.qty).toLocaleString() }}
            </div>
          </div>
        </div>

        <div class="co-summary__divider"></div>

        <div class="co-summary__row">
          <span>商品小計</span>
          <span>NT$ {{ cart.total.toLocaleString() }}</span>
        </div>
        <div class="co-summary__row">
          <span>{{ selectedMethod ? selectedMethod.Name : '運費' }}</span>
          <span>NT$ {{ shippingFee.toLocaleString() }}</span>
        </div>

        <!-- 優惠券 -->
        <div class="co-coupon">
          <template v-if="!couponApplied">
            <div class="co-coupon__row">
              <input
                v-model="couponCode"
                class="co-coupon__input"
                placeholder="輸入優惠碼"
                :disabled="couponLoading"
                @keydown.enter.prevent="applyCoupon"
              />
              <button
                class="co-coupon__btn"
                :disabled="couponLoading || !couponCode.trim()"
                @click="applyCoupon"
              >{{ couponLoading ? '…' : '套用' }}</button>
            </div>
            <p v-if="couponError" class="co-coupon__error">{{ couponError }}</p>
          </template>
          <template v-else>
            <div class="co-coupon__applied">
              <span class="co-coupon__tag">{{ couponApplied.Name }}</span>
              <button class="co-coupon__remove" @click="removeCoupon">✕</button>
            </div>
          </template>
        </div>

        <div v-if="couponApplied" class="co-summary__row co-summary__row--discount">
          <span>折扣</span>
          <span>－NT$ {{ discountAmount.toLocaleString() }}</span>
        </div>

        <div class="co-summary__divider"></div>

        <div class="co-summary__row co-summary__row--total">
          <span>訂單總計</span>
          <span>NT$ {{ finalTotal.toLocaleString() }}</span>
        </div>

        <!-- Submit (desktop) -->
        <button
          class="co-submit-btn"
          :disabled="isSubmitting"
          @click="submitOrder"
        >
          <span v-if="isSubmitting">處理中...</span>
          <span v-else>確認送出訂單</span>
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.co-root {
  padding-top: 68px;
  min-height: 80vh;
  max-width: 1100px;
  margin: 0 auto;
  padding-left: 36px;
  padding-right: 36px;
  padding-bottom: 96px;
}

/* Header */
.co-header {
  padding: 48px 0 40px;
  text-align: center;
}

.co-header__eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 10px;
}

.co-header__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 500;
  margin: 0;
  color: var(--fe-text);
}

/* Loading */
.co-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40vh;
}

.co-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Layout */
.co-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 48px;
  align-items: start;
}

/* Section title */
.co-section-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 16px;
  color: var(--fe-text);
}

.co-section-title--mt { margin-top: 36px; }

/* Shipping method cards */
.co-shipping-methods {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 4px;
}

.co-shipping-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1.5px solid var(--fe-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background: var(--fe-white);
}

.co-shipping-card--active {
  border-color: var(--fe-text);
  background: var(--fe-cream);
}

.co-shipping-radio {
  accent-color: var(--fe-text);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.co-shipping-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.co-shipping-card__name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--fe-text);
  letter-spacing: 0.02em;
}

.co-shipping-card__desc {
  font-size: 12px;
  color: var(--fe-muted);
  line-height: 1.5;
}

.co-shipping-card__fee {
  font-size: 14px;
  font-weight: 600;
  color: var(--fe-text);
  white-space: nowrap;
}

/* Form */
.co-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 20px;
}

.co-field { display: flex; flex-direction: column; gap: 6px; }
.co-field--full { grid-column: 1 / -1; }

.co-label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
}

.co-required { color: #DC2626; }

.co-input {
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--fe-border);
  background: var(--fe-white);
  font-size: 13.5px;
  color: var(--fe-text);
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
  border-radius: 2px;
}

.co-input:focus { border-color: var(--fe-text); }

.co-textarea {
  padding: 12px 14px;
  border: 1px solid var(--fe-border);
  background: var(--fe-white);
  font-size: 13.5px;
  color: var(--fe-text);
  outline: none;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s;
  border-radius: 2px;
}

.co-textarea:focus { border-color: var(--fe-text); }

/* NewebPay notice */
.co-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 24px;
  padding: 12px 16px;
  background: var(--fe-cream);
  border: 1px solid var(--fe-border);
  border-radius: 4px;
  color: var(--fe-muted);
  font-size: 12.5px;
  line-height: 1.5;
}

.co-notice svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--fe-gold-d);
}

/* Error */
.co-error {
  margin-top: 20px;
  padding: 12px 16px;
  background: rgba(220, 38, 38, 0.06);
  border: 1px solid rgba(220, 38, 38, 0.2);
  color: #DC2626;
  font-size: 13px;
  border-radius: 4px;
}

/* Submit button */
.co-submit-btn {
  width: 100%;
  margin-top: 24px;
  padding: 15px;
  background: var(--fe-text);
  color: #fff;
  border: 1px solid var(--fe-text);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  font-family: inherit;
}

.co-submit-btn:hover:not(:disabled) {
  background: transparent;
  color: var(--fe-text);
}

.co-submit-btn:disabled {
  background: var(--fe-linen);
  border-color: var(--fe-border);
  color: var(--fe-muted);
  cursor: not-allowed;
}

.co-submit-mobile { display: none; }

/* Summary */
.co-summary {
  position: sticky;
  top: 88px;
  background: var(--fe-cream);
  padding: 28px 24px;
  border: 1px solid var(--fe-border);
}

.co-summary-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 4px;
}

.co-summary-item {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 12px;
  align-items: center;
}

.co-summary-item__img-outer {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.co-summary-item__img-wrap {
  width: 52px;
  height: 52px;
  background: var(--fe-linen);
  overflow: hidden;
}

.co-summary-item__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.co-summary-item__no-img {
  width: 100%;
  height: 100%;
  background: var(--fe-linen);
}

.co-summary-item__qty-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background: var(--fe-text);
  color: #fff;
  font-size: 10px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.co-summary-item__name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 3px;
  line-height: 1.4;
}

.co-summary-item__variant {
  font-size: 11px;
  color: var(--fe-muted);
  margin: 0;
}

.co-summary-item__subtotal {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fe-text);
  white-space: nowrap;
}

.co-summary__divider {
  height: 1px;
  background: var(--fe-border);
  margin: 16px 0;
}

.co-summary__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--fe-muted);
  margin-bottom: 10px;
}


.co-summary__row--total {
  font-size: 15px;
  font-weight: 600;
  color: var(--fe-text);
  margin-bottom: 0;
}

.co-summary__row--discount {
  color: #15803D;
}

/* Coupon */
.co-coupon {
  margin: 12px 0 4px;
}

.co-coupon__row {
  display: flex;
  gap: 8px;
}

.co-coupon__input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--fe-border);
  background: var(--fe-white);
  font-size: 12.5px;
  color: var(--fe-text);
  font-family: inherit;
  outline: none;
  border-radius: 2px;
  transition: border-color 0.2s;
}

.co-coupon__input:focus { border-color: var(--fe-text); }

.co-coupon__btn {
  height: 36px;
  padding: 0 14px;
  background: var(--fe-text);
  color: #fff;
  border: none;
  font-size: 12px;
  letter-spacing: 0.05em;
  cursor: pointer;
  font-family: inherit;
  border-radius: 2px;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.co-coupon__btn:disabled { opacity: 0.4; cursor: not-allowed; }

.co-coupon__error {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: #DC2626;
}

.co-coupon__applied {
  display: flex;
  align-items: center;
  gap: 8px;
}

.co-coupon__tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(21, 128, 61, 0.08);
  border: 1px solid rgba(21, 128, 61, 0.25);
  color: #15803D;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: 2px;
}

.co-coupon__remove {
  background: none;
  border: none;
  color: var(--fe-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  transition: color 0.15s;
}

.co-coupon__remove:hover { color: #DC2626; }

/* Responsive */
@media (max-width: 767px) {
  .co-root {
    padding-left: 16px;
    padding-right: 16px;
  }

  .co-layout {
    grid-template-columns: 1fr;
    gap: 0;
  }

  /* On mobile: summary comes first, then form */
  .co-summary {
    position: static;
    order: -1;
    margin-bottom: 32px;
  }

  .co-summary .co-submit-btn { display: none; }
  .co-submit-mobile { display: block; }

  .co-form {
    grid-template-columns: 1fr;
  }

  .co-field--full { grid-column: 1; }
}
</style>
