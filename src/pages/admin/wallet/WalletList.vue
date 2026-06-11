<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

// ── 搜尋會員 ──────────────────────────────────────────────
const searchQuery   = ref('')
const searchLoading = ref(false)
const searchResults = ref([])
const searchError   = ref('')

async function searchMembers() {
  const q = searchQuery.value.trim()
  if (!q) return
  searchLoading.value = true
  searchError.value   = ''
  searchResults.value = []
  try {
    const { data, error } = await db
      .from('C_MBR_MemberList')
      .select('UserID, Name, Email, Phone')
      .or(`Name.ilike.%${q}%,Email.ilike.%${q}%`)
      .limit(10)
    if (error) throw error
    searchResults.value = data ?? []
    if (searchResults.value.length === 0) searchError.value = '找不到符合的會員'
  } catch (e) {
    searchError.value = e?.message || '搜尋失敗'
  } finally {
    searchLoading.value = false
  }
}

// ── 選取會員，載入錢包資料 ────────────────────────────────
const selectedMember  = ref(null)
const walletBalance   = ref(0)
const walletUpdatedAt = ref(null)
const transactions    = ref([])
const walletLoading   = ref(false)

async function selectMember(member) {
  selectedMember.value  = member
  searchResults.value   = []
  searchQuery.value     = ''
  walletLoading.value   = true
  transactions.value    = []

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-adjust?memberId=${member.UserID}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    walletBalance.value   = data.balance
    walletUpdatedAt.value = data.updatedDate
    transactions.value    = data.transactions ?? []
  } catch (e) {
    if (import.meta.env.DEV) console.error('[WalletList] fetch error:', e)
  } finally {
    walletLoading.value = false
  }
}

// ── 手動調整 ──────────────────────────────────────────────
const adjustAmt    = ref('')
const adjustNote   = ref('')
const adjustSubmit = ref(false)
const adjustError  = ref('')
const adjustMsg    = ref('')

