<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { db } from '@/lib/db'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

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

// ── Taiwan county/city regex ───────────────────────────
const CITY_RE = /(台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)/

function extractCity(addr) {
  if (!addr) return '未知'
  const m = addr.match(CITY_RE)
  if (!m) return '其他'
  return m[1].replace('臺', '台')
}

// ── State ──────────────────────────────────────────────
const loading = ref(false)
const rows    = ref([])   // [{ city, orders, amount, avg, pct }]

// ── Chart ──────────────────────────────────────────────
const barRef = ref(null)
let chartInstance = null

function buildChart() {
  if (!barRef.value || !rows.value.length) return
  if (chartInstance) chartInstance.destroy()

  const labels = rows.value.map(r => r.city)
  const counts = rows.value.map(r => r.orders)

  chartInstance = new Chart(barRef.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '訂單數',
        data: counts,
        backgroundColor: '#6366f1',
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `訂單數：${ctx.parsed.x.toLocaleString()}`
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, callback: v => v.toLocaleString() } },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } }
      }
    }
  })
}

// ── Load ───────────────────────────────────────────────
async function load() {
  loading.value = true
  rows.value = []

  const { start, end } = range.value
  const startDt = start + 'T00:00:00'
  const endDt   = end   + 'T23:59:59'

  const { data } = await db
    .from('C_ORD_OrderList')
    .select('ShippingAddress, FinalAmount')
    .eq('PaymentStatus', 'paid')
    .gte('CreatedDate', startDt)
    .lte('CreatedDate', endDt)

  if (!data?.length) { loading.value = false; return }

  const cityMap = {}
  data.forEach(o => {
    const city = extractCity(o.ShippingAddress)
    if (!cityMap[city]) cityMap[city] = { orders: 0, amount: 0 }
    cityMap[city].orders++
    cityMap[city].amount += o.FinalAmount || 0
  })

  const total = data.length
  rows.value = Object.entries(cityMap)
    .map(([city, v]) => ({
      city,
      orders: v.orders,
      amount: v.amount,
      avg:    Math.round(v.amount / v.orders),
      pct:    v.orders / total,
    }))
    .sort((a, b) => b.orders - a.orders)

  loading.value = false
  await nextTick()
  buildChart()
}

watch(range, load, { deep: true })
onMounted(load)
onUnmounted(() => chartInstance?.destroy())

const totalOrders = computed(() => rows.value.reduce((s, r) => s + r.orders, 0))
const totalAmount = computed(() => rows.value.reduce((s, r) => s + r.amount, 0))
const chartHeight = computed(() => Math.max(200, rows.value.length * 36 + 40) + 'px')
</script>

<template>
  <div class="container-fluid py-3">

    <!-- Header -->
    <div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
      <div>
        <h4 class="mb-0">消費者所在縣市統計</h4>
        <div class="text-muted small">依已付款訂單的收件地址統計各縣市分佈</div>
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
              <div class="text-muted small mb-1">訂單總數</div>
              <div class="fw-bold fs-5">{{ totalOrders.toLocaleString() }}</div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="text-muted small mb-1">總金額</div>
              <div class="fw-bold fs-5">NT$ {{ totalAmount.toLocaleString() }}</div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="text-muted small mb-1">涵蓋縣市數</div>
              <div class="fw-bold fs-5">{{ rows.length }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- No data -->
      <div v-if="!rows.length" class="text-center text-muted py-5">此期間無已付款訂單</div>

      <template v-else>
        <!-- Chart -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body">
            <div :style="{ height: chartHeight, position: 'relative' }">
              <canvas ref="barRef"></canvas>
            </div>
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
                    <th>縣市</th>
                    <th class="text-end">訂單數</th>
                    <th class="text-end">佔比</th>
                    <th class="text-end">訂單金額</th>
                    <th class="text-end">平均客單價</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in rows" :key="r.city">
                    <td class="text-muted">{{ i + 1 }}</td>
                    <td class="fw-semibold">{{ r.city }}</td>
                    <td class="text-end">{{ r.orders.toLocaleString() }}</td>
                    <td class="text-end">
                      <span class="text-muted small">{{ (r.pct * 100).toFixed(1) }}%</span>
                      <div class="progress mt-1" style="height:4px;min-width:60px">
                        <div class="progress-bar bg-primary" :style="{ width: (r.pct * 100) + '%' }"></div>
                      </div>
                    </td>
                    <td class="text-end">NT$ {{ r.amount.toLocaleString() }}</td>
                    <td class="text-end">NT$ {{ r.avg.toLocaleString() }}</td>
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
