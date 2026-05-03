<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
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
const address = ref('')
const customerNote = ref('')

const shippingMethod = ref('home')
const selectedStore  = ref({ id: '', name: '', addr: '' })

const paymentMethod = ref('credit')

const isSubmitting = ref(false)
const errorMsg = ref('')

// Hidden form for POST redirect to NewebPay
const paymentForm = ref(null)
const paymentParams = ref(null)

function handleStoreMessage(e) {
  console.log('[checkout] message received:', e.data)
  if (e.data?.type === 'STORE_SELECTED') {
    selectedStore.value = {
      id:   e.data.storeId   || '',
      name: e.data.storeName || '',
      addr: e.data.storeAddr || '',
    }
  }
}

async function selectStore() {
  errorMsg.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-map`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    )
    if (!res.ok) { errorMsg.value = '無法開啟門市選擇，請稍後再試'; return }
    const params = await res.json()
    if (params.error) { errorMsg.value = params.error; return }

    // Open named popup first — this sets window.opener in the child window,
    // allowing store-callback to postMessage back and close itself.
    const popup = window.open('', 'storeMapWindow', 'width=960,height=700,scrollbars=yes,resizable=yes')
    if (!popup) { errorMsg.value = '請允許瀏覽器彈出視窗後再試'; return }

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = params.url
    form.target = 'storeMapWindow'
    for (const [name, value] of Object.entries({
      UID_:          params.UID_,
      EncryptData_:  params.EncryptData_,
      HashData_:     params.HashData_,
      Version_:      params.Version_,
      RespondType_:  params.RespondType_,
    })) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  } catch (err) {
    errorMsg.value = '開啟門市選擇失敗，請稍後再試'
  }
}

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
        address.value        = d.address        || ''
        customerNote.value   = d.customerNote   || ''
        shippingMethod.value = d.shippingMethod || 'home'
        selectedStore.value  = d.selectedStore  || { id: '', name: '', addr: '' }
        paymentMethod.value  = d.paymentMethod  || 'credit'
      }
    } catch {}
    sessionStorage.removeItem('checkoutDraft')
  }

  // Handle fallback when popup was blocked — store-callback wrote to sessionStorage
  const pending = sessionStorage.getItem('pendingStore')
  if (pending) {
    try {
      const d = JSON.parse(pending)
      if (d.type === 'STORE_SELECTED') {
        selectedStore.value = { id: d.storeId || '', name: d.storeName || '', addr: d.storeAddr || '' }
        shippingMethod.value = 'cvs_711'
      }
    } catch {}
    sessionStorage.removeItem('pendingStore')
  }

  window.addEventListener('message', handleStoreMessage)

  const tasks = [prefillFromProfile()]
  if (cart.isEmpty && !cart.cartId) tasks.push(cart.fetchCart())
  await Promise.all(tasks)
  if (cart.isEmpty) router.push('/cart')
})

onUnmounted(() => {
  window.removeEventListener('message', handleStoreMessage)
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
  if (shippingMethod.value === 'home' && !address.value.trim()) {
    errorMsg.value = '請填寫收件地址'
    return
  }
  if (shippingMethod.value === 'cvs_711' && !selectedStore.value.id) {
    errorMsg.value = '請選擇取貨門市'
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
          email: auth.user.email,
          itemDesc,
          recipientName: recipientName.value.trim(),
          recipientPhone: recipientPhone.value.trim(),
          shippingAddress: address.value.trim(),
          shippingMethod: shippingMethod.value,
          storeId:   shippingMethod.value === 'cvs_711' ? selectedStore.value.id   : null,
          storeName: shippingMethod.value === 'cvs_711' ? selectedStore.value.name : null,
          paymentMethod: paymentMethod.value,
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
      address:        address.value,
      customerNote:   customerNote.value,
      shippingMethod: shippingMethod.value,
      selectedStore:  selectedStore.value,
      paymentMethod:  paymentMethod.value,
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
        <h2 class="co-section-title">收件資訊</h2>

        <div class="co-form">
          <div class="co-field">
            <label class="co-label" for="recipientName">收件人姓名 <span class="co-required">*</span></label>
            <input
              id="recipientName"
              v-model="recipientName"
              type="text"
              class="co-input"
              placeholder="請輸入姓名"
            />
          </div>

          <div class="co-field">
            <label class="co-label" for="recipientPhone">收件人電話 <span class="co-required">*</span></label>
            <input
              id="recipientPhone"
              v-model="recipientPhone"
              type="tel"
              class="co-input"
              placeholder="例：0912-345-678"
            />
          </div>

          <!-- Address (宅配) -->
          <div v-if="shippingMethod === 'home'" class="co-field co-field--full">
            <label class="co-label" for="address">收件地址 <span class="co-required">*</span></label>
            <input
              id="address"
              v-model="address"
              type="text"
              class="co-input"
              placeholder="請輸入完整收件地址"
            />
          </div>

          <!-- Store selector (7-11) -->
          <div v-else class="co-field co-field--full">
            <label class="co-label">取貨門市 <span class="co-required">*</span></label>
            <div class="co-store-row">
              <div class="co-store-display">
                <template v-if="selectedStore.id">
                  <span class="co-store-name">{{ selectedStore.name }}</span>
                  <span class="co-store-addr">{{ selectedStore.addr }}</span>
                </template>
                <span v-else class="co-store-placeholder">尚未選擇取貨門市</span>
              </div>
              <button type="button" class="co-store-btn" @click="selectStore">
                {{ selectedStore.id ? '重新選擇' : '選擇門市' }}
              </button>
            </div>
          </div>

          <div class="co-field co-field--full">
            <label class="co-label" for="customerNote">備註（選填）</label>
            <textarea
              id="customerNote"
              v-model="customerNote"
              class="co-textarea"
              rows="3"
              placeholder="如有特殊需求或備注，請在此填寫"
            ></textarea>
          </div>
        </div>

        <!-- Shipping method -->
        <h2 class="co-section-title co-pay-title">配送方式</h2>
        <div class="co-pay-methods">
          <label class="co-pay-method" :class="{ 'co-pay-method--active': shippingMethod === 'home' }">
            <input type="radio" v-model="shippingMethod" value="home" class="co-pay-radio" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <div class="co-pay-method__text">
              <span class="co-pay-method__name">宅配到府</span>
              <span class="co-pay-method__desc">填寫收件地址，到府配送</span>
            </div>
          </label>
          <label class="co-pay-method" :class="{ 'co-pay-method--active': shippingMethod === 'cvs_711' }">
            <input type="radio" v-model="shippingMethod" value="cvs_711" class="co-pay-radio" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
            <div class="co-pay-method__text">
              <span class="co-pay-method__name">7-11 取貨不付款</span>
              <span class="co-pay-method__desc">選擇取貨門市，到店取件（先付款後取貨）</span>
            </div>
          </label>
        </div>

        <!-- Payment method -->
        <h2 class="co-section-title co-pay-title">付款方式</h2>
        <div class="co-pay-methods">
          <label class="co-pay-method" :class="{ 'co-pay-method--active': paymentMethod === 'credit' }">
            <input type="radio" v-model="paymentMethod" value="credit" class="co-pay-radio" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <div class="co-pay-method__text">
              <span class="co-pay-method__name">信用卡</span>
              <span class="co-pay-method__desc">Visa / MasterCard / JCB</span>
            </div>
          </label>
          <label class="co-pay-method" :class="{ 'co-pay-method--active': paymentMethod === 'cvs' }">
            <input type="radio" v-model="paymentMethod" value="cvs" class="co-pay-radio" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
            <div class="co-pay-method__text">
              <span class="co-pay-method__name">超商代碼繳費</span>
              <span class="co-pay-method__desc">7-11 / 全家 / 萊爾富（7 天內繳費）</span>
            </div>
          </label>
          <label class="co-pay-method" :class="{ 'co-pay-method--active': paymentMethod === 'atm' }">
            <input type="radio" v-model="paymentMethod" value="atm" class="co-pay-radio" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h2m4 0h4"/></svg>
            <div class="co-pay-method__text">
              <span class="co-pay-method__name">ATM 轉帳</span>
              <span class="co-pay-method__desc">取得虛擬帳號，3 天內至 ATM 轉帳</span>
            </div>
          </label>
          <label class="co-pay-method" :class="{ 'co-pay-method--active': paymentMethod === 'webatm' }">
            <input type="radio" v-model="paymentMethod" value="webatm" class="co-pay-radio" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
            <div class="co-pay-method__text">
              <span class="co-pay-method__name">Web ATM</span>
              <span class="co-pay-method__desc">透過網路銀行即時轉帳付款</span>
            </div>
          </label>
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
          <span>運費</span>
          <span class="co-summary__free">免運費</span>
        </div>

        <div class="co-summary__divider"></div>

        <div class="co-summary__row co-summary__row--total">
          <span>訂單總計</span>
          <span>NT$ {{ cart.total.toLocaleString() }}</span>
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
  margin: 0 0 24px;
  color: var(--fe-text);
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

/* Payment methods */
.co-pay-title {
  margin-top: 32px;
  font-size: 16px;
}

.co-pay-methods {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 8px;
}

.co-pay-method {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid var(--fe-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background: var(--fe-white);
}

.co-pay-method--active {
  border-color: var(--fe-text);
  background: var(--fe-cream);
}

.co-pay-method svg { flex-shrink: 0; color: var(--fe-muted); }
.co-pay-method--active svg { color: var(--fe-text); }

.co-pay-radio { display: none; }

.co-pay-method__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.co-pay-method__name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--fe-text);
}

.co-pay-method__desc {
  font-size: 11.5px;
  color: var(--fe-muted);
}

/* Store selector */
.co-store-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--fe-border);
  border-radius: 2px;
  padding: 10px 14px;
  background: var(--fe-white);
  min-height: 44px;
}

.co-store-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.co-store-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--fe-text);
}

.co-store-addr {
  font-size: 11.5px;
  color: var(--fe-muted);
}

.co-store-placeholder {
  font-size: 13.5px;
  color: #bbb;
}

.co-store-btn {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 1px solid var(--fe-text);
  background: transparent;
  color: var(--fe-text);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s, color 0.2s;
  border-radius: 2px;
}

.co-store-btn:hover {
  background: var(--fe-text);
  color: #fff;
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

.co-summary__free {
  color: #15803D;
  font-size: 12px;
}

.co-summary__row--total {
  font-size: 15px;
  font-weight: 600;
  color: var(--fe-text);
  margin-bottom: 0;
}

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
