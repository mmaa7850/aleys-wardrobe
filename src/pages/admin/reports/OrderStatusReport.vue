<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { db } from '@/lib/db'
import { useRouter } from 'vue-router'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)

const PAYMENT_ROWS = [
  { key: 'pending',  label: '待付款',  color: '#f59e0b' },
  { key: 'paid',     label: '已付款',  color: '#10b981' },
  { key: 'failed',   label: '付款失敗', color: '#ef4444' },
  { key: 'refunded', label: '已退款',  color: '#6b7280' },
]

const canvasRef = ref(null)
let chartInstance = null

function buildChart(labels, values, colors) {
  if (!canvasRef.value) return
  if (chartInstance) chartInstance.destroy()
  chartInstance = new Chart(canvasRef.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
      },
      cutout: '62%',
    }
  })
}

async function load() {
  loading.value = true

  const { data: orders } = await db
    .from('C_ORD_OrderList')
    .select('PaymentStatus')

  const counts = {}
  PAYMENT_ROWS.forEach(r => { counts[r.key] = 0 })
  ;(orders ?? []).forEach(o => {
    if (counts[o.PaymentStatus] !== undefined) counts[o.PaymentStatus]++
  })

  total.value = (orders ?? []).length
  rows.value = PAYMENT_ROWS.map(r => ({ ...r, count: counts[r.key] }))

  loading.value = false
  await nextTick()
  buildChart(
    rows.value.map(r => r.label),
    rows.value.map(r => r.count),
    rows.value.map(r => r.color),
  )
}

const staleOrders = computed(() => {
  // Shown separately as a warning — fetched from SalesDashboard's load
  return 0
})

onMounted(load)
onUnmounted(() => chartInstance?.destroy())
</script>

<template>
  <div class="container-fluid py-3">
    <div class="mb-4">
      <h4 class="mb-0">訂單狀態分佈</h4>
      <div class="text-muted small">全部訂單（不限時間）</div>
    </div>

    <div v-if="loading" class="text-muted text-center py-5">載入中...</div>

    <template v-else>
      <div class="row g-3">
        <!-- Chart -->
        <div class="col-12 col-lg-5">
          <div class="card h-100">
            <div class="card-body d-flex align-items-center justify-content-center" style="height:300px">
              <canvas ref="canvasRef" />
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="col-12 col-lg-7">
          <div class="card h-100">
            <div class="card-header">
              <span class="fw-semibold small">全部訂單 {{ total }} 筆</span>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0 align-middle">
                <thead class="table-light">
                  <tr>
                    <th>付款狀態</th>
                    <th class="text-end">訂單數</th>
                    <th class="text-end">佔比</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in rows" :key="r.key">
                    <td>
                      <span class="dot" :style="{ background: r.color }"></span>
                      {{ r.label }}
                    </td>
                    <td class="text-end fw-semibold">{{ r.count }}</td>
                    <td class="text-end text-muted">
                      {{ total ? Math.round(r.count / total * 100) : 0 }}%
                    </td>
                    <td class="text-end">
                      <button
                        class="btn btn-outline-secondary btn-sm py-0 px-2"
                        style="font-size:11px"
                        @click="router.push('/admin/orders')"
                      >查看 →</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}
</style>
