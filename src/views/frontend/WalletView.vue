<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db'

const route  = useRoute()
const wallet = useWalletStore()
const auth   = useAuthStore()

const topupResult     = ref(null)   // 'success' | 'atm_pending' | 'fail' | null
const showTopupForm   = ref(false)
const topupAmount     = ref('')
const topupSubmitting = ref(false)
const topupError      = ref('')

// ATM 待轉帳的儲值單（從 DB 查詢，讓用戶關掉頁面後仍可找回）
const pendingAtmTopups = ref([])

const invoiceCarrierType = ref('')
const invoiceCarrierNum  = ref('')
const invoiceLoveCode    = ref('')
const invoiceBuyerUBN    = ref('')

const payForm   = ref(null)
const payParams = ref(null)

async function fetchPendingAtmTopups() {
  if (!auth.user?.id) return
  const { data, error } = await db
    .from('C_MBR_WalletTopupList')
    .select('TopupNo, Amount, ATMBankCode, ATMAccount, ATMExpireDate, CreatedDate')
    .eq('MemberID', auth.user.id)
    .eq('PaymentStatus', 'pending')
    .eq('PaymentMethod', 'atm')
    .not('ATMBankCode', 'is', null)
    .order('CreatedDate', { ascending: false })
  if (error) { if (import.meta.env.DEV) console.error('[fetchPendingAtmTopups]', error.message); return }
  pendingAtmTopups.value = data ?? []
}

function fmtAtmAccount(acct) {
  if (!acct) return '—'
  return acct.replace(/(.{4})/g, '$1 ').trim()
}

function fmtExpireDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00+08:00').toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

onMounted(async () => {
  if (!auth.isLoggedIn) return

  await Promise.all([wallet.fetchBalance(), wallet.fetchTransactions(), fetchPendingAtmTopups()])

  if (route.query.topup === 'success') {
    topupResult.value = 'success'
    // 輪詢直到餘額有變動（最多 20 秒，每 2 秒一次）
    const balanceBefore = wallet.balance
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      await wallet.fetchBalance()
      if (wallet.balance !== balanceBefore || attempts >= 10) {
        clearInterval(poll)
        if (wallet.balance !== balanceBefore) {
          wallet.fetchTransactions()
        }
      }
    }, 2000)
  } else if (route.query.topup === 'atm_pending') {
    topupResult.value = 'atm_pending'
  } else if (route.query.topup === 'fail') {
    topupResult.value = 'fail'
  }

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
  return { topup: '儲值', order_deduct: '消費扣款', refund: '退款', adjust: '帳戶調整' }[type] || type
}
function isCredit(type) {
  return ['topup', 'refund', 'adjust'].includes(type)
}
function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

