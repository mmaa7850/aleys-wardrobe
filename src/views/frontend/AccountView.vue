<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/lib/db'

const auth   = useAuthStore()
const router = useRouter()

const profile     = ref(null)
const isLoading   = ref(true)
const isSaving    = ref(false)
const saveMsg     = ref('')
const saveMsgType = ref('')

const form = ref({ Name: '', Phone: '', Gender: '', Birthday: '' })
const memberLevelID = ref(null)
const memberLevelName = ref('')
const lineUserID  = ref(null)  // LINE 綁定狀態

const recentOrders  = ref([])
const ordersLoading = ref(false)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function payStatusLabel(s) {
  if (s === 'paid')    return '已付款'
  if (s === 'failed')  return '付款失敗'
  if (s === 'refunded') return '已退款'
  return '待付款'
}

async function fetchOrders() {
  ordersLoading.value = true
  const { data } = await db
    .from('C_ORD_OrderList')
    .select('ID, OrderNo, FinalAmount, NewebpayAmt, WalletDeductAmt, PaymentStatus, CreatedDate, OrderType')
    .eq('CustomerEmail', auth.user.email)
    .order('CreatedDate', { ascending: false })
    .limit(3)
  recentOrders.value = data || []
  ordersLoading.value = false
}

const userInitial = computed(() => {
  const name  = profile.value?.Name || ''
  const email = auth.user?.email || ''
  const src   = name || email
  return src.charAt(0).toUpperCase() || '?'
})

const displayEmail = computed(() => auth.user?.email || '')

async function fetchProfile() {
  isLoading.value = true
  const { data, error: fetchErr } = await db
    .from('C_MBR_MemberList')
    .select('Name, Phone, Gender, Birthday, CreatedDate, MemberLevelID, LineUserID')
    .eq('UserID', auth.user.id)
    .maybeSingle()

  if (fetchErr) console.error('[AccountView] fetch error:', fetchErr)

  profile.value       = data || {}
  form.value.Name     = data?.Name     || ''
  form.value.Phone    = data?.Phone    || ''
  form.value.Gender   = data?.Gender   || ''
  form.value.Birthday = data?.Birthday || ''
  memberLevelID.value = data?.MemberLevelID || null

  if (data?.MemberLevelID) {
    const { data: lvl } = await db
      .from('S_MBR_MemberLevelList')
      .select('Name')
      .eq('ID', data.MemberLevelID)
      .maybeSingle()
    memberLevelName.value = lvl?.Name || ''
  }

  lineUserID.value = data?.LineUserID || null

  isLoading.value = false
}

async function saveProfile() {
  saveMsg.value  = ''
  isSaving.value = true

  const payload = {
    UserID:   auth.user.id,
    Email:    auth.user.email,
    Name:     form.value.Name.trim(),
    Phone:    form.value.Phone.trim(),
    Gender:   form.value.Gender   || null,
    Birthday: form.value.Birthday || null,
  }

  const { error } = await db
    .from('C_MBR_MemberList')
    .upsert(payload, { onConflict: 'UserID' })

  if (error) {
    saveMsg.value  = '儲存失敗：' + error.message
    saveMsgType.value = 'error'
  } else {
    profile.value.Name    = payload.Name
    profile.value.Phone   = payload.Phone
    profile.value.Gender  = payload.Gender
    profile.value.Birthday = payload.Birthday
    saveMsg.value  = '已儲存'
    saveMsgType.value = 'success'
    setTimeout(() => { saveMsg.value = '' }, 2500)
  }
  isSaving.value = false
}

async function onSignOut() {
  await auth.signOut()
  router.push('/')
}

onMounted(() => {
  if (!auth.isLoggedIn) { router.push('/login'); return }
  fetchProfile()
  fetchOrders()
})
</script>

