<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { db } from '@/lib/db'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const loading = ref(false)
const stats = ref({ total: 0, activeThisMonth: 0, repeatBuyers: 0 })
const canvasRef = ref(null)
let chartInstance = null

const pad = (n) => String(n).padStart(2, '0')

function buildChart(labels, values) {
  if (!canvasRef.value) return
  if (chartInstance) chartInstance.destroy()
  chartInstance = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '新增會員',
        data: values,
        backgroundColor: 'rgba(200,168,130,0.65)',
        borderColor: '#C8A882',
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 11 }, stepSize: 1, precision: 0 },
          beginAtZero: true,
        }
      }
    }
  })
}

async function load() {
  loading.value = true

  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01T00:00:00`

  // Last 12 months labels
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: `${d.getFullYear()}/${pad(d.getMonth()+1)}`, ym: `${d.getFullYear()}-${pad(d.getMonth()+1)}` })
  }

  const [{ data: members }, { data: orders }] = await Promise.all([
    db.from('C_MBR_MemberList')
      .select('CreatedDate'),
    db.from('C_ORD_OrderList')
      .select('CustomerEmail, PaymentStatus, CreatedDate'),
  ])

  // Monthly new member count
  const byMonth = {}
  months.forEach(m => { byMonth[m.ym] = 0 })
  ;(members ?? []).forEach(m => {
    const ym = m.CreatedDate?.slice(0, 7)
    if (ym && byMonth[ym] !== undefined) byMonth[ym]++
  })

  // Active this month (distinct email with paid order this month)
  const activeSet = new Set()
  const emailOrderCount = {}
  ;(orders ?? []).forEach(o => {
    if (!o.CustomerEmail) return
    if (o.PaymentStatus === 'paid') {
      if (o.CreatedDate >= thisMonthStart) activeSet.add(o.CustomerEmail)
      emailOrderCount[o.CustomerEmail] = (emailOrderCount[o.CustomerEmail] ?? 0) + 1
    }
  })

  const repeatBuyers = Object.values(emailOrderCount).filter(c => c >= 2).length

  stats.value = {
    total: members?.length ?? 0,
    activeThisMonth: activeSet.size,
    repeatBuyers,
  }

  loading.value = false
  await nextTick()
  buildChart(months.map(m => m.label), months.map(m => byMonth[m.ym]))
}

onMounted(load)
onUnmounted(() => chartInstance?.destroy())
</script>

<template>
  <div class="container-fluid py-3">
    <div class="mb-4">
      <h4 class="mb-0">會員成長趨勢</h4>
      <div class="text-muted small">近 12 個月新增會員數</div>
    </div>

    <div v-if="loading" class="text-muted text-center py-5">載入中...</div>

    <template v-else>
      <!-- Stat cards -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-4">
          <div class="rpt-card">
            <div class="rpt-label">累積會員總數</div>
            <div class="rpt-value">{{ stats.total.toLocaleString() }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-4">
          <div class="rpt-card">
            <div class="rpt-label">本月活躍會員</div>
            <div class="rpt-value">{{ stats.activeThisMonth }}</div>
            <div class="rpt-hint">本月有完成付款</div>
          </div>
        </div>
        <div class="col-6 col-lg-4">
          <div class="rpt-card">
            <div class="rpt-label">回購會員數</div>
            <div class="rpt-value">{{ stats.repeatBuyers }}</div>
            <div class="rpt-hint">歷史付款訂單 ≥ 2 筆</div>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div class="card">
        <div class="card-header">
          <span class="fw-semibold small">每月新增會員數</span>
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
.rpt-label { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
.rpt-value { font-size: 24px; font-weight: 700; color: #111827; }
.rpt-hint  { font-size: 11px; color: #9ca3af; margin-top: 4px; }
</style>