async function submitTopup() {
  topupError.value = ''
  const amt = Number(topupAmount.value)
  if (!amt || amt < 1 || !Number.isInteger(amt)) { topupError.value = '請輸入有效的儲值金額（正整數）'; return }
  if (invoiceCarrierType.value === '0' && !/^\/[A-Z0-9+\-.]{7}$/.test(invoiceCarrierNum.value)) { topupError.value = '手機條碼格式錯誤，應為 /XXXXXXX'; return }
  if (invoiceCarrierType.value === 'D' && !/^\d{3,7}$/.test(invoiceLoveCode.value)) { topupError.value = '捐贈碼格式錯誤，應為 3~7 碼數字'; return }
  if (invoiceCarrierType.value === 'B2B' && !/^\d{8}$/.test(invoiceBuyerUBN.value)) { topupError.value = '統一編號格式錯誤，應為 8 碼數字'; return }

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
  <div class="wv-root">

    <!-- Page header -->
    <header class="wv-header">
      <p class="wv-eyebrow">My Wallet</p>
      <h1 class="wv-title">我的錢包</h1>
    </header>

    <!-- Toast alerts -->
    <div v-if="topupResult === 'success'" class="wv-toast wv-toast--ok">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      儲值成功！餘額將於幾秒內更新。
    </div>
    <div v-if="topupResult === 'atm_pending'" class="wv-toast wv-toast--atm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ATM 虛擬帳號已取得，請在期限內完成轉帳，轉帳完成後餘額將自動入帳。
    </div>
    <div v-if="topupResult === 'fail'" class="wv-toast wv-toast--err">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      付款未完成，若有疑問請聯絡客服。
    </div>

    <!-- Main layout -->
    <div class="wv-body">

      <!-- Left: balance + topup -->
      <aside class="wv-aside">

        <!-- Balance card -->
        <div class="wv-card">
          <div class="wv-card__eyebrow">可用餘額</div>
          <div class="wv-card__amount">
            <span class="wv-card__currency">NT$</span>
            <span class="wv-card__number">{{ wallet.balance.toLocaleString() }}</span>
          </div>
          <div class="wv-card__note">錢包餘額不可提現，限站內消費使用</div>
          <button class="wv-card__btn" @click="showTopupForm = !showTopupForm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {{ showTopupForm ? '收起' : '儲值' }}
          </button>
        </div>

        <!-- Topup form -->
        <div v-if="showTopupForm" class="wv-topup">
          <h3 class="wv-section-title">儲值設定</h3>

          <!-- Quick amounts -->
          <div class="wv-quick-amounts">
            <button
              v-for="n in [100, 300, 500, 1000, 3000]"
              :key="n"
              class="wv-quick-btn"
              :class="{ 'wv-quick-btn--active': topupAmount === n }"
              type="button"
              @click="topupAmount = n"
            >NT$ {{ n.toLocaleString() }}</button>
          </div>

          <div class="wv-field">
            <label class="wv-label">或輸入金額</label>
            <div class="wv-input-wrap">
              <span class="wv-input-prefix">NT$</span>
              <input v-model.number="topupAmount" type="number" min="1" step="1" placeholder="請輸入金額" class="wv-input" />
            </div>
          </div>

          <!-- Invoice -->
          <div class="wv-field">
            <label class="wv-label">發票載具</label>
            <select v-model="invoiceCarrierType" class="wv-select">
              <option value="">紙本發票</option>
              <option value="0">手機條碼載具</option>
              <option value="1">自然人憑證</option>
              <option value="D">捐贈發票</option>
              <option value="B2B">公司戶（統編）</option>
            </select>
          </div>
          <div v-if="invoiceCarrierType === '0'" class="wv-field">
            <label class="wv-label">手機條碼</label>
            <input v-model="invoiceCarrierNum" class="wv-input" placeholder="/XXXXXXX（斜線+7碼）" />
          </div>
          <div v-if="invoiceCarrierType === '1'" class="wv-field">
            <label class="wv-label">自然人憑證號碼</label>
            <input v-model="invoiceCarrierNum" class="wv-input" placeholder="2碼英文 + 14碼數字" />
          </div>
          <div v-if="invoiceCarrierType === 'D'" class="wv-field">
            <label class="wv-label">捐贈碼</label>
            <input v-model="invoiceLoveCode" class="wv-input" placeholder="3~7碼數字" />
          </div>
          <div v-if="invoiceCarrierType === 'B2B'" class="wv-field">
            <label class="wv-label">統一編號</label>
            <input v-model="invoiceBuyerUBN" class="wv-input" placeholder="8碼數字" />
          </div>

          <p v-if="topupError" class="wv-error">{{ topupError }}</p>

          <button class="wv-submit-btn" :disabled="topupSubmitting" @click="submitTopup">
            <svg v-if="!topupSubmitting" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            {{ topupSubmitting ? '導向付款中…' : '前往付款' }}
          </button>
        </div>

        <!-- Hidden NewebPay form -->
        <form v-if="payParams" ref="payForm" :action="payParams.gatewayUrl" method="POST" style="display:none">
          <input type="hidden" name="MerchantID"     :value="payParams.MerchantID" />
          <input type="hidden" name="TradeInfo"       :value="payParams.TradeInfo" />
          <input type="hidden" name="TradeSha"        :value="payParams.TradeSha" />
          <input type="hidden" name="TimeStamp"       :value="payParams.TimeStamp" />
          <input type="hidden" name="Version"         :value="payParams.Version" />
          <input type="hidden" name="MerchantOrderNo" :value="payParams.MerchantOrderNo" />
        </form>
      </aside>

      <!-- Right: transactions -->
      <section class="wv-main">

        <!-- Pending ATM topups -->
        <div v-if="pendingAtmTopups.length > 0" class="wv-atm-section">
          <h2 class="wv-section-title">待轉帳 ATM 儲值</h2>
          <div v-for="t in pendingAtmTopups" :key="t.TopupNo" class="wv-atm-card">
            <div class="wv-atm-card__badge">等待轉帳</div>
            <div class="wv-atm-card__amount">NT$ {{ Number(t.Amount).toLocaleString() }}</div>
            <div class="wv-atm-card__rows">
              <div class="wv-atm-card__row">
                <span class="wv-atm-card__label">銀行代碼</span>
                <span class="wv-atm-card__val">{{ t.ATMBankCode || '—' }}</span>
              </div>
              <div class="wv-atm-card__row">
                <span class="wv-atm-card__label">虛擬帳號</span>
                <span class="wv-atm-card__val wv-atm-card__val--acct">{{ fmtAtmAccount(t.ATMAccount) }}</span>
              </div>
              <div class="wv-atm-card__row">
                <span class="wv-atm-card__label">繳費期限</span>
                <span class="wv-atm-card__val">{{ fmtExpireDate(t.ATMExpireDate) }}</span>
              </div>
              <div class="wv-atm-card__row">
                <span class="wv-atm-card__label">儲值單號</span>
                <span class="wv-atm-card__val wv-atm-card__val--no">{{ t.TopupNo }}</span>
              </div>
            </div>
            <p class="wv-atm-card__note">轉帳完成後餘額將自動入帳，無需重新操作。</p>
          </div>
        </div>

        <h2 class="wv-section-title">交易紀錄</h2>

        <div v-if="wallet.loading" class="wv-empty">
          <div class="wv-spinner"></div>
        </div>

        <div v-else-if="wallet.transactions.length === 0" class="wv-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--fe-muted);margin-bottom:10px"><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          <p>尚無交易紀錄</p>
        </div>

        <div v-else class="wv-tx-list">
          <div v-for="tx in wallet.transactions" :key="tx.ID" class="wv-tx">
            <!-- Left icon -->
            <div class="wv-tx__icon" :class="isCredit(tx.TxType) ? 'wv-tx__icon--in' : 'wv-tx__icon--out'">
              <svg v-if="isCredit(tx.TxType)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            </div>

            <!-- Info -->
            <div class="wv-tx__info">
              <div class="wv-tx__type">{{ txTypeLabel(tx.TxType) }}</div>
              <div class="wv-tx__sub">
                <span v-if="tx.RelatedOrderNo">訂單 {{ tx.RelatedOrderNo }}</span>
                <span v-else-if="tx.RelatedTopupNo">儲值單 {{ tx.RelatedTopupNo }}</span>
                <span v-if="tx.Note" class="wv-tx__note">{{ tx.Note }}</span>
              </div>
              <div class="wv-tx__date">{{ formatDate(tx.CreatedDate) }}</div>
            </div>

            <!-- Amount -->
            <div class="wv-tx__right">
              <div class="wv-tx__amt" :class="isCredit(tx.TxType) ? 'wv-tx__amt--in' : 'wv-tx__amt--out'">
                {{ isCredit(tx.TxType) ? '+' : '' }}NT$ {{ Math.abs(tx.Amount).toLocaleString() }}
              </div>
              <div class="wv-tx__balance">餘額 NT$ {{ tx.BalanceAfter.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────── */
.wv-root {
  padding-top: 68px;
  min-height: 80vh;
  max-width: 1000px;
  margin: 0 auto;
  padding-left: 36px;
  padding-right: 36px;
  padding-bottom: 96px;
}

/* ── Page header ─────────────────────────────────────── */
.wv-header {
  padding: 48px 0 40px;
  text-align: center;
}
.wv-eyebrow {
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--fe-gold-d, #92400e);
  margin: 0 0 10px;
}
.wv-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 500;
  margin: 0;
  color: var(--fe-text, #1f2937);
}

/* ── Toast ───────────────────────────────────────────── */
.wv-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  margin-bottom: 24px;
}
.wv-toast--ok  { background: rgba(34,197,94,.1);  border: 1px solid rgba(34,197,94,.25); color: #15803d; }
.wv-toast--atm { background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.3); color: #b45309; }
.wv-toast--err { background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2);  color: #b91c1c; }

/* ── Body: aside + main ──────────────────────────────── */
.wv-body {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 28px;
  align-items: start;
}
@media (max-width: 720px) {
  .wv-body { grid-template-columns: 1fr; }
  .wv-root { padding-left: 18px; padding-right: 18px; }
}

/* ── Balance card ────────────────────────────────────── */
.wv-card {
  background: linear-gradient(160deg, #1f2937 0%, #374151 100%);
  border-radius: 20px;
  padding: 28px 24px;
  color: #fff;
  position: relative;
  overflow: hidden;
}
.wv-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top right, rgba(251,191,36,.18), transparent 60%),
              radial-gradient(ellipse at bottom left, rgba(244,114,182,.12), transparent 60%);
  pointer-events: none;
}
.wv-card__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.55;
  margin-bottom: 14px;
}
.wv-card__amount {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 10px;
}
.wv-card__currency {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.7;
}
.wv-card__number {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 44px;
  font-weight: 600;
  letter-spacing: -1px;
  line-height: 1;
}
.wv-card__note {
  font-size: 11px;
  opacity: 0.45;
  margin-bottom: 20px;
  line-height: 1.5;
}
.wv-card__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(251,191,36,.18);
  border: 1px solid rgba(251,191,36,.35);
  color: rgba(251,191,36,.95);
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: background .15s;
}
.wv-card__btn:hover { background: rgba(251,191,36,.28); }

