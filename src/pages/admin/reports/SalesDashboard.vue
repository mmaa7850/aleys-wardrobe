<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { db } from '@/lib/db'
import { useRouter } from 'vue-router'
import { Chart, registerables } from 'chart.js'
import * as XLSX from 'xlsx'

Chart.register(...registerables)

const router = useRouter()

// ── Date range ───────────────────────────────────────────────
const preset = ref('month')
const customStart = ref('')
const customEnd   = ref('')

const today = new Date()
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

const range = computed(() => {
  const t = fmt(today)
  if (preset.value === 'today') return { start: t, end: t }
  if (preset.value === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 6)
    return { start: fmt(d), end: t }
  }
  if (preset.value === 'month') {
    return { start: t.slice(0,7) + '-01', end: t }
  }
  return { start: customStart.value || t, end: customEnd.value || t }
})

// ── State ─────────────────────────────────────────────────────
const loading = ref(false)
const stats = ref({
  revenue: 0, orders: 0, aov: 0, refunds: 0, lowStock: 0, estFee: 0,
  clicks: 0, convRate: null, buyers: 0,
})

// ── 估算藍新手續費 ─────────────────────────────────────────────
// 只有 NewebpayAmt > 0 的訂單才有手續費（全額錢包付款不經藍新）
function estimateFee(order) {
  const amt = order.NewebpayAmt ?? 0
  if (amt === 0) return 0
  const method = order.PaymentMethod ?? ''
  if (['CREDIT', 'APPLEPAY', 'GOOGLEPAY', 'SAMSUNGPAY', 'UNIONPAY', 'CREDITAE', 'LINEPAY'].includes(method)) {
    return Math.round(amt * 0.028)
  }
  if (['VACC', 'WEBATM'].includes(method)) {
    return Math.min(Math.round(amt * 0.01), 20)
  }
  return 0 // CVS / 其他：費率未知，不估算
}
const chartLabels = ref([])
const chartData   = ref([])

// ── Chart ─────────────────────────────────────────────────────
const canvasRef = ref(null)
let chartInstance = null

function buildChart() {
  if (!canvasRef.value) return
  if (chartInstance) chartInstance.destroy()
  chartInstance = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: chartLabels.value,
      datasets: [{
        label: '日營收 (NT$)',
        data: chartData.value,
        borderColor: '#C8A882',
        backgroundColor: 'rgba(200,168,130,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#C8A882',
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 11 }, callback: (v) => 'NT$' + v.toLocaleString() }
        }
      }
    }
  })
}

// ── Load ──────────────────────────────────────────────────────
async function load() {
  loading.value = true
  const { start, end } = range.value

  const [{ data: orders }, { data: lowStock }, { data: clicks }] = await Promise.all([
    db.from('C_ORD_OrderList')
      .select('ID, FinalAmount, PaymentStatus, CreatedDate, NewebpayAmt, PaymentMethod, "PaymentFee", MemberID')
      .gte('CreatedDate', start + 'T00:00:00')
      .lte('CreatedDate', end + 'T23:59:59'),
    db.from('C_PRD_ProductVariantList')
      .select('ID', { count: 'exact', head: true })
      .lte('StockQty', 3)
      .eq('IsActive', true),
    db.from('C_ANL_ProductClickLog')
      .select('ID', { count: 'exact', head: true })
      .gte('CreatedDate', start + 'T00:00:00')
      .lte('CreatedDate', end + 'T23:59:59')
      .catch(() => ({ data: null, count: 0 })),
  ])

  const paid     = (orders ?? []).filter(o => o.PaymentStatus === 'paid')
  const refunded = (orders ?? []).filter(o => o.PaymentStatus === 'refunded')
  const revenue  = paid.reduce((s, o) => s + (o.FinalAmount ?? 0), 0)

  // 優先使用 payment-notify 寫入的實際手續費；若為 null（舊訂單或錢包全額付款）則用估算值補充
  const estFee = paid.reduce((s, o) => {
    const actual = o.PaymentFee ?? null
    return s + (actual !== null ? Number(actual) : estimateFee(o))
  }, 0)

  const clickCount = clicks?.count ?? 0
  const paidCount  = paid.length
  const buyerCount = new Set(paid.map(o => o.MemberID).filter(Boolean)).size

  stats.value = {
    revenue,
    orders: (orders ?? []).length,
    aov: paidCount ? Math.round(revenue / paidCount) : 0,
    refunds: refunded.reduce((s, o) => s + (o.FinalAmount ?? 0), 0),
    lowStock: lowStock?.length ?? 0,
    estFee,
    clicks:   clickCount,
    convRate: clickCount > 0 ? paidCount / clickCount : null,
    buyers:   buyerCount,
  }

  // Build daily series
  const days = []
  const cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) { days.push(fmt(cur)); cur.setDate(cur.getDate() + 1) }

  const byDay = {}
  days.forEach(d => { byDay[d] = 0 })
  paid.forEach(o => {
    const d = o.CreatedDate?.slice(0, 10)
    if (d && byDay[d] !== undefined) byDay[d] += (o.FinalAmount ?? 0)
  })

  chartLabels.value = days.map(d => d.slice(5))
  chartData.value   = days.map(d => byDay[d])

  loading.value = false
  await nextTick()
  buildChart()
}

watch(range, load, { deep: true })
onMounted(load)
onUnmounted(() => chartInstance?.destroy())

