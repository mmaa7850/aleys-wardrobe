<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { trackBeginCheckout } from '@/lib/gtag'

const router = useRouter()
const cart   = useCartStore()
const auth   = useAuthStore()
const wallet = useWalletStore()

// ── 錢包付款 ────────────────────────────────────────────────
const useWallet   = ref(false)  // 是否使用錢包餘額
const walletDeductAmt = computed(() => {
  if (!useWallet.value || wallet.balance <= 0) return 0
  return Math.min(wallet.balance, finalTotal.value)
})
const newebpayAmt = computed(() => finalTotal.value - walletDeductAmt.value)
const isFullWallet = computed(() => newebpayAmt.value === 0)

const recipientName = ref('')
const recipientPhone = ref('')
const customerNote = ref('')

const isSubmitting = ref(false)
const submitError  = ref('')   // 送出失敗的通用錯誤
const nameError    = ref('')
const phoneError   = ref('')
const addressError = ref('')
const invoiceError = ref('')

// ── Invoice preference ────────────────────────────────
const invoiceCarrierType = ref('')   // ''=紙本 / '0'=手機條碼 / '1'=自然人憑證 / 'D'=捐贈 / 'B2B'=公司戶
const invoiceCarrierNum  = ref('')
const invoiceLoveCode    = ref('')
const invoiceBuyerUBN    = ref('')
const invoiceBuyerName   = ref('')

// ── Coupon ────────────────────────────────────────────
const couponCode = ref('')
const couponApplied = ref(null) // { ID, Name, DiscountValue, MinOrderAmount }
const couponError = ref('')
const couponLoading = ref(false)

// ── Auto-apply discounts ──────────────────────────────
const autoCoupons = ref([]) // all valid auto-apply coupons loaded on mount

const autoDiscount = computed(() => {
  const total = cart.selectedTotal
  const applicable = autoCoupons.value.filter(c => !c.MinOrderAmount || total >= c.MinOrderAmount)
  if (applicable.length === 0) return null
  return [...applicable].sort((a, b) => (b.MinOrderAmount ?? 0) - (a.MinOrderAmount ?? 0))[0]
})

const nextAutoCoupon = computed(() => {
  const total = cart.selectedTotal
  const unreached = autoCoupons.value.filter(c => c.MinOrderAmount && total < c.MinOrderAmount)
  if (unreached.length === 0) return null
  return [...unreached].sort((a, b) => a.MinOrderAmount - b.MinOrderAmount)[0]
})

const autoDiscountAmount = computed(() => autoDiscount.value?.DiscountValue ?? 0)

// ── Shipping methods ──────────────────────────────────
const shippingMethods = ref([])
const selectedMethodId = ref(null)
const shippingAddress = ref('')

const selectedMethod = computed(() => shippingMethods.value.find(m => m.ID === selectedMethodId.value) ?? null)
const shippingFee = computed(() => selectedMethod.value?.Fee ?? 0)
const isHome = computed(() => selectedMethod.value?.MethodCode === 'home')

// ── Totals ────────────────────────────────────────────
const discountAmount = computed(() => couponApplied.value?.DiscountValue ?? 0)
const finalTotal = computed(() => Math.max(1, cart.selectedTotal + shippingFee.value - discountAmount.value - autoDiscountAmount.value))

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
      .select('ID, Name, Description, DiscountValue, DiscountType, MinOrderAmount, IsActive, UsageCount')
      .eq('Name', code)
      .eq('IsAutoApply', false)
      .lte('StartDate', today)
      .gte('EndDate', today)
      .maybeSingle()
    if (error) throw error
    if (!data || !data.IsActive || data.UsageCount <= 0) { couponError.value = '優惠券無效或已過期'; return }
    if (data.MinOrderAmount && cart.selectedTotal < data.MinOrderAmount) {
      couponError.value = `此優惠券需消費滿 NT$ ${Number(data.MinOrderAmount).toLocaleString()} 才可使用`
      return
    }
    couponApplied.value = { ID: data.ID, Name: data.Name, Description: data.Description, DiscountValue: data.DiscountValue, MinOrderAmount: data.MinOrderAmount }
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
  const digits = val.replace(/[\s\-]/g, '')
  return /^0\d{8,9}$/.test(digits)
}