<template>
  <div class="ac-page">

    <!-- Hero -->
    <div class="ac-hero">
      <div class="ac-avatar">{{ userInitial }}</div>
      <div class="ac-hero__info">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <h1 class="ac-hero__name">{{ profile?.Name || '會員' }}</h1>
          <span v-if="memberLevelName === 'VIP 會員'" class="ac-vip-badge">VIP</span>
        </div>
        <p class="ac-hero__email">{{ displayEmail }}</p>
        <p v-if="memberLevelName" class="ac-hero__level">{{ memberLevelName }}</p>
      </div>
    </div>

    <div class="ac-body" v-if="!isLoading">

      <!-- Profile form -->
      <section class="ac-section">
        <h2 class="ac-section__title">基本資料</h2>

        <div class="ac-form">
          <div class="ac-field">
            <label>姓名</label>
            <input v-model="form.Name" type="text" placeholder="請輸入姓名" maxlength="30" />
          </div>
          <div class="ac-field">
            <label>手機號碼</label>
            <input
              v-model="form.Phone"
              type="tel"
              placeholder="0912-345-678"
              maxlength="15"
              @input="form.Phone = form.Phone.replace(/[^0-9-]/g, '')"
            />
          </div>
          <div class="ac-field-row">
            <div class="ac-field">
              <label>性別</label>
              <select v-model="form.Gender" class="ac-select">
                <option value="">不填寫</option>
                <option value="F">女</option>
                <option value="M">男</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="ac-field">
              <label>生日</label>
              <input v-model="form.Birthday" type="date" />
            </div>
          </div>
          <div class="ac-field">
            <label>Email</label>
            <input :value="displayEmail" type="email" disabled class="ac-input--disabled" />
          </div>

          <p v-if="saveMsg" :class="['ac-msg', `ac-msg--${saveMsgType}`]">{{ saveMsg }}</p>

          <button class="ac-btn-save" @click="saveProfile" :disabled="isSaving">
            {{ isSaving ? '儲存中...' : '儲存變更' }}
          </button>
        </div>
      </section>

      <!-- Orders shortcut -->
      <section class="ac-section">
        <div class="ac-section-head">
          <h2 class="ac-section__title">最近訂單</h2>
          <RouterLink to="/orders" class="ac-section-link">查看全部 →</RouterLink>
        </div>

        <div v-if="ordersLoading" class="ac-empty">
          <div class="ac-spinner"></div>
        </div>

        <div v-else-if="recentOrders.length === 0" class="ac-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>尚無訂單紀錄</p>
        </div>

        <div v-else class="ac-order-list">
          <RouterLink
            v-for="o in recentOrders"
            :key="o.ID"
            :to="'/orders/' + o.OrderNo"
            class="ac-order-row"
          >
            <div class="ac-order-row__no">
              {{ o.OrderNo }}
              <span v-if="o.OrderType === 'preorder'" class="ac-pay-badge ac-pay-badge--preorder" style="font-size:10px; margin-left:6px;">預購</span>
            </div>
            <div class="ac-order-row__date">{{ formatDate(o.CreatedDate) }}</div>
            <div class="ac-order-row__amount">NT$ {{ Number(o.WalletDeductAmt > 0 ? (o.NewebpayAmt ?? o.FinalAmount) : o.FinalAmount).toLocaleString() }}</div>
            <span :class="['ac-pay-badge', `ac-pay-badge--${o.PaymentStatus}`]">
              {{ payStatusLabel(o.PaymentStatus) }}
            </span>
          </RouterLink>
        </div>

        <RouterLink to="/orders" class="ac-orders-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <span>查看全部訂單</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="ac-orders-btn__arrow"><path d="M9 18l6-6-6-6"/></svg>
        </RouterLink>
      </section>

      <!-- Wallet shortcut -->
      <RouterLink to="/wallet" class="ac-wishlist-link ac-wallet-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="5" width="22" height="14" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <span>我的錢包</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="ac-wishlist-link__arrow"><path d="M9 18l6-6-6-6"/></svg>
      </RouterLink>

      <!-- Wishlist shortcut -->
      <RouterLink to="/wishlist" class="ac-wishlist-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>查看我的喜好清單</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="ac-wishlist-link__arrow"><path d="M9 18l6-6-6-6"/></svg>
      </RouterLink>

      <!-- LINE 綁定狀態 -->
      <section class="ac-section">
        <h2 class="ac-section__title">帳號綁定</h2>
        <div class="ac-bind-row">
          <div class="ac-bind-icon ac-bind-icon--line">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
          </div>
          <div class="ac-bind-info">
            <div class="ac-bind-name">LINE 通知</div>
            <div v-if="lineUserID" class="ac-bind-status ac-bind-status--ok">已綁定，直播訂單通知已開啟</div>
            <div v-else class="ac-bind-status ac-bind-status--no">尚未綁定</div>
          </div>
          <a
            v-if="!lineUserID"
            :href="`https://line.me/R/ti/p/@563sjoch`"
            target="_blank"
            rel="noopener"
            class="ac-bind-btn"
          >
            加入好友綁定
          </a>
          <span v-else class="ac-bind-done">✓</span>
        </div>
      </section>

      <!-- Danger zone -->
      <div class="ac-signout-wrap">
        <button class="ac-btn-signout" @click="onSignOut">登出帳號</button>
      </div>

    </div>

    <!-- Loading -->
    <div v-else class="ac-loading">
      <div class="ac-spinner"></div>
    </div>

  </div>