// ── Excel 下載 ────────────────────────────────────────────────
function downloadExcel() {
  const { start, end } = range.value
  const wb = XLSX.utils.book_new()

  // Sheet 1：彙總
  const summaryData = [
    ['項目', '數值'],
    ['期間', `${start} ~ ${end}`],
    ['已付款營收 (NT$)', stats.value.revenue],
    ['訂單數（全部）', stats.value.orders],
    ['客單價（已付款）(NT$)', stats.value.aov],
    ['退款金額 (NT$)', stats.value.refunds],
    ['估算藍新手續費 (NT$)', stats.value.estFee],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  ws1['!cols'] = [{ wch: 22 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws1, '彙總')

  // Sheet 2：每日明細
  const dailyData = [['日期', '已付款營收 (NT$)']]
  chartLabels.value.forEach((label, i) => {
    // label 是 MM-DD，補回年份
    const fullDate = `${start.slice(0, 4)}-${label}`
    dailyData.push([fullDate, chartData.value[i]])
  })
  const ws2 = XLSX.utils.aoa_to_sheet(dailyData)
  ws2['!cols'] = [{ wch: 14 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws2, '每日明細')

  XLSX.writeFile(wb, `銷售總覽_${start}_${end}.xlsx`)
}
</script>

<template>
  <div class="container-fluid py-3">
    <div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
      <div>
        <h4 class="mb-0">銷售總覽</h4>
        <div class="text-muted small">收入、訂單、客單價</div>
      </div>
      <!-- Date preset + 下載 -->
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <div class="btn-group btn-group-sm">
          <button
            v-for="p in [['today','今日'],['week','本週'],['month','本月'],['custom','自訂']]"
            :key="p[0]"
            class="btn"
            :class="preset === p[0] ? 'btn-dark' : 'btn-outline-secondary'"
            @click="preset = p[0]"
          >{{ p[1] }}</button>
        </div>
        <template v-if="preset === 'custom'">
          <input type="date" class="form-control form-control-sm" style="width:140px" v-model="customStart" />
          <span class="text-muted">—</span>
          <input type="date" class="form-control form-control-sm" style="width:140px" v-model="customEnd" />
        </template>
        <button
          class="btn btn-sm btn-outline-success"
          :disabled="loading"
          @click="downloadExcel"
          title="下載 Excel"
        >⬇ Excel</button>
      </div>
    </div>

    <div v-if="loading" class="text-muted py-5 text-center">載入中...</div>

    <template v-else>
      <!-- Stat cards -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">已付款營收</div>
            <div class="rpt-value text-success">NT$ {{ stats.revenue.toLocaleString() }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">訂單數（全部）</div>
            <div class="rpt-value">{{ stats.orders }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">客單價（已付款）</div>
            <div class="rpt-value">NT$ {{ stats.aov.toLocaleString() }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="rpt-card" :class="{ 'rpt-card--warn': stats.refunds > 0 }">
            <div class="rpt-label">退款金額</div>
            <div class="rpt-value">NT$ {{ stats.refunds.toLocaleString() }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">
              估算藍新手續費
              <span class="rpt-hint">信用卡 2.8%／ATM min(1%,20)</span>
            </div>
            <div class="rpt-value text-danger">NT$ {{ stats.estFee.toLocaleString() }}</div>
          </div>
        </div>
        <!-- 流量指標 -->
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">
              商品點擊數
              <span class="rpt-hint">消費者進入商品詳情頁次數</span>
            </div>
            <div class="rpt-value">
              <span v-if="stats.clicks > 0">{{ stats.clicks.toLocaleString() }}</span>
              <span v-else class="text-muted" style="font-size:16px">尚無資料</span>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">
              訂單轉換率
              <span class="rpt-hint">已付款訂單數 ÷ 商品點擊數</span>
            </div>
            <div class="rpt-value">
              <span v-if="stats.convRate !== null">{{ (stats.convRate * 100).toFixed(2) }}%</span>
              <span v-else class="text-muted" style="font-size:16px">—</span>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="rpt-card">
            <div class="rpt-label">
              買家數
              <span class="rpt-hint">已付款訂單中的不重複會員</span>
            </div>
            <div class="rpt-value">{{ stats.buyers.toLocaleString() }}</div>
          </div>
        </div>
      </div>

      <!-- Low stock alert -->
      <div v-if="stats.lowStock > 0" class="alert alert-warning d-flex gap-2 align-items-center mb-4">
        <span>⚠️</span>
        <span>
          有 <strong>{{ stats.lowStock }}</strong> 個規格庫存 ≤ 3
          <a class="ms-2 alert-link" href="#" @click.prevent="router.push('/admin/inventory/overview')">查看庫存總覽 →</a>
        </span>
      </div>

      <!-- Chart -->
      <div class="card">
        <div class="card-header">
          <span class="fw-semibold small">每日已付款營收</span>
        </div>
        <div class="card-body" style="height:280px">
          <canvas ref="canvasRef" />
        </div>
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
.rpt-card--warn { border-color: #f59e0b; background: #fffbeb; }
.rpt-label { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
.rpt-value { font-size: 24px; font-weight: 700; color: #111827; }
.rpt-hint { display: block; font-size: 11px; color: #9ca3af; font-weight: 400; margin-top: 2px; }
</style>