async function prefillFromProfile() {
  if (!auth.user?.id) return
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
  wallet.fetchBalance().catch(() => {})

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

  const today = new Date().toISOString().slice(0, 10)
  const [, , methodsResult] = await Promise.all([
    prefillFromProfile().catch(() => {}),
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

  trackBeginCheckout(cart.selectedItems, cart.selectedTotal)

  // 自動折抵獨立載入，不影響配送方式
  db.from('S_PRM_CouponList')
    .select('ID, Name, Description, DiscountValue, MinOrderAmount')
    .eq('IsActive', true)
    .eq('IsAutoApply', true)
    .lte('StartDate', today)
    .gte('EndDate', today)
    .gt('UsageCount', 0)
    .then(({ data }) => { autoCoupons.value = data ?? [] })
    .catch(() => {})
})

async function submitOrder() {
  submitError.value  = ''
  nameError.value    = ''
  phoneError.value   = ''
  addressError.value = ''
  invoiceError.value = ''

  let hasError = false

  if (!recipientName.value.trim()) {
    nameError.value = '請填寫收件人姓名'; hasError = true
  }
  if (!recipientPhone.value.trim()) {
    phoneError.value = '請填寫收件人電話'; hasError = true
  } else if (!validatePhone(recipientPhone.value)) {
    phoneError.value = '電話格式錯誤，請輸入台灣手機或市話（如 0912-345-678）'; hasError = true
  }
  if (isHome.value && !shippingAddress.value.trim()) {
    addressError.value = '請填寫收件地址'; hasError = true
  }
  if (!selectedMethod.value) {
    submitError.value = '請選擇配送方式'; hasError = true
  }
  if (invoiceCarrierType.value === '0' && !/^\/[A-Z0-9+\-.]{7}$/.test(invoiceCarrierNum.value)) {
    invoiceError.value = '手機條碼格式錯誤，應為 /XXXXXXX（斜線開頭共 8 碼）'; hasError = true
  }
  if (invoiceCarrierType.value === '1' && !/^[A-Z]{2}\d{14}$/.test(invoiceCarrierNum.value)) {
    invoiceError.value = '自然人憑證格式錯誤，應為 2 碼大寫英文 + 14 碼數字'; hasError = true
  }
  if (invoiceCarrierType.value === 'D' && !/^\d{3,7}$/.test(invoiceLoveCode.value)) {
    invoiceError.value = '捐贈碼格式錯誤，應為 3~7 碼數字'; hasError = true
  }
  if (invoiceCarrierType.value === 'B2B' && !/^\d{8}$/.test(invoiceBuyerUBN.value)) {
    invoiceError.value = '統一編號格式錯誤，應為 8 碼數字'; hasError = true
  }
  if (invoiceCarrierType.value === 'B2B' && !invoiceBuyerName.value.trim()) {
    invoiceError.value = '請填寫公司名稱'; hasError = true
  }
  if (hasError) return

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
    const itemDesc = cart.selectedItems
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
          amount: cart.selectedTotal,
          shippingFee: shippingFee.value,
          shippingMethodCode: selectedMethod.value?.MethodCode ?? 'cvscom',
          shippingAddress: isHome.value ? shippingAddress.value.trim() : '',
          couponCode: couponApplied.value?.Name ?? null,
          email: auth.user.email,
          itemDesc,
          recipientName: recipientName.value.trim(),
          recipientPhone: recipientPhone.value.trim(),
          customerNote: customerNote.value.trim() || null,
          invoiceCarrierType: invoiceCarrierType.value || null,
          invoiceCarrierNum:  ['0','1','2'].includes(invoiceCarrierType.value) ? invoiceCarrierNum.value : null,
          invoiceLoveCode:    invoiceCarrierType.value === 'D'   ? invoiceLoveCode.value  : null,
          invoiceBuyerUBN:    invoiceCarrierType.value === 'B2B' ? invoiceBuyerUBN.value  : null,
          invoiceBuyerName:   invoiceCarrierType.value === 'B2B' ? invoiceBuyerName.value : null,
          walletDeductAmt:    walletDeductAmt.value,
          items: cart.selectedItems.map(i => ({
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

    // 更新本地錢包餘額顯示
    if (walletDeductAmt.value > 0) {
      wallet.balance = Math.max(0, wallet.balance - walletDeductAmt.value)
    }

    // 全額錢包付款：不需要跳到藍新，直接導到成功頁
    if (data.walletOnly) {
      await Promise.all(cart.selectedItems.map(i => cart.removeItem(i.id)))
      router.push(`/order-success/${orderNo}`)
      return
    }

    // Save form data so it can be restored if user navigates back from NewebPay
    sessionStorage.setItem('checkoutDraft', JSON.stringify({
      _ts:            Date.now(),
      recipientName:  recipientName.value,
      recipientPhone: recipientPhone.value,
      customerNote:   customerNote.value,
    }))

    // Remove only the selected items from cart (pre-order items remain)
    await Promise.all(cart.selectedItems.map(i => cart.removeItem(i.id)))

    // Set hidden form params and submit to NewebPay
    paymentParams.value = data
    await nextTick()
    paymentForm.value.submit()

  } catch (err) {
    console.error('[checkout] submitOrder error:', err)
    submitError.value = '訂單送出失敗，請稍後再試。'
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
              :class="{ 'co-input--error': nameError }"
              placeholder="請輸入姓名"
              @input="nameError = ''"
            />
            <p v-if="nameError" class="co-field-error">{{ nameError }}</p>
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
              :class="{ 'co-input--error': phoneError }"
              placeholder="例：0912-345-678"
              @input="phoneError = ''"
            />
            <p v-if="phoneError" class="co-field-error">{{ phoneError }}</p>
          </div>

          <!-- Address: only for home delivery -->
          <div v-if="isHome" class="co-field co-field--full">
            <label class="co-label" for="shippingAddress">收件地址 <span class="co-required">*</span></label>
            <input
              id="shippingAddress"
              v-model="shippingAddress"
              type="text"
              class="co-input"
              :class="{ 'co-input--error': addressError }"
              placeholder="例：台北市中山區中山北路一段100號5樓"
              @input="addressError = ''"
            />
            <p v-if="addressError" class="co-field-error">{{ addressError }}</p>
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

        <!-- Invoice preference -->
        <h2 class="co-section-title co-section-title--mt">發票資訊</h2>
        <div class="co-invoice">
          <label class="co-invoice-opt" :class="{ 'co-invoice-opt--active': invoiceCarrierType === '' }">
            <input type="radio" v-model="invoiceCarrierType" value="" class="co-invoice-radio" />
            <span class="co-invoice-opt__label">紙本電子發票</span>
          </label>

          <label class="co-invoice-opt" :class="{ 'co-invoice-opt--active': invoiceCarrierType === '0' }">
            <input type="radio" v-model="invoiceCarrierType" value="0" class="co-invoice-radio" />
            <span class="co-invoice-opt__label">手機條碼載具</span>
          </label>
          <div v-if="invoiceCarrierType === '0'" class="co-invoice-input-wrap">
            <input
              v-model="invoiceCarrierNum"
              type="text"
              class="co-input co-invoice-input"
              placeholder="/XXXXXXX（斜線開頭，共 8 碼大寫英數）"
              maxlength="8"
            />
            <p v-if="invoiceError" class="co-invoice-error">{{ invoiceError }}</p>
          </div>

          <label class="co-invoice-opt" :class="{ 'co-invoice-opt--active': invoiceCarrierType === '1' }">
            <input type="radio" v-model="invoiceCarrierType" value="1" class="co-invoice-radio" />
            <span class="co-invoice-opt__label">自然人憑證載具</span>
          </label>
          <div v-if="invoiceCarrierType === '1'" class="co-invoice-input-wrap">
            <input
              v-model="invoiceCarrierNum"
              type="text"
              class="co-input co-invoice-input"
              placeholder="2 碼大寫英文 + 14 碼數字，共 16 碼"
              maxlength="16"
            />
            <p v-if="invoiceError" class="co-invoice-error">{{ invoiceError }}</p>
          </div>

          <label class="co-invoice-opt" :class="{ 'co-invoice-opt--active': invoiceCarrierType === 'D' }">
            <input type="radio" v-model="invoiceCarrierType" value="D" class="co-invoice-radio" />
            <span class="co-invoice-opt__label">捐贈發票</span>
          </label>
          <div v-if="invoiceCarrierType === 'D'" class="co-invoice-input-wrap">
            <input
              v-model="invoiceLoveCode"
              type="text"
              class="co-input co-invoice-input"
              placeholder="捐贈碼（3~7 碼數字）"
              maxlength="7"
            />
            <p v-if="invoiceError" class="co-invoice-error">{{ invoiceError }}</p>
          </div>

          <label class="co-invoice-opt" :class="{ 'co-invoice-opt--active': invoiceCarrierType === 'B2B' }">
            <input type="radio" v-model="invoiceCarrierType" value="B2B" class="co-invoice-radio" />
            <span class="co-invoice-opt__label">公司戶（三聯式發票）</span>
          </label>
          <div v-if="invoiceCarrierType === 'B2B'" class="co-invoice-input-wrap co-invoice-b2b">
            <input
              v-model="invoiceBuyerUBN"
              type="text"
              class="co-input co-invoice-input"
              placeholder="統一編號（8 碼數字）"
              maxlength="8"
            />
            <input
              v-model="invoiceBuyerName"
              type="text"
              class="co-input co-invoice-input"
              placeholder="公司名稱"
            />
            <p v-if="invoiceError" class="co-invoice-error">{{ invoiceError }}</p>
          </div>
        </div>

        <!-- 錢包付款 -->
        <h2 class="co-section-title co-section-title--mt">錢包餘額</h2>
        <div class="co-wallet">
          <div class="co-wallet__info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>錢包餘額：<strong>NT$ {{ wallet.balance.toLocaleString() }}</strong></span>
          </div>
          <label v-if="wallet.balance > 0" class="co-wallet__toggle">
            <input type="checkbox" v-model="useWallet" />
            <span>使用錢包餘額付款</span>
          </label>
          <div v-if="useWallet && wallet.balance > 0" class="co-wallet__breakdown">
            <div class="co-wallet__row">
              <span>錢包扣款</span>
              <span class="co-wallet__deduct">－NT$ {{ walletDeductAmt.toLocaleString() }}</span>
            </div>
            <div class="co-wallet__row" v-if="!isFullWallet">
              <span>藍新付款</span>
              <span>NT$ {{ newebpayAmt.toLocaleString() }}</span>
            </div>
            <div v-if="isFullWallet" class="co-wallet__full-badge">
              ✓ 全額由錢包支付，無需進入藍新付款
            </div>
          </div>
        </div>

        <!-- Notice -->
        <div class="co-notice">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span v-if="isHome">送出後將進入藍新金流付款頁面，選擇付款方式（信用卡、ATM 轉帳）完成付款後由黑貓宅急便配送至指定地址。</span>
          <span v-else>送出後將進入藍新金流付款頁面，可選擇付款方式（信用卡、ATM 轉帳）並在該頁面選擇超商取貨門市。</span>
        </div>

        <!-- 送出失敗通用錯誤 -->
        <div v-if="submitError" class="co-error">
          {{ submitError }}
        </div>

        <!-- Submit (mobile) -->
        <button
          class="co-submit-btn co-submit-mobile"
          :disabled="isSubmitting"
          @click="submitOrder"
        >
          <span v-if="isSubmitting">處理中...</span>
          <span v-else-if="isFullWallet">確認送出訂單（全額錢包）</span>
          <span v-else>確認送出訂單</span>
        </button>
      </div>

      <!-- Right: order summary -->
      <div class="co-summary">
        <h2 class="co-section-title">訂單摘要</h2>

        <div class="co-summary-items">
          <div v-for="item in cart.selectedItems" :key="item.id" class="co-summary-item">
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
          <span>NT$ {{ cart.selectedTotal.toLocaleString() }}</span>
        </div>
        <div class="co-summary__row">
          <span>{{ selectedMethod ? selectedMethod.Name : '運費' }}</span>
          <span>NT$ {{ shippingFee.toLocaleString() }}</span>
        </div>

        <!-- 自動折抵 -->
        <div v-if="autoCoupons.length > 0" class="co-autodiscount">
          <template v-if="autoDiscount">
            <div class="co-autodiscount__hit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              消費滿 NT$ {{ Number(autoDiscount.MinOrderAmount).toLocaleString() }}，已自動折抵 NT$ {{ autoDiscountAmount.toLocaleString() }}
            </div>
          </template>
          <template v-else-if="nextAutoCoupon">
            <div class="co-autodiscount__progress">
              <div class="co-autodiscount__bar-wrap">
                <div class="co-autodiscount__bar" :style="{ width: Math.min(100, Math.floor(cart.selectedTotal / nextAutoCoupon.MinOrderAmount * 100)) + '%' }"></div>
              </div>
              <span>再消費 NT$ {{ (nextAutoCoupon.MinOrderAmount - cart.selectedTotal).toLocaleString() }} 可折抵 NT$ {{ nextAutoCoupon.DiscountValue.toLocaleString() }}</span>
            </div>
          </template>
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
            <p v-if="couponApplied.MinOrderAmount" class="co-coupon__min">
              滿 NT$ {{ Number(couponApplied.MinOrderAmount).toLocaleString() }} 可使用
            </p>
          </template>
        </div>

        <div v-if="autoDiscountAmount > 0" class="co-summary__row co-summary__row--discount">
          <span>滿額自動折抵</span>
          <span>－NT$ {{ autoDiscountAmount.toLocaleString() }}</span>
        </div>
        <div v-if="couponApplied" class="co-summary__row co-summary__row--discount">
          <span>優惠券折扣</span>
          <span>－NT$ {{ discountAmount.toLocaleString() }}</span>
        </div>

        <div class="co-summary__divider"></div>

        <div class="co-summary__row co-summary__row--total">
          <span>訂單總計</span>
          <span>NT$ {{ finalTotal.toLocaleString() }}</span>
        </div>
        <template v-if="useWallet && walletDeductAmt > 0">
          <div class="co-summary__row co-summary__row--discount">
            <span>錢包扣款</span>
            <span>－NT$ {{ walletDeductAmt.toLocaleString() }}</span>
          </div>
          <div class="co-summary__row co-summary__row--total">
            <span>{{ isFullWallet ? '實際付款' : '藍新付款' }}</span>
            <span>NT$ {{ newebpayAmt.toLocaleString() }}</span>
          </div>
        </template>

        <!-- Submit (desktop) -->
        <button
          class="co-submit-btn"
          :disabled="isSubmitting"
          @click="submitOrder"
        >
          <span v-if="isSubmitting">處理中...</span>
          <span v-else-if="isFullWallet">確認送出訂單（全額錢包）</span>
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

.co-input--error { border-color: #DC2626 !important; }

.co-field-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #DC2626;
}

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

/* Invoice */
.co-invoice {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.co-invoice-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1.5px solid var(--fe-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background: var(--fe-white);
}

.co-invoice-opt--active {
  border-color: var(--fe-text);
  background: var(--fe-cream);
}

.co-invoice-radio {
  accent-color: var(--fe-text);
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  cursor: pointer;
}

.co-invoice-opt__label {
  font-size: 13px;
  color: var(--fe-text);
}

.co-invoice-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px 14px;
  background: var(--fe-cream);
  border: 1px solid var(--fe-border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  margin-top: -4px;
}

.co-invoice-b2b { gap: 8px; }

.co-invoice-input { height: 40px; font-size: 13px; }

.co-invoice-error {
  margin: 2px 0 0;
  font-size: 12px;
  color: #DC2626;
}

/* 錢包付款 */
.co-wallet { display: flex; flex-direction: column; gap: 10px; }
.co-wallet__info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: #f5f3ff;
  border-radius: 12px;
  font-size: 14px;
  color: #4c1d95;
}
.co-wallet__info strong { font-weight: 700; }
.co-wallet__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
}
.co-wallet__toggle input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #7c3aed; }
.co-wallet__breakdown {
  background: #fafafa;
  border: 1px solid rgba(124,58,237,.15);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.co-wallet__row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: rgba(31,41,55,.7);
}
.co-wallet__deduct { color: #7c3aed; font-weight: 600; }
.co-wallet__full-badge {
  background: #d1fae5;
  color: #065f46;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
}

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

/* Auto discount */
.co-autodiscount {
  margin: 12px 0 4px;
  font-size: 12px;
}

.co-autodiscount__hit {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(21, 128, 61, 0.07);
  border: 1px solid rgba(21, 128, 61, 0.2);
  color: #15803D;
  border-radius: 3px;
}

.co-autodiscount__progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(200, 168, 130, 0.1);
  border: 1px solid var(--fe-border);
  border-radius: 3px;
  color: var(--fe-muted);
}

.co-autodiscount__bar-wrap {
  height: 3px;
  background: var(--fe-linen);
  border-radius: 2px;
  overflow: hidden;
}

.co-autodiscount__bar {
  height: 100%;
  background: var(--fe-gold);
  border-radius: 2px;
  transition: width 0.4s ease;
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

.co-coupon__min {
  margin: 5px 0 0;
  font-size: 11px;
  color: var(--fe-muted);
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
