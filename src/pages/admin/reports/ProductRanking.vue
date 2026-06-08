<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { db } from '@/lib/db'

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
  if (preset.value === 'month')    return { start: t.slice(0,7) + '-01', end: t }
  if (preset.value === '3months') {
    const d = new Date(today); d.setMonth(d.getMonth() - 2); d.setDate(1)
    return { start: fmt(d), end: t }
  }
  return { start: customStart.value || t, end: customEnd.value || t }
})

// ── State ─────────────────────────────────────────────
const loading  = ref(false)
const rows     = ref([])
const sortBy   = ref('amount')

// ── Load ──────────────────────────────────────────────
async function load() {
  loading.value = true
  const { start, end } = range.value

  const startDt = start + 'T00:00:00'
  const endDt   = end   + 'T23:59:59'

  // ① 已付款訂單（只需 ID + MemberID）
  const { data: orders } = await db
    .from('C_ORD_OrderList')
    .select('ID, MemberID')
    .eq('PaymentStatus', 'paid')
    .gte('CreatedDate', startDt)
    .lte('CreatedDate', endDt)

  if (!orders?.length) { rows.value = []; loading.value = false; return }

  const orderIds      = orders.map(o => o.ID)
  const orderMemberMap = {}   // orderID → memberID
  orders.forEach(o => { orderMemberMap[o.ID] = o.MemberID })

  // ② 訂單明細（ProductID + ProductName + Qty + UnitPrice）
  const { data: items } = await db
    .from('C_ORD_OrderItemList')
    .select('OrderID, ProductID, ProductName, Qty, UnitPrice')
    .in('OrderID', orderIds)

  // ③ 商品點擊記錄（同期間）
  const { data: clicks } = await db
    .from('C_ANL_ProductClickLog')
    .select('ProductID, ProductName')
    .gte('CreatedDate', startDt)
    .lte('CreatedDate', endDt)
    .catch(() => ({ data: [] }))  // 若表尚未建立，不報錯

  // ── 以 ProductID 為 key 聚合（fallback 到 ProductName）──
  const map = {}

  ;(items ?? []).forEach(item => {
    const key = item.ProductID ?? item.ProductName
    if (!map[key]) {
      map[key] = {
        id:        item.ProductID,
        name:      item.ProductName,
        amount:    0,
        qty:       0,
        orderIds:  new Set(),
        memberIds: new Set(),
        clicks:    0,
      }
    }
    map[key].amount += (item.Qty ?? 0) * (item.UnitPrice ?? 0)
    map[key].qty    += item.Qty ?? 0
    map[key].orderIds.add(item.OrderID)
    const memberId = orderMemberMap[item.OrderID]
    if (memberId) map[key].memberIds.add(memberId)
  })

  // ── 點擊數聚合（by ProductID）──
  const clickMap = {}
  ;(clicks?.data ?? clicks ?? []).forEach(c => {
    if (c.ProductID) {
      clickMap[c.ProductID] = (clickMap[c.ProductID] || 0) + 1
    }
  })

  // ── 最終計算 ──
  const totalAmount = Object.values(map).reduce((s, p) => s + p.amount, 0)

  rows.value = Object.values(map).map(p => {
    const orderCount  = p.orderIds.size
    const memberCount = p.memberIds.size
    const clickCount  = clickMap[p.id] ?? 0
    const convRate    = clickCount > 0 ? orderCount / clickCount : null
    const aov         = orderCount > 0 ? p.amount / orderCount : 0
    const share       = totalAmount > 0 ? p.amount / totalAmount : 0
    return {
      id:        p.id,
      name:      p.name,
      amount:    p.amount,
      qty:       p.qty,
      orders:    orderCount,
      members:   memberCount,
      clicks:    clickCount,
      convRate,
      aov,
      share,
    }
  })

  loading.value = false
}

// ── Sorted ────────────────────────────────────────────
const sorted = computed(() => {
  const sortFns = {
    amount:  (a, b) => b.amount  - a.amount,
    qty:     (a, b) => b.qty     - a.qty,
    clicks:  (a, b) => b.clicks  - a.clicks,
    orders:  (a, b) => b.orders  - a.orders,
  }
  return [...rows.value]
    .sort(sortFns[sortBy.value] || sortFns.amount)
    .map((r, i) => ({ ...r, rank: i + 1 }))
})

