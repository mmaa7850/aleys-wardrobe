<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'

const coupons = ref([])
const loading = ref(false)
const copied = ref(null)

const autoCoupons = computed(() => coupons.value.filter(c => c.IsAutoApply))
const manualCoupons = computed(() => coupons.value.filter(c => !c.IsAutoApply))

onMounted(async () => {
  loading.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await db
      .from('S_PRM_CouponList')
      .select('ID, Name, Description, DiscountValue, DiscountType, MinOrderAmount, IsAutoApply, StartDate, EndDate')
      .eq('IsActive', true)
      .lte('StartDate', today)
      .gte('EndDate', today)
      .gt('UsageCount', 0)
      .order('IsAutoApply', { ascending: false })
      .order('EndDate', { ascending: true })
    coupons.value = data ?? []
  } finally {
    loading.value = false
  }
})

function copyCode(name) {
  navigator.clipboard.writeText(name).then(() => {
    copied.value = name
    setTimeout(() => { copied.value = null }, 2000)
  }).catch(() => {})
}

function discountLabel(c) {
  if (c.DiscountType === 'percent') return `${c.DiscountValue}%`
  return `NT$ ${Number(c.DiscountValue).toLocaleString()}`
}
</script>

<template>
  <div class="cp-root">
    <div class="cp-header">
      <p class="cp-eyebrow">Member Exclusive</p>
      <h1 class="cp-title">優惠券專區</h1>
      <p class="cp-sub">消費達門檻自動折抵，或輸入優惠碼享額外折扣</p>
    </div>

    <div v-if="loading" class="cp-loading">
      <div class="cp-spinner"></div>
    </div>

    <template v-else>
      <div v-if="coupons.length === 0" class="cp-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        <p>目前沒有可使用的優惠券</p>
        <p class="cp-empty__sub">敬請期待下次活動！</p>
      </div>

      <template v-else>
        <!-- 滿額自動折抵 -->
        <template v-if="autoCoupons.length > 0">
          <h2 class="cp-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            滿額自動折抵
          </h2>
          <div class="cp-grid">
            <div v-for="c in autoCoupons" :key="c.ID" class="cp-card cp-card--auto">
              <div class="cp-card__left">
                <span class="cp-card__label">折抵</span>
                <span class="cp-card__amount">{{ discountLabel(c) }}</span>
                <span class="cp-card__off">{{ c.DiscountType === 'percent' ? 'OFF' : '折抵' }}</span>
              </div>
              <div class="cp-card__divider"></div>
              <div class="cp-card__right">
                <div class="cp-card__auto-badge">自動折抵</div>
                <p class="cp-card__desc">{{ c.Description }}</p>
                <div class="cp-card__meta">
                  <span v-if="c.MinOrderAmount" class="cp-card__min">
                    消費滿 NT$ {{ Number(c.MinOrderAmount).toLocaleString() }} 自動套用
                  </span>
                  <span class="cp-card__expiry">{{ c.EndDate }} 到期</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 手動優惠碼 -->
        <template v-if="manualCoupons.length > 0">
          <h2 class="cp-section-title" :class="{ 'cp-section-title--mt': autoCoupons.length > 0 }">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            優惠碼
          </h2>
          <div class="cp-grid">
            <div v-for="c in manualCoupons" :key="c.ID" class="cp-card">
              <div class="cp-card__left">
                <span class="cp-card__label">折扣</span>
                <span class="cp-card__amount">{{ discountLabel(c) }}</span>
                <span class="cp-card__off">{{ c.DiscountType === 'percent' ? 'OFF' : '折抵' }}</span>
              </div>
              <div class="cp-card__divider"></div>
              <div class="cp-card__right">
                <div class="cp-card__code-row">
                  <code class="cp-card__code">{{ c.Name }}</code>
                  <button
                    class="cp-card__copy"
                    :class="{ 'cp-card__copy--done': copied === c.Name }"
                    @click="copyCode(c.Name)"
                  >
                    <template v-if="copied === c.Name">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      已複製
                    </template>
                    <template v-else>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      複製
                    </template>
                  </button>
                </div>
                <p class="cp-card__desc">{{ c.Description }}</p>
                <div class="cp-card__meta">
                  <span v-if="c.MinOrderAmount" class="cp-card__min">
                    滿 NT$ {{ Number(c.MinOrderAmount).toLocaleString() }} 可用
                  </span>
                  <span class="cp-card__expiry">{{ c.EndDate }} 到期</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.cp-root {
  padding-top: 68px;
  min-height: 80vh;
  max-width: 860px;
  margin: 0 auto;
  padding-left: 36px;
  padding-right: 36px;
  padding-bottom: 96px;
}