async function submitAdjust() {
  adjustError.value = ''
  adjustMsg.value   = ''
  const amt = Number(adjustAmt.value)
  if (!amt || !Number.isInteger(amt)) { adjustError.value = '請輸入有效整數（正數=增加，負數=扣除）'; return }
  if (!adjustNote.value.trim()) { adjustError.value = '請填寫調整原因'; return }
  if (!selectedMember.value) return

  adjustSubmit.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-adjust`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ memberId: selectedMember.value.UserID, amount: amt, note: adjustNote.value.trim() }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    walletBalance.value = data.balanceAfter
    adjustMsg.value   = `調整成功！餘額 NT$${data.balanceBefore.toLocaleString()} → NT$${data.balanceAfter.toLocaleString()}`
    adjustAmt.value   = ''
    adjustNote.value  = ''
    // 重新載入流水帳
    await selectMember(selectedMember.value)
  } catch (e) {
    adjustError.value = e?.message || '調整失敗'
  } finally {
    adjustSubmit.value = false
  }
}

function txTypeLabel(type) {
  const map = { topup: '儲值', order_deduct: '消費扣款', refund: '退款', adjust: '管理員調整' }
  return map[type] || type
}
function txAmtClass(amt) { return amt > 0 ? 'tx-credit' : 'tx-debit' }
</script>

<template>
  <div class="wl-page">
    <div class="wl-header">
      <h1 class="wl-title">錢包管理</h1>
    </div>

    <!-- 搜尋 -->
    <div class="wl-search-wrap">
      <div class="wl-search-row">
        <input
          v-model="searchQuery"
          class="wl-input"
          placeholder="搜尋會員姓名或 Email"
          @keydown.enter.prevent="searchMembers"
        />
        <button class="wl-btn" :disabled="searchLoading" @click="searchMembers">
          {{ searchLoading ? '搜尋中...' : '搜尋' }}
        </button>
      </div>
      <p v-if="searchError" class="wl-hint wl-hint--error">{{ searchError }}</p>
      <div v-if="searchResults.length > 0" class="wl-search-results">
        <div
          v-for="m in searchResults"
          :key="m.UserID"
          class="wl-search-item"
          @click="selectMember(m)"
        >
          <span class="wl-member-name">{{ m.Name || '（未填姓名）' }}</span>
          <span class="wl-member-email">{{ m.Email }}</span>
        </div>
      </div>
    </div>

    <!-- 選取的會員錢包資料 -->
    <div v-if="selectedMember" class="wl-content">
      <div class="wl-member-header">
        <div>
          <div class="wl-member-title">{{ selectedMember.Name || '（未填姓名）' }}</div>
          <div class="wl-member-sub">{{ selectedMember.Email }}</div>
        </div>
        <div class="wl-balance-card">
          <div class="wl-balance-label">目前餘額</div>
          <div class="wl-balance-amt">NT$ {{ walletBalance.toLocaleString() }}</div>
          <div v-if="walletUpdatedAt" class="wl-balance-date">
            最後更新：{{ new Date(walletUpdatedAt).toLocaleString('zh-TW') }}
          </div>
        </div>
      </div>

      <!-- 手動調整表單 -->
      <div class="wl-adjust-form">
        <h3 class="wl-section-title">手動調整餘額</h3>
        <div class="wl-form-row">
          <div class="wl-field">
            <label>調整金額（正數=增加，負數=扣除）</label>
            <input v-model.number="adjustAmt" type="number" step="1" class="wl-input" placeholder="例：500 或 -200" />
          </div>
          <div class="wl-field wl-field--grow">
            <label>調整原因</label>
            <input v-model="adjustNote" class="wl-input" placeholder="例：訂單退款補償" />
          </div>
          <button class="wl-btn wl-btn--primary" :disabled="adjustSubmit" @click="submitAdjust">
            {{ adjustSubmit ? '處理中...' : '確認調整' }}
          </button>
        </div>
        <p v-if="adjustError" class="wl-hint wl-hint--error">{{ adjustError }}</p>
        <p v-if="adjustMsg"   class="wl-hint wl-hint--success">{{ adjustMsg }}</p>
      </div>

      <!-- 交易紀錄 -->
      <div class="wl-tx-section">
        <h3 class="wl-section-title">交易紀錄（最近 50 筆）</h3>
        <div v-if="walletLoading" class="wl-loading">載入中...</div>
        <div v-else-if="transactions.length === 0" class="wl-empty">尚無交易紀錄</div>
        <table v-else class="wl-table">
          <thead>
            <tr>
              <th>時間</th>
              <th>類型</th>
              <th>金額</th>
              <th>變動後餘額</th>
              <th>關聯單號</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in transactions" :key="tx.ID">
              <td class="wl-td-date">{{ new Date(tx.CreatedDate).toLocaleString('zh-TW') }}</td>
              <td><span class="wl-tag">{{ txTypeLabel(tx.TxType) }}</span></td>
              <td :class="txAmtClass(tx.Amount)" class="wl-td-amt">
                {{ tx.Amount > 0 ? '+' : '' }}{{ tx.Amount.toLocaleString() }}
              </td>
              <td>{{ tx.BalanceAfter.toLocaleString() }}</td>
              <td class="wl-td-ref">
                {{ tx.RelatedOrderNo || tx.RelatedTopupNo || '—' }}
              </td>
              <td class="wl-td-note">{{ tx.Note || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wl-page { padding: 24px; max-width: 960px; }
.wl-header { margin-bottom: 24px; }
.wl-title { font-size: 22px; font-weight: 700; margin: 0; }

.wl-search-wrap { background: #fff; border-radius: 14px; border: 1px solid rgba(31,41,55,.08); padding: 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px; }
.wl-search-row { display: flex; gap: 10px; }
.wl-input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(31,41,55,.12); font-size: 14px; outline: none; }
.wl-input:focus { border-color: #7c3aed; }
.wl-btn { padding: 10px 18px; border-radius: 10px; border: 1px solid rgba(31,41,55,.15); background: #fff; font-size: 14px; cursor: pointer; white-space: nowrap; }
.wl-btn:hover { background: #f9fafb; }
.wl-btn:disabled { opacity: .6; cursor: not-allowed; }
.wl-btn--primary { background: #7c3aed; color: #fff; border-color: #7c3aed; }
.wl-btn--primary:hover:not(:disabled) { background: #6d28d9; }

.wl-search-results { border: 1px solid rgba(31,41,55,.1); border-radius: 10px; overflow: hidden; }
.wl-search-item { padding: 12px 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(31,41,55,.06); }
.wl-search-item:last-child { border-bottom: 0; }
.wl-search-item:hover { background: #f5f3ff; }
.wl-member-name { font-weight: 600; font-size: 14px; }
.wl-member-email { font-size: 12px; color: rgba(31,41,55,.5); }

.wl-hint { font-size: 13px; margin: 0; }
.wl-hint--error   { color: #b91c1c; }
.wl-hint--success { color: #15803d; }

.wl-content { display: flex; flex-direction: column; gap: 20px; }

.wl-member-header {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(31,41,55,.08);
  padding: 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.wl-member-title { font-size: 16px; font-weight: 700; }
.wl-member-sub   { font-size: 13px; color: rgba(31,41,55,.5); margin-top: 2px; }

.wl-balance-card { background: linear-gradient(135deg,#7c3aed,#a855f7); color:#fff; border-radius:12px; padding:16px 20px; min-width:180px; text-align:right; }
.wl-balance-label { font-size:12px; opacity:.8; }
.wl-balance-amt   { font-size:24px; font-weight:700; }
.wl-balance-date  { font-size:11px; opacity:.7; margin-top:4px; }

.wl-adjust-form { background:#fff; border-radius:14px; border:1px solid rgba(31,41,55,.08); padding:20px; display:flex; flex-direction:column; gap:14px; }
.wl-section-title { font-size:15px; font-weight:700; margin:0; }
.wl-form-row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; }
.wl-field { display:flex; flex-direction:column; gap:5px; min-width:160px; }
.wl-field--grow { flex:1; }
.wl-field label { font-size:12px; color:rgba(31,41,55,.6); }

.wl-tx-section { background:#fff; border-radius:14px; border:1px solid rgba(31,41,55,.08); padding:20px; }
.wl-loading, .wl-empty { color:rgba(31,41,55,.45); font-size:14px; text-align:center; padding:24px; }

.wl-table { width:100%; border-collapse:collapse; font-size:13px; }
.wl-table th { text-align:left; padding:10px 12px; background:#f9fafb; font-weight:600; color:rgba(31,41,55,.6); border-bottom:1px solid rgba(31,41,55,.08); white-space:nowrap; }
.wl-table td { padding:10px 12px; border-bottom:1px solid rgba(31,41,55,.05); vertical-align:top; }
.wl-table tr:last-child td { border-bottom:0; }

.wl-tag { background:rgba(124,58,237,.1); color:#6d28d9; border-radius:6px; padding:2px 8px; font-size:12px; white-space:nowrap; }
.wl-td-amt   { font-weight:700; white-space:nowrap; }
.wl-td-date  { white-space:nowrap; color:rgba(31,41,55,.5); }
.wl-td-ref   { font-family:monospace; font-size:12px; color:rgba(31,41,55,.6); }
.wl-td-note  { color:rgba(31,41,55,.6); max-width:200px; }
.tx-credit   { color:#15803d; }
.tx-debit    { color:#b91c1c; }
</style>