/* ── Topup form ──────────────────────────────────────── */
.wv-topup {
  margin-top: 16px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(31,41,55,.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 4px 24px rgba(31,41,55,.06);
}
.wv-section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--fe-text, #1f2937);
  margin: 0 0 4px;
  letter-spacing: 0.02em;
}
.wv-quick-amounts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.wv-quick-btn {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid rgba(31,41,55,.12);
  background: #fafafa;
  font-size: 13px;
  cursor: pointer;
  transition: all .12s;
  color: rgba(31,41,55,.8);
}
.wv-quick-btn:hover { border-color: #c9a227; color: #92400e; }
.wv-quick-btn--active {
  border-color: #c9a227;
  background: rgba(251,191,36,.12);
  color: #92400e;
  font-weight: 600;
}
.wv-field { display: flex; flex-direction: column; gap: 5px; }
.wv-label { font-size: 12px; color: rgba(31,41,55,.6); font-weight: 500; }
.wv-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid rgba(31,41,55,.12);
  border-radius: 10px;
  overflow: hidden;
  background: #fafafa;
  transition: border-color .15s;
}
.wv-input-wrap:focus-within { border-color: #c9a227; }
.wv-input-prefix {
  padding: 0 10px;
  font-size: 13px;
  color: rgba(31,41,55,.4);
  border-right: 1px solid rgba(31,41,55,.08);
  height: 38px;
  display: flex;
  align-items: center;
}
.wv-input {
  flex: 1;
  border: 0;
  outline: none;
  padding: 9px 12px;
  font-size: 14px;
  background: transparent;
  color: var(--fe-text, #1f2937);
}
.wv-select {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid rgba(31,41,55,.12);
  font-size: 14px;
  background: #fafafa;
  outline: none;
  color: var(--fe-text, #1f2937);
  transition: border-color .15s;
}
.wv-select:focus { border-color: #c9a227; }
.wv-error {
  font-size: 12px;
  color: #b91c1c;
  background: rgba(239,68,68,.06);
  border: 1px solid rgba(239,68,68,.15);
  border-radius: 8px;
  padding: 8px 12px;
  margin: 0;
}
.wv-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: 0;
  background: var(--fe-text, #1f2937);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: opacity .15s;
}
.wv-submit-btn:hover:not(:disabled) { opacity: .82; }
.wv-submit-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ── Pending ATM topup cards ─────────────────────────── */
.wv-atm-section { display: flex; flex-direction: column; gap: 12px; }

.wv-atm-card {
  background: #fffbf0;
  border: 1.5px solid rgba(245,158,11,.35);
  border-radius: 16px;
  padding: 20px 22px;
  position: relative;
  box-shadow: 0 2px 12px rgba(245,158,11,.08);
}
.wv-atm-card__badge {
  display: inline-block;
  background: rgba(245,158,11,.15);
  color: #b45309;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid rgba(245,158,11,.25);
  margin-bottom: 10px;
}
.wv-atm-card__amount {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 30px;
  font-weight: 600;
  color: var(--fe-text, #1f2937);
  line-height: 1;
  margin-bottom: 16px;
  letter-spacing: -0.5px;
}
.wv-atm-card__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.wv-atm-card__row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.wv-atm-card__label {
  font-size: 11px;
  color: rgba(31,41,55,.45);
  font-weight: 500;
  width: 62px;
  flex-shrink: 0;
}
.wv-atm-card__val {
  font-size: 14px;
  color: var(--fe-text, #1f2937);
  font-weight: 500;
}
.wv-atm-card__val--acct {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #1f2937;
}
.wv-atm-card__val--no {
  font-size: 12px;
  color: rgba(31,41,55,.5);
  font-weight: 400;
}
.wv-atm-card__note {
  font-size: 12px;
  color: rgba(31,41,55,.45);
  margin: 0;
  line-height: 1.5;
}

/* ── Transaction list ────────────────────────────────── */
.wv-main { display: flex; flex-direction: column; gap: 16px; }

.wv-spinner {
  width: 28px; height: 28px;
  border: 2px solid rgba(31,41,55,.1);
  border-top-color: var(--fe-gold-d, #92400e);
  border-radius: 50%;
  animation: spin .7s linear infinite;
  margin: 40px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

.wv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--fe-muted, rgba(31,41,55,.4));
  font-size: 14px;
}

.wv-tx-list {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(31,41,55,.07);
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(31,41,55,.04);
}
.wv-tx {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(31,41,55,.05);
  transition: background .1s;
}
.wv-tx:last-child { border-bottom: 0; }
.wv-tx:hover { background: rgba(31,41,55,.015); }

.wv-tx__icon {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wv-tx__icon--in  { background: rgba(34,197,94,.1);  color: #15803d; }
.wv-tx__icon--out { background: rgba(239,68,68,.08); color: #b91c1c; }

.wv-tx__info { flex: 1; min-width: 0; }
.wv-tx__type { font-size: 14px; font-weight: 600; color: var(--fe-text, #1f2937); }
.wv-tx__sub  { font-size: 12px; color: rgba(31,41,55,.45); margin-top: 2px; display: flex; flex-wrap: wrap; gap: 6px; }
.wv-tx__note { font-style: italic; }
.wv-tx__date { font-size: 11px; color: rgba(31,41,55,.3); margin-top: 3px; }

.wv-tx__right { text-align: right; flex-shrink: 0; }
.wv-tx__amt   { font-size: 15px; font-weight: 700; }
.wv-tx__amt--in  { color: #15803d; }
.wv-tx__amt--out { color: #b91c1c; }
.wv-tx__balance  { font-size: 11px; color: rgba(31,41,55,.35); margin-top: 2px; }
</style>
