<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db'

const route  = useRoute()
const wallet = useWalletStore()
const auth   = useAuthStore()

// ── 儲值後跳轉提示 ────────────────────────────────────────
const topupResult = ref(null) // 'success' | 'fail' | null

// ── 儲值表單 ──────────────────────────────────────────────
const showTopupForm   = ref(false)
const topupAmount     = ref('')
const topupSubmitting = ref(false)
const topupError      = ref('')

// 發票設定
const invoiceCarrierType = ref('')
const invoiceCarrierNum  = ref('')
const invoiceLoveCode    = ref('')
const invoiceBuyerUBN    = ref('')

// 藍新付款用 hidden form
const payForm   = ref(null)
const payParams = ref(null)

onMounted(async () => {
  if (!auth.isLoggedIn) return

  // 儲值結果提示
  if (route.query.topup === 'success') {
    topupResult.value = 'success'
    // 稍等藍新 notify 完成後重新載入餘額
    setTimeout(() => wallet.fetchBalance(), 2000)
  } else if (route.query.topup === 'fail') {
    topupResult.value = 'fail'
  }

  await Promise.all([wallet.fetchBalance(), wallet.fetchTransactions()])

  // 預填發票偏好（從會員資料）
  const { data } = await db
    .from('C_MBR_MemberList')
    .select('InvoiceCarrierType, InvoiceCarrierNum, InvoiceLoveCode, InvoiceBuyerUBN')
    .eq('UserID', auth.user.id)
    .maybeSingle()
  if (data) {
    invoiceCarrierType.value = data.InvoiceCarrierType ?? ''
    invoiceCarrierNum.value  = data.InvoiceCarrierNum  ?? ''
    invoiceLoveCode.value    = data.InvoiceLoveCode    ?? ''
    invoiceBuyerUBN.value    = data.InvoiceBuyerUBN    ?? ''
  }
})

function txTypeLabel(type) {
  const map = { topup: '儲值', order_deduct: '消費扣款', refund: '退款', adjust: '管理員調整' }
  return map[type] || type
}

function txTypeClass(type) {
  return ['topup', 'refund', 'adjust'].includes(type) ? 'tx--credit' : 'tx--debit'
}

async function submitTopup() {
  topupError.value = ''
  const amt = Number(topupAmount.value)
  if (!amt || amt < 1 || !Number.isInteger(amt)) {
    topupError.value = '請輸入有效的儲值金額（正整數）'
    return
  }
  if (invoiceCarrierType.value === '0' && !/^\/[A-Z0-9+\-.]{7}$/.test(invoiceCarrierNum.value)) {
    topupError.value = '手機條碼格式錯誤，應為 /XXXXXXX'
    return
  }
  if (invoiceCarrierType.value === 'D' && !/^\d{3,7}$/.test(invoiceLoveCode.value)) {
    topupError.value = '捐贈碼格式錯誤，應為 3~7 碼數字'
    return
  }
  if (invoiceCarrierType.value === 'B2B' && !/^\d{8}$/.test(invoiceBuyerUBN.value)) {
    topupError.value = '統一編號格式錯誤，應為 8 碼數字'
    return
  }

  topupSubmitting.value = true
  try {
    const data = await wallet.topup({
      amount:             amt,
      invoiceCarrierType: invoiceCarrierType.value || null,
      invoiceCarrierNum:  ['0', '1'].includes(invoiceCarrierType.value) ? invoiceCarrierNum.value : null,
      invoiceLoveCode:    invoiceCarrierType.value === 'D'   ? invoiceLoveCode.value : null,
      invoiceBuyerUBN:    invoiceCarrierType.value === 'B2B' ? invoiceBuyerUBN.value : null,
    })
    payParams.value = data
    await nextTick()
    payForm.value?.submit()
  } catch (e) {
    topupError.value = e?.message || '儲值失敗，請稍後再試'
    topupSubmitting.value = false
  }
}
</script>

