<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { db } from '@/lib/db'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

// ── Date range ────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────
const loading    = ref(false)
const rows       = ref([])   // [{ source, clicks, pct }]
const dailyData  = ref([])   // [{ date, source, clicks }] for chart

// Source 中文標籤與顏色
const SOURCE_META = {
  '廣告來源': { color: '#6366f1', hint: '從外部網站（FB/IG/Google/LINE等）進入' },
  '購物車':   { color: '#10b981', hint: '從購物車頁跳轉到商品頁' },
  '願望清單': { color: '#f59e0b', hint: '從願望清單跳轉到商品頁' },
  '直接':     { color: '#94a3b8', hint: '直接輸入網址或書籤' },
}
const SOURCE_ORDER = Object.keys(SOURCE_META)

// ── Chart ─────────────────────────────────────────────
const barRef = ref(null)
let chartInstance = null

function buildChart() {
  if (!barRef.value) return
  if (chartInstance) chartInstance.destroy()

  const sources  = rows.value.map(r => r.source)
  const clickCts = rows.value.map(r => r.clicks)
  const colors   = rows.value.map(r => SOURCE_META[r.source]?.color ?? '#C8A882')

  chartInstance = new Chart(barRef.value, {
    type: 'bar',
    data: {
      labels: sources,
      datasets: [{
        label: '點擊數',
        data: clickCts,
        backgroundColor: colors,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `點擊數：${ctx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 11 }, callback: v => v.toLocaleString() }
        }
      }
    }
  })
}

// ── Load ──────────────────────────────────────────────
async function load() {
  loading.value = true

  const { start, end } = range.value
  const { data: logs } = await db
    .from('C_ANL_ProductClickLog')
    .select('Source, CreatedDate')
    .gte('CreatedDate', start + 'T00:00:00')
    .lte('CreatedDate', end + 'T23:59:59')
    .catch(() => ({ data: [] }))

  if (!logs?.length) {
    rows.value = []
    loading.value = false
    return
  }

  // 按 Source 聚合
  const sourceMap = {}
  logs.forEach(log => {
    const s = log.Source || '直接'
    sourceMap[s] = (sourceMap[s] || 0) + 1
  })

  const total = logs.length
  rows.value = SOURCE_ORDER
    .filter(s => sourceMap[s])
    .map(s => ({
      source: s,
      clicks: sourceMap[s],
      pct:    sourceMap[s] / total,
    }))
  // 加入未知來源
  Object.entries(sourceMap).forEach(([s, c]) => {
    if (!SOURCE_ORDER.includes(s)) {
      rows.value.push({ source: s, clicks: c, pct: c / total })
    }
  })
  rows.value.sort((a, b) => b.clicks - a.clicks)

  loading.value = false
  await nextTick()
  buildChart()
}

watch(range, load, { deep: true })
onMounted(load)
onUnmounted(() => chartInstance?.destroy())

const totalClicks = computed(() => rows.value.reduce((s, r) => s + r.clicks, 0))
</script>

<template>
  <div class="container-fluid py-3">

    <!-- Header -->
    <div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
      <div>
        <h4 class="mb-0">流量來源分析</h4>
        <div class="text-muted small">官網消費者進入商品詳情頁前的來源分佈</div>
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
          <input type="date" class="form-control form-control-sm" style="width:140px" v-model="customStart" />
          <span class="text-muted">—</span>
          <input type="date" class="form-control form-control-sm" style="width:140px" v-model="customEnd" />
        </template>
      </div>
    </div>

    <div v-if="loading" class="text-muted py-5 text-center">載入中...</div>

    <div v-else-if="rows.length === 0" class="card">
      <div class="card-body text-center text-muted py-5">
        <div class="mb-2" style="font-size:32px">📊</div>
        <div class="fw-semibold mb-1">此區間尚無點擊資料</div>
        <div class="small">請確認已執行 <code>add_analytics_tracking.sql</code>，<br>並且消費者有在官網瀏覽商品詳情頁。</div>
      </div>
    </div>

    <template v-else>
      <!-- 總點擊 stat card -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="rpt-card">
            <div class="rpt-label">商品點擊總數</div>
            <div class="rpt-value">{{ totalClicks.toLocaleString() }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="rpt-card">
            <div class="rpt-label">來源種類數</div>
            <div class="rpt-value">{{ rows.length }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="rpt-card">
            <div class="rpt-label">最主要來源</div>
            <div class="rpt-value" style="font-size:20px">
              {{ rows[0]?.source }}
              <span class="text-muted" style="font-size:14px">{{ (rows[0]?.pct * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Chart + Table 並排 -->
      <div class="row g-3">
        <!-- Bar chart -->
        <div class="col-12 col-lg-5">
          <div class="card h-100">
            <div class="card-header fw-semibold small">點擊數分佈</div>
            <div class="card-body" style="height:280px">
              <canvas ref="barRef" />
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="col-12 col-lg-7">
          <div class="card h-100">
            <div class="card-header fw-semibold small">各來源明細</div>
            <div class="table-responsive">
              <table class="table table-hover mb-0 align-middle">
                <thead class="table-light">
                  <tr>
                    <th style="width:16px"></th>
                    <th>來源</th>
                    <th class="text-end">點擊數</th>
                    <th>點擊佔比</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in rows" :key="r.source">
                    <td>
                      <span class="color-dot" :style="{ background: SOURCE_META[r.source]?.color ?? '#C8A882' }"></span>
                    </td>
                    <td>
                      <div class="fw-semibold">{{ r.source }}</div>
                      <div v-if="SOURCE_META[r.source]?.hint" class="text-muted" style="font-size:11px">{{ SOURCE_META[r.source].hint }}</div>
                    </td>
                    <td class="text-end">{{ r.clicks.toLocaleString() }}</td>
                    <td style="min-width:160px">
                      <div class="d-flex align-items-center gap-2">
                        <div class="pct-bar">
                          <div class="pct-bar__fill"
                            :style="{ width: (r.pct * 100).toFixed(1) + '%', background: SOURCE_META[r.source]?.color ?? '#C8A882' }">
                          </div>
                        </div>
                        <span class="small text-muted">{{ (r.pct * 100).toFixed(1) }}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- 說明 -->
      <div class="text-muted small mt-3">
        <strong>來源判斷規則：</strong>
        <strong>廣告來源</strong> = 從外部網站進入（FB、IG、Google、LINE 等），LINE 訊息連結加 <code>?src=line</code> 也算廣告來源；
        <strong>購物車</strong> = 從購物車頁跳轉；
        <strong>願望清單</strong> = 從願望清單跳轉；
        <strong>直接</strong> = 直接輸入網址或書籤。<br>
        同一裝置同一天看過同一商品，點擊數只計一次（每日去重）。
      </div>
    </template>
  </div>
</template>

<style scoped>
.rpt-card {
  background: #fff;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 10px;
  padding: 18px 20px;
}
.rpt-label { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
.rpt-value { font-size: 26px; font-weight: 700; color: #111827; }

.color-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
}

.pct-bar {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}
.pct-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width .3s;
}
</style>