.cp-header {
  padding: 48px 0 40px;
  text-align: center;
}

.cp-eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 10px;
}

.cp-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 500;
  margin: 0 0 12px;
  color: var(--fe-text);
}

.cp-sub {
  font-size: 13.5px;
  color: var(--fe-muted);
  margin: 0;
}

.cp-loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

.cp-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.cp-empty {
  text-align: center;
  padding: 80px 0;
}

.cp-empty svg {
  color: var(--fe-linen);
  margin-bottom: 20px;
}

.cp-empty p {
  margin: 0 0 6px;
  font-size: 15px;
  color: var(--fe-text);
}

.cp-empty__sub {
  font-size: 13px !important;
  color: var(--fe-muted) !important;
}

/* Section title */
.cp-section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 16px;
}

.cp-section-title--mt { margin-top: 40px; }

.cp-section-title svg { color: var(--fe-gold-d); flex-shrink: 0; }

/* Grid */
.cp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* Card */
.cp-card {
  display: flex;
  border: 1px solid var(--fe-border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--fe-white);
}

/* Left panel */
.cp-card__left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--fe-cream);
  padding: 24px 18px;
  min-width: 100px;
  text-align: center;
  flex-shrink: 0;
}

.cp-card__label {
  font-size: 9.5px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin-bottom: 6px;
}

.cp-card__amount {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 24px;
  font-weight: 600;
  color: var(--fe-text);
  line-height: 1.1;
}

.cp-card__off {
  font-size: 10.5px;
  color: var(--fe-muted);
  margin-top: 4px;
}

/* Divider */
.cp-card__divider {
  width: 0;
  border-left: 1.5px dashed var(--fe-border);
  flex-shrink: 0;
  margin: 14px 0;
}

/* Right panel */
.cp-card__right {
  flex: 1;
  padding: 18px 18px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.cp-card__code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cp-card__code {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--fe-text);
  background: var(--fe-linen);
  padding: 3px 8px;
  border-radius: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-card__copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--fe-border);
  background: var(--fe-white);
  color: var(--fe-muted);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  border-radius: 2px;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}

.cp-card__copy:hover {
  border-color: var(--fe-text);
  color: var(--fe-text);
}

.cp-card__copy--done {
  border-color: #15803D;
  color: #15803D;
  background: rgba(21, 128, 61, 0.06);
}

.cp-card--auto .cp-card__left {
  background: rgba(200, 168, 130, 0.2);
}

.cp-card__auto-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  background: var(--fe-gold-d);
  color: #fff;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  border-radius: 2px;
  font-weight: 500;
  align-self: flex-start;
}

.cp-card__desc {
  font-size: 12.5px;
  color: var(--fe-muted);
  margin: 0;
  line-height: 1.5;
}

.cp-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}

.cp-card__min {
  font-size: 11px;
  color: var(--fe-gold-d);
  background: rgba(200, 168, 130, 0.15);
  padding: 2px 7px;
  border-radius: 2px;
}

.cp-card__expiry {
  font-size: 11px;
  color: var(--fe-muted);
}

@media (max-width: 767px) {
  .cp-root {
    padding-left: 16px;
    padding-right: 16px;
  }

  .cp-grid {
    grid-template-columns: 1fr;
  }

  .cp-card__left {
    min-width: 88px;
    padding: 20px 14px;
  }
}
</style>