</template>

<style scoped>
.ac-page {
  min-height: 100vh;
  background: var(--fe-cream);
  padding-top: 68px;
}

/* Hero */
.ac-hero {
  background: var(--fe-white);
  border-bottom: 1px solid var(--fe-border);
  padding: 48px 36px 40px;
  display: flex;
  align-items: center;
  gap: 24px;
  max-width: 720px;
  margin: 0 auto;
}

.ac-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--fe-linen);
  border: 2px solid var(--fe-gold);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: var(--fe-gold-d);
  flex-shrink: 0;
  font-family: 'Cormorant Garamond', Georgia, serif;
}

.ac-hero__name {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 4px;
  color: var(--fe-text);
}

.ac-hero__email {
  font-size: 13px;
  color: var(--fe-muted);
  margin: 0 0 2px;
}

.ac-hero__level {
  font-size: 12px;
  color: var(--fe-muted);
  margin: 0;
  letter-spacing: 0.04em;
}

.ac-vip-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  background: linear-gradient(135deg, #c8a882, #a07850);
  color: #fff;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

/* Body */
.ac-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 36px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Section */
.ac-section {
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  border-radius: 12px;
  padding: 28px;
}

.ac-section__title {
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
  margin: 0 0 24px;
  font-weight: 500;
}

/* Form */
.ac-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ac-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ac-field label {
  font-size: 12px;
  letter-spacing: 0.05em;
  color: var(--fe-muted);
  font-weight: 500;
}

.ac-field input {
  padding: 11px 14px;
  border: 1px solid var(--fe-border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--fe-text);
  background: var(--fe-white);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

.ac-field input:focus {
  border-color: var(--fe-gold);
  box-shadow: 0 0 0 3px rgba(200,168,130,0.18);
}

.ac-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.ac-select {
  padding: 11px 14px;
  border: 1px solid var(--fe-border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--fe-text);
  background: var(--fe-white);
  outline: none;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ac-select:focus {
  border-color: var(--fe-gold);
  box-shadow: 0 0 0 3px rgba(200,168,130,0.18);
}

.ac-input--disabled {
  background: var(--fe-cream) !important;
  color: var(--fe-muted) !important;
  cursor: not-allowed;
}

.ac-msg {
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 8px;
  margin: 0;
}

.ac-msg--success {
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.28);
  color: rgba(20,83,45,0.95);
}

.ac-msg--error {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.22);
  color: rgba(127,29,29,0.95);
}

.ac-btn-save {
  align-self: flex-start;
  padding: 11px 32px;
  background: var(--fe-text);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ac-btn-save:hover   { opacity: 0.82; }
.ac-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* Section head */
.ac-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.ac-section-head .ac-section__title { margin-bottom: 0; }

.ac-section-link {
  font-size: 12px;
  color: var(--fe-gold-d);
  text-decoration: none;
  letter-spacing: 0.04em;
  transition: opacity 0.15s;
}
.ac-section-link:hover { opacity: 0.7; }

/* Orders → full list button */
.ac-orders-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding: 14px 18px;
  border: 1px solid var(--fe-border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--fe-text);
  font-size: 13.5px;
  transition: border-color 0.2s, background 0.2s;
}
.ac-orders-btn:hover {
  border-color: var(--fe-gold);
  background: var(--fe-cream);
}
.ac-orders-btn svg:first-child { color: var(--fe-gold-d); flex-shrink: 0; }
.ac-orders-btn span { flex: 1; }
.ac-orders-btn__arrow { color: var(--fe-muted); flex-shrink: 0; }

/* Empty */
.ac-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0 20px;
  color: var(--fe-muted);
  font-size: 13px;
  letter-spacing: 0.05em;
}

