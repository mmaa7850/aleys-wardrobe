<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { db } from '@/lib/db'

const loading = ref(false)
const rows = ref([])
const sortBy = ref('amount')
const filterCategory = ref('')

const today = new Date()
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const preset = ref('month')
const customStart = ref('')
const customEnd   = ref('')

const range = computed(() => {
  const t = fmt(today)
  if (preset.value === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 6)
    return { start: fmt(d), end: t }
  }
  if (preset.value === 'month') return { start: t.slice(0,7) + '-01', end: t }
  if (preset.value === '3months') {
    const d = new Date(today); d.setMonth(d.getMonth() - 2); d.setDate(1)
    return { start: fmt(d), end: t }
  }
  return { start: customStart.value || t, end: customEnd.value || t }
})

const categories = ref([])

async function load() {
  loading.value = true
  const { start, end } = range.value

  const { data: orders } = await db
    .from('C_ORD_OrderList')
    .select('ID')
    .eq('PaymentStatus', 'paid')
    .gte('CreatedDate', start + 'T00:00:00')
    .lte('CreatedDate', end + 'T23:59:59')

  if (!orders?.length) { rows.value = []; loading.value = false; return }

  const ids = orders.map(o => o.ID)
  const { data: items } = await db
    .from('C_ORD_OrderItemList')
    .select('ProductName, Qty, UnitPrice')
    .in('OrderID', ids)

  const map = {}
  ;(items ?? []).forEach(item => {
    const key = item.ProductName
    if (!map[key]) map[key] = { name: key, qty: 0, amount: 0 }
    map[key].qty    += item.Qty ?? 0
    map[key].amount += (item.Qty ?? 0) * (item.UnitPrice ?? 0)
  })

  rows.value = Object.values(map)
  loading.value = false
}

const sorted = computed(() => {
  let list = rows.value
  if (filterCategory.value) list = list.filter(r => r.name.includes(filterCategory.value))
  return [...list].sort((a, b) => b[sortBy.value] - a[sortBy.value])
    .map((r, i) => ({ ...r, rank: i + 1 }))
})

watch(range, load, { deep: true })
onMounted(load)
</script>

<template>
  <div class="container-fluid py-3">
    <div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
      <div>
        <h4 class="mb-0">商品銷售排行</h4>
        <div class="text-muted small">依已付款訂單統計</div>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <div class="btn-group btn-group-sm">
          <button v-for="p in [['week','本週'],['month','本月'],['3months','近3月'],['custom','自訂']]"
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

    <div class="card">
      <div class="card-header d-flex gap-3 align-items-center flex-wrap">
        <span class="fw-semibold small me-auto">共 {{ sorted.length }} 種商品</span>
        <div class="btn-group btn-group-sm">
          <button class="btn" :class="sortBy==='amount' ? 'btn-dark' : 'btn-outline-secondary'"
            @click="sortBy='amount'">依金額</button>
          <button class="btn" :class="sortBy==='qty' ? 'btn-dark' : 'btn-outline-secondary'"
            @click="sortBy='qty'">依數量</button>
        </div>
      </div>
      <div v-if="loading" class="text-muted text-center py-5">載入中...</div>
      <div v-else-if="sorted.length === 0" class="text-muted text-center py-5">此區間無已付款資料</div>
      <div v-else class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light">
            <tr>
              <th style="width:48px">排名</th>
              <th>商品名稱</th>
              <th class="text-end">售出數量</th>
              <th class="text-end">銷售金額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in sorted" :key="r.name">
              <td>
                <span v-if="r.rank <= 3" class="medal">{{ ['🥇','🥈','🥉'][r.rank-1] }}</span>
                <span v-else class="text-muted">{{ r.rank }}</span>
              </td>
              <td class="fw-semibold">{{ r.name }}</td>
              <td class="text-end">{{ r.qty.toLocaleString() }}</td>
              <td class="text-end text-success fw-semibold">NT$ {{ r.amount.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.medal { font-size: 16px; }
</style>
