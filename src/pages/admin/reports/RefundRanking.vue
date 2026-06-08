<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { db } from '@/lib/db'

// ── Date range ─────────────────────────────────────────
const preset      = ref('month')
const customStart = ref('')
const customEnd   = ref('')
const today       = new Date()
const pad = n => String(n).padStart(2, '0')
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

const range = computed(() => {
  const t = fmt(today)
  if (preset.value === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 6)
    return { start: fmt(d), end: t }
  }
  if (preset.value === 'month')   return { start: t.slice(0,7) + '-01', end: t }
  if (preset.value === '3months') {
    const d = new Date(today); d.setMonth(d.getMonth() - 2); d.setDate(1)
    return { start: fmt(d), end: t }
  }
  return { start: customStart.value || t, end: customEnd.value || t }
})

// ── State ──────────────────────────────────────────────
const loading = ref(false)
const rows    = ref([])   // [{ email, name, phone, refundCount, refundAmount, avgAmount }]
const sortBy  = ref('amount')

const sorted = computed(() => {
  return [...rows.value].sort((a, b) =>
    sortBy.value === 'count'  ? b.refundCount  - a.refundCount :
    sortBy.value === 'amount' ? b.refundAmount - a.refundAmount : 0
  )
})

// ── Load ───────────────────────────────────────────────
async function load() {
  loading.value = true
  rows.value = []

  const { start, end } = range.value
  const startDt = start + 'T00:00:00'
  const endDt   = end   + 'T23:59:59'

  const { data } = await db
    .from('C_ORD_OrderList')
    .select('CustomerName, CustomerEmail, CustomerPhone, FinalAmount, UpdatedDate')
    .eq('PaymentStatus', 'refunded')
    .gte('CreatedDate', startDt)
    .lte('CreatedDate', endDt)

  if (!data?.length) { loading.value = false; return }

  const map = {}
  data.forEach(o => {
    const key = o.CustomerEmail || o.CustomerPhone || o.CustomerName
    if (!map[key]) {
      map[key] = {
        email: o.CustomerEmail,
        name:  o.CustomerName,
        phone: o.CustomerPhone,
        refundCount:  0,
        refundAmount: 0,
      }
    }
    map[key].refundCount++
    map[key].refundAmount += o.FinalAmount || 0
  })

  rows.value = Object.values(map).map(r => ({
    ...r,
    avgAmount: Math.round(r.refundAmount / r.refundCount),
  }))

  loading.value = false
}

watch(range, load, { deep: true })
onMounted(load)

const totalRefunds = computed(() => rows.value.reduce((s, r) => s + r.refundCount, 0))
const totalAmount  = computed(() => rows.value.reduce((s, r) => s + r.refundAmount, 0))
const maxAmount    = computed(() => Math.max(...rows.value.map(r => r.refundAmount), 1))
</script>

<template>
  <div class="container-fluid py-3">

    <!-- Header -->
    <div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
      <div>
        <h4 class="mb-0">消費者退款排行</h4>
        <div class="text-muted small">依已退款訂單統計各消費者的退款次數與金額</div>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <div class="btn-group btn-group-sm">
          <button
            v-for="p in [['week','本週'],['month','本月'],['3months','近3月'],['custom','自訂']]"
            :key="p[0]" class="btn"
            :class="preset === p[0] ? 'btn-dark' : 'btn-outline-secondary'"
            @click="preset = p[0]">{{ p[1] }}</button>
        </div>
        <template v-if="preset === 'custom'">
          <input v-model="customStart" type="date" class="form-control form-control-sm" style="width:130px" />
          <span class="text-muted small">~</span>
          <input v-model="customEnd"  type="date" class="form-control form-control-sm" style="width:130px" />
        </template>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-5 text-muted">載入中…</div>

    <template v-else>

      <!-- Summary cards -->
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="text-muted small mb-1">退款訂單總數</div>
              <div class="fw-bold fs-5 text-danger">{{ totalRefunds.toLocaleString() }}</div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="text-muted small mb-1">退款總金額</div>
              <div class="fw-bold fs-5 text-danger">NT$ {{ totalAmount.toLocaleString() }}</div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="text-muted small mb-1">退款人數</div>
              <div class="fw-bold fs-5">{{ rows.length.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- No data -->
      <div v-if="!rows.length" class="text-center text-muted py-5">此期間無退款訂單</div>

      <template v-else>
        <!-- Sort -->
        <div class="d-flex gap-2 mb-3 align-items-center">
          <span class="text-muted small">排序：</span>
          <div class="btn-group btn-group-sm">
            <button class="btn" :class="sortBy === 'amount' ? 'btn-dark' : 'btn-outline-secondary'" @click="sortBy = 'amount'">依退款金額</button>
            <button class="btn" :class="sortBy === 'count'  ? 'btn-dark' : 'btn-outline-secondary'" @click="sortBy = 'count'">依退款次數</button>
          </div>
        </div>

        <!-- Table -->
        <div class="card border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width:50px">#</th>
                    <th>姓名</th>
                    <th>Email</th>
                    <th>電話</th>
                    <th class="text-end">退款次數</th>
                    <th class="text-end">退款金額</th>
                    <th class="text-end">平均退款金額</th>
                    <th style="width:120px">佔比</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in sorted" :key="r.email || r.name">
                    <td class="text-muted">{{ i + 1 }}</td>
                    <td class="fw-semibold">{{ r.name || '—' }}</td>
                    <td class="text-muted small">{{ r.email || '—' }}</td>
                    <td class="text-muted small">{{ r.phone || '—' }}</td>
                    <td class="text-end">
                      <span class="badge rounded-pill" :class="r.refundCount >= 3 ? 'bg-danger' : r.refundCount >= 2 ? 'bg-warning text-dark' : 'bg-secondary'">
                        {{ r.refundCount }}
                      </span>
                    </td>
                    <td class="text-end fw-semibold text-danger">NT$ {{ r.refundAmount.toLocaleString() }}</td>
                    <td class="text-end text-muted small">NT$ {{ r.avgAmount.toLocaleString() }}</td>
                    <td>
                      <div class="progress" style="height:6px">
                        <div class="progress-bar bg-danger" :style="{ width: (r.refundAmount / maxAmount * 100) + '%' }"></div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>

    </template>
  </div>
</template>