/* Order list */
.ac-order-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ac-order-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--fe-border);
  font-size: 13px;
  color: var(--fe-text);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 4px;
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
}

.ac-order-row:hover { background: var(--fe-cream); }
.ac-order-row:last-child { border-bottom: none; }

.ac-order-row__no {
  font-weight: 500;
  letter-spacing: 0.03em;
  font-size: 12.5px;
}

.ac-order-row__date {
  color: var(--fe-muted);
  font-size: 12px;
  white-space: nowrap;
}

.ac-order-row__amount {
  font-weight: 500;
  white-space: nowrap;
}

.ac-pay-badge {
  font-size: 11px;
  letter-spacing: 0.05em;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.ac-pay-badge--paid     { background: rgba(34,197,94,0.12); color: #15803D; }
.ac-pay-badge--pending  { background: rgba(180,180,180,0.15); color: var(--fe-muted); }
.ac-pay-badge--failed   { background: rgba(220,38,38,0.08); color: #DC2626; }
.ac-pay-badge--preorder { background: rgba(200,168,130,0.15); color: #c8a882; }

/* Wishlist link */
.ac-wishlist-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 28px;
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  border-radius: 12px;
  text-decoration: none;
  color: var(--fe-text);
  font-size: 14px;
  transition: border-color 0.2s, background 0.2s;
}

.ac-wishlist-link:hover {
  border-color: var(--fe-gold);
  background: var(--fe-cream);
}

.ac-wishlist-link svg:first-child { color: var(--fe-gold-d); flex-shrink: 0; }
.ac-wallet-link svg:first-child { color: #7c3aed; }

.ac-wishlist-link span { flex: 1; }

.ac-wishlist-link__arrow { color: var(--fe-muted); flex-shrink: 0; }

/* Sign out */
.ac-signout-wrap { text-align: right; }

.ac-btn-signout {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fe-muted);
  background: none;
  border: 1px solid var(--fe-border);
  padding: 9px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.ac-btn-signout:hover {
  color: #b91c1c;
  border-color: rgba(185,28,28,0.3);
}

/* Bind row */
.ac-bind-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ac-bind-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ac-bind-icon--line { background: #06C755; color: #fff; }

.ac-bind-info { flex: 1; }

.ac-bind-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--fe-text);
  margin-bottom: 3px;
}

.ac-bind-status {
  font-size: 12px;
}
.ac-bind-status--ok { color: #15803D; }
.ac-bind-status--no { color: var(--fe-muted); }

.ac-bind-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: #06C755;
  color: #fff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.2s;
  flex-shrink: 0;
}
.ac-bind-btn:hover { opacity: 0.85; }

.ac-bind-done {
  font-size: 16px;
  color: #06C755;
  flex-shrink: 0;
}

/* Loading */
.ac-loading {
  display: flex;
  justify-content: center;
  padding: 100px 0;
}

.ac-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 767px) {
  .ac-hero  { padding: 32px 20px 28px; }
  .ac-body  { padding: 20px 16px 60px; }
  .ac-section { padding: 20px; }
}
</style>