const pct  = v => (v * 100).toFixed(1) + '%'
const conv = v => v === null ? '—' : (v * 100).toFixed(2) + '%'
const nt$  = v => 'NT$ ' + Math.round(v).toLocaleString()

watch(range, load, { deep: true })
onMounted(load)
</script>

<template>
  <div class="container-fluid py-3">

    <!-- Header -->
    <div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
      <div>
        <h4 class="mb-0">商品排行</h4>
        <div class="text-muted small">依已付款訂單統計 · 點擊數需安裝追蹤後才有資料</div>
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

    <div class="card">
      <div class="card-header d-flex gap-3 align-items-center flex-wrap">
        <span class="fw-semibold small me-auto">共 {{ sorted.length }} 種商品</span>
        <span class="small text-muted me-1">排序：</span>
        <div class="btn-group btn-group-sm">
          <button v-for="[k,l] in [['amount','銷售額'],['qty','件數'],['orders','訂單數'],['clicks','點擊數']]"
            :key="k" class="btn"
            :class="sortBy === k ? 'btn-dark' : 'btn-outline-secondary'"
            @click="sortBy = k">{{ l }}</button>
        </div>
      </div>

      <div v-if="loading" class="text-muted text-center py-5">載入中...</div>
      <div v-else-if="sorted.length === 0" class="text-muted text-center py-5">此區間無已付款資料</div>
      <div v-else class="table-responsive">
        <table class="table table-hover mb-0 align-middle rpt-table">
          <thead class="table-light">
            <tr>
              <th style="width:44px">排名</th>
              <th>商品名稱</th>
              <th class="text-end">銷售佔比</th>
              <th class="text-end">銷售額</th>
              <th class="text-end">商品點擊數</th>
              <th class="text-end">訂單數</th>
              <th class="text-end">件數</th>
              <th class="text-end">訂單轉換率</th>
              <th class="text-end">平均客單價</th>
              <th class="text-end">買家數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in sorted" :key="r.id ?? r.name">
              <td>
                <span v-if="r.rank <= 3" class="medal">{{ ['🥇','🥈','🥉'][r.rank-1] }}</span>
                <span v-else class="text-muted small">{{ r.rank }}</span>
              </td>
              <td class="fw-semibold" style="max-width:260px">
                <div class="text-truncate" :title="r.name">{{ r.name }}</div>
              </td>
              <td class="text-end">
                <div class="d-flex align-items-center justify-content-end gap-2">
                  <div class="share-bar">
                    <div class="share-bar__fill" :style="{ width: (r.share * 100).toFixed(1) + '%' }"></div>
                  </div>
                  <span class="small">{{ pct(r.share) }}</span>
                </div>
              </td>
              <td class="text-end text-success fw-semibold">{{ nt$(r.amount) }}</td>
              <td class="text-end">
                <span v-if="r.clicks > 0">{{ r.clicks.toLocaleString() }}</span>
                <span v-else class="text-muted small">—</span>
              </td>
              <td class="text-end">{{ r.orders.toLocaleString() }}</td>
              <td class="text-end">{{ r.qty.toLocaleString() }}</td>
              <td class="text-end">
                <span :class="r.convRate !== null ? 'badge bg-light text-dark border' : 'text-muted small'">
                  {{ conv(r.convRate) }}
                </span>
              </td>
              <td class="text-end small text-secondary">{{ nt$(r.aov) }}</td>
              <td class="text-end">{{ r.members.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 說明 -->
      <div class="card-footer text-muted small">
        訂單轉換率 = 訂單數 ÷ 商品點擊數 · 點擊數來自官網消費者進入商品詳情頁的紀錄，需執行 <code>add_analytics_tracking.sql</code> 後才有數據
      </div>
    </div>
  </div>
</template>

<style scoped>
.medal { font-size: 16px; }

.rpt-table th, .rpt-table td { white-space: nowrap; }

.share-bar {
  width: 60px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}
.share-bar__fill {
  height: 100%;
  background: #C8A882;
  border-radius: 3px;
  transition: width .3s;
}
</style>