<template>
  <div class="wallet-page">
    <!-- 儲值結果提示 -->
    <div v-if="topupResult === 'success'" class="alert alert--success">
      🎉 儲值成功！餘額將於幾秒內更新。
    </div>
    <div v-if="topupResult === 'fail'" class="alert alert--error">
      ⚠️ 儲值付款未完成，若有疑問請聯絡客服。
    </div>

    <!-- 餘額卡片 -->
    <div class="balance-card">
      <div class="balance-card__label">錢包餘額</div>
      <div class="balance-card__amount">NT$ {{ wallet.balance.toLocaleString() }}</div>
      <button class="btn-topup" @click="showTopupForm = !showTopupForm">
        {{ showTopupForm ? '收起' : '+ 儲值' }}
      </button>
    </div>

    <!-- 儲值表單 -->
    <div v-if="showTopupForm" class="topup-form">
      <h3 class="section-title">儲值設定</h3>
      <div class="field">
        <label>儲值金額（NT$）</label>
        <input v-model.number="topupAmount" type="number" min="1" step="1" placeholder="請輸入金額" />
      </div>

      <!-- 發票設定 -->
      <div class="field">
        <label>發票載具</label>
        <select v-model="invoiceCarrierType">
          <option value="">紙本發票</option>
          <option value="0">手機條碼載具</option>
          <option value="1">自然人憑證</option>
          <option value="D">捐贈發票</option>
          <option value="B2B">公司戶（統編）</option>
        </select>
      </div>
      <div v-if="invoiceCarrierType === '0'" class="field">
        <label>手機條碼</label>
        <input v-model="invoiceCarrierNum" placeholder="/XXXXXXX" />
      </div>
      <div v-if="invoiceCarrierType === '1'" class="field">
        <label>自然人憑證號碼</label>
        <input v-model="invoiceCarrierNum" placeholder="2碼英文+14碼數字" />
      </div>
      <div v-if="invoiceCarrierType === 'D'" class="field">
        <label>捐贈碼</label>
        <input v-model="invoiceLoveCode" placeholder="3~7碼數字" />
      </div>
      <div v-if="invoiceCarrierType === 'B2B'" class="field">
        <label>統一編號</label>
        <input v-model="invoiceBuyerUBN" placeholder="8碼數字" />
      </div>

      <p v-if="topupError" class="msg msg--error">{{ topupError }}</p>

      <button class="btn-submit" :disabled="topupSubmitting" @click="submitTopup">
        {{ topupSubmitting ? '導向付款中...' : '前往付款' }}
      </button>
    </div>

    <!-- 藍新付款 hidden form -->
    <form v-if="payParams" ref="payForm" :action="payParams.gatewayUrl" method="POST" style="display:none">
      <input type="hidden" name="MerchantID"      :value="payParams.MerchantID" />
      <input type="hidden" name="TradeInfo"        :value="payParams.TradeInfo" />
      <input type="hidden" name="TradeSha"         :value="payParams.TradeSha" />
      <input type="hidden" name="TimeStamp"        :value="payParams.TimeStamp" />
      <input type="hidden" name="Version"          :value="payParams.Version" />
      <input type="hidden" name="MerchantOrderNo"  :value="payParams.MerchantOrderNo" />
    </form>

    <!-- 交易紀錄 -->
    <div class="tx-section">
      <h3 class="section-title">交易紀錄</h3>
      <div v-if="wallet.transactions.length === 0" class="empty">尚無交易紀錄</div>
      <div v-else class="tx-list">
        <div v-for="tx in wallet.transactions" :key="tx.ID" class="tx-item">
          <div class="tx-item__left">
            <span class="tx-type" :class="txTypeClass(tx.TxType)">{{ txTypeLabel(tx.TxType) }}</span>
            <span class="tx-ref" v-if="tx.RelatedOrderNo">訂單 {{ tx.RelatedOrderNo }}</span>
            <span class="tx-ref" v-else-if="tx.RelatedTopupNo">儲值單 {{ tx.RelatedTopupNo }}</span>
            <span class="tx-note" v-if="tx.Note">{{ tx.Note }}</span>
            <span class="tx-date">{{ new Date(tx.CreatedDate).toLocaleString('zh-TW') }}</span>
          </div>
          <div class="tx-item__right" :class="txTypeClass(tx.TxType)">
            {{ tx.Amount > 0 ? '+' : '' }}{{ tx.Amount.toLocaleString() }}
            <span class="tx-balance">餘額 {{ tx.BalanceAfter.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-page { max-width: 640px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 24px; }

.alert { padding: 12px 16px; border-radius: 12px; font-size: 14px; }
.alert--success { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); color: #15803d; }
.alert--error   { background: rgba(239,68,68,.1);  border: 1px solid rgba(239,68,68,.25); color: #b91c1c; }

.balance-card {
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border-radius: 20px;
  padding: 28px 24px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.balance-card__label  { font-size: 13px; opacity: .8; }
.balance-card__amount { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
.btn-topup {
  background: rgba(255,255,255,.2);
  border: 1px solid rgba(255,255,255,.4);
  color: #fff;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s;
  white-space: nowrap;
}
.btn-topup:hover { background: rgba(255,255,255,.3); }

.topup-form {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(31,41,55,.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 4px 20px rgba(31,41,55,.06);
}
.section-title { font-size: 15px; font-weight: 700; color: #111827; margin: 0; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; color: rgba(31,41,55,.7); }
.field input, .field select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(31,41,55,.12);
  font-size: 14px;
  background: #fafafa;
  outline: none;
  transition: border-color .15s;
}
.field input:focus, .field select:focus { border-color: #a855f7; }
.msg { padding: 10px 12px; border-radius: 10px; font-size: 13px; margin: 0; }
.msg--error { background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2); color: #b91c1c; }
.btn-submit {
  padding: 12px;
  border-radius: 12px;
  border: 0;
  background: #7c3aed;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s;
}
.btn-submit:hover:not(:disabled) { background: #6d28d9; }
.btn-submit:disabled { opacity: .6; cursor: not-allowed; }

.tx-section { display: flex; flex-direction: column; gap: 12px; }
.empty { color: rgba(31,41,55,.45); font-size: 14px; text-align: center; padding: 24px; }
.tx-list { display: flex; flex-direction: column; gap: 1px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(31,41,55,.08); }
.tx-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
  gap: 12px;
}
.tx-item:not(:last-child) { border-bottom: 1px solid rgba(31,41,55,.06); }
.tx-item__left { display: flex; flex-direction: column; gap: 3px; }
.tx-type { font-size: 13px; font-weight: 600; }
.tx-type.tx--credit { color: #15803d; }
.tx-type.tx--debit  { color: #b91c1c; }
.tx-ref  { font-size: 12px; color: rgba(31,41,55,.5); }
.tx-note { font-size: 12px; color: rgba(31,41,55,.5); }
.tx-date { font-size: 11px; color: rgba(31,41,55,.35); }
.tx-item__right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-size: 15px; font-weight: 700; white-space: nowrap; }
.tx-item__right.tx--credit { color: #15803d; }
.tx-item__right.tx--debit  { color: #b91c1c; }
.tx-balance { font-size: 11px; font-weight: 400; color: rgba(31,41,55,.4); }
</style>
