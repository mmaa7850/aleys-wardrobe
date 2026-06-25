<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'

// ── 篩選條件 ──────────────────────────────────────────
const dateFrom = ref('')
const dateTo   = ref('')

// ── 資料 ──────────────────────────────────────────────
const orders  = ref([])
const loading = ref(false)
const errMsg  = ref('')

onMounted(() => {
  // 預設本月
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  dateFrom.value = `${y}-${m}-01`
  dateTo.value   = `${y}-${m}-${String(new Date(y, now.getMonth()+1, 0).getDate()).padStart(2,'0')}`
  load()
})

async function load() {
  if (!dateFrom.value || !dateTo.value) return
  loading.value = true
  errMsg.value  = ''
  try {
    // ① 訂單主表 + 訂單明細（C_ORD_OrderItemList 為原生關聯，無問題）
    const { data, error } = await db
      .from('C_ORD_OrderList')
      .select(`
        ID, "OrderNo", "CreatedDate", "FinalAmount", "ActualShippingCost", "PaymentMethod", "PaymentFee",
        C_ORD_OrderItemList ( "Qty", "UnitCost" )
      `)
      .in('PaymentStatus', ['paid'])
      .gte('CreatedDate', dateFrom.value + 'T00:00:00')
      .lte('CreatedDate', dateTo.value   + 'T23:59:59')
      .order('CreatedDate', { ascending: false })

    if (error) throw error
    const orderList = data ?? []
    const orderIds  = orderList.map(o => o.ID)

    // ② 額外成本（migration 執行後才有，安全查詢）
    let extraCostMap = {}
    try {
      if (orderIds.length) {
        const { data: costs } = await db
          .from('C_ORD_OrderExtraCostList')
          .select('"OrderID", "Amount"')
          .in('OrderID', orderIds)
        for (const c of (costs ?? [])) {
          extraCostMap[c.OrderID] = (extraCostMap[c.OrderID] ?? 0) + Number(c.Amount)
        }
      }
    } catch { /* migration 尚未執行時忽略 */ }

    // ③ 耗材成本
    let consumableCostMap = {}
    try {
      if (orderIds.length) {
        const { data: oc } = await db
          .from('C_ORD_OrderConsumableList')
          .select('"OrderID", "Amount"')
          .in('OrderID', orderIds)
        for (const c of (oc ?? [])) {
          consumableCostMap[c.OrderID] = (consumableCostMap[c.OrderID] ?? 0) + Number(c.Amount)
        }
      }
    } catch { /* migration 尚未執行時忽略 */ }

    // 排除所有品項 UnitCost 都為 0 的訂單（無成本資料，淨利率會虛高）
    orders.value = orderList
      .filter(o => (o.C_ORD_OrderItemList ?? []).some(i => Number(i.UnitCost) > 0))
      .map(o => computeProfit(o, extraCostMap[o.ID] ?? 0, consumableCostMap[o.ID] ?? 0))
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

// ─────────────────────────────────────────────────────
// 毛利計算
// ─────────────────────────────────────────────────────
// 金流手續費率（信用卡 1.5%、ATM 0，預設 1.5%）
const FEE_RATE = 0.015

function computeProfit(o, extraCostsTotal = 0, consumableCostTotal = 0) {
  const revenue   = Number(o.FinalAmount) || 0
  const itemsCost = (o.C_ORD_OrderItemList ?? []).reduce(
    (s, i) => s + (Number(i.UnitCost) || 0) * (Number(i.Qty) || 0), 0
  )
  // 優先用 DB 儲存的實際手續費，否則用預設費率估算
  const payFee        = o.PaymentFee != null ? Number(o.PaymentFee) : Math.round(revenue * FEE_RATE)
  const shipCost      = Number(o.ActualShippingCost) || 0
  const extraCosts    = extraCostsTotal
  const consumableCost = consumableCostTotal
  // 營業稅：含稅售價反推 5% 稅額（5/105）
  const taxAmt        = Math.round(revenue * 5 / 105)
  const totalCost     = itemsCost + payFee + shipCost + extraCosts + consumableCost + taxAmt
  const profit        = revenue - totalCost
  const margin        = revenue > 0 ? (profit / revenue * 100) : 0

  return {
    ...o,
    _itemsCost:     itemsCost,
    _payFee:        payFee,
    _shipCost:      shipCost,
    _extraCosts:    extraCosts,
    _consumableCost: consumableCost,
    _taxAmt:        taxAmt,
    _totalCost:     totalCost,
    _profit:        profit,
    _margin:        margin,
  }
}

// ─────────────────────────────────────────────────────
// 彙總
// ─────────────────────────────────────────────────────
const summary = computed(() => {
  const list = orders.value
  if (!list.length) return null
  const revenue    = list.reduce((s, o) => s + (Number(o.FinalAmount) || 0), 0)
  const itemsCost      = list.reduce((s, o) => s + o._itemsCost,       0)
  const payFee         = list.reduce((s, o) => s + o._payFee,          0)
  const shipCost       = list.reduce((s, o) => s + o._shipCost,        0)
  const extraCosts     = list.reduce((s, o) => s + o._extraCosts,      0)
  const consumableCost = list.reduce((s, o) => s + o._consumableCost,  0)
  const taxAmt         = list.reduce((s, o) => s + o._taxAmt,          0)
  const profit         = list.reduce((s, o) => s + o._profit,          0)
  const margin         = revenue > 0 ? (profit / revenue * 100) : 0
  return { revenue, itemsCost, payFee, shipCost, extraCosts, consumableCost, taxAmt, profit, margin, count: list.length }
})

// ─────────────────────────────────────────────────────
// 格式化
// ─────────────────────────────────────────────────────
const fmtMoney = (n) => {
  const v = Number(n ?? 0)
  return (v < 0 ? '-' : '') + 'NT$ ' + Math.abs(v).toLocaleString('zh-TW')
}
const fmtPct = (n) => Number(n ?? 0).toFixed(1) + '%'

const profitClass = (n) => n >= 0 ? 'text-success' : 'text-danger'
</script>

<template>
  <div class="container-fluid py-4">

    <!-- Header -->
    <div class="mb-4">
      <h4 class="mb-0 fw-semibold">毛利報表</h4>
      <small class="text-muted">依訂單日期計算毛利（已付款 / 已出貨 / 已完成）</small>
    </div>

    <!-- 篩選 -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-auto">
            <label class="form-label mb-1 small">開始日期</label>
            <input v-model="dateFrom" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-auto">
            <label class="form-label mb-1 small">結束日期</label>
            <input v-model="dateTo" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-auto">
            <button class="btn btn-primary btn-sm" @click="load" :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
              查詢
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <!-- 彙總卡片 -->
    <div v-if="summary" class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">訂單數</div>
            <div class="fs-5 fw-bold">{{ summary.count }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">總營收</div>
            <div class="fs-5 fw-bold">{{ fmtMoney(summary.revenue) }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">總毛利</div>
            <div class="fs-5 fw-bold" :class="profitClass(summary.profit)">{{ fmtMoney(summary.profit) }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">淨利率</div>
            <div class="fs-5 fw-bold" :class="profitClass(summary.margin)">{{ fmtPct(summary.margin) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 成本明細彙總 -->
    <div v-if="summary" class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-white fw-medium border-bottom">成本拆解（期間合計）</div>
      <div class="card-body">
        <div class="row g-2">
          <div class="col-6 col-md-3">
            <div class="text-muted small">商品進貨成本</div>
            <div class="fw-medium">{{ fmtMoney(summary.itemsCost) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">金流手續費（約 1.5%）</div>
            <div class="fw-medium">{{ fmtMoney(summary.payFee) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">實際出貨運費</div>
            <div class="fw-medium">{{ fmtMoney(summary.shipCost) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">耗材成本（包材/贈品）</div>
            <div class="fw-medium">{{ fmtMoney(summary.consumableCost) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">退換貨額外成本</div>
            <div class="fw-medium">{{ fmtMoney(summary.extraCosts) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">營業稅（5%）</div>
            <div class="fw-medium">{{ fmtMoney(summary.taxAmt) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 訂單明細表 -->
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white fw-medium border-bottom">
        訂單明細
        <span v-if="orders.length" class="badge bg-secondary ms-2">{{ orders.length }}</span>
      </div>
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm me-2"></div>載入中…
        </div>
        <div v-else-if="!orders.length" class="text-center py-5 text-muted">此區間無訂單</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:13px">
            <thead class="table-light">
              <tr>
                <th>訂單編號</th>
                <th>日期</th>
                <th class="text-end">營收</th>
                <th class="text-end">進貨成本</th>
                <th class="text-end">手續費</th>
                <th class="text-end">運費成本</th>
                <th class="text-end">耗材成本</th>
                <th class="text-end">退換費用</th>
                <th class="text-end">營業稅</th>
                <th class="text-end">淨利</th>
                <th class="text-end">淨利率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in orders" :key="o.ID">
                <td class="text-nowrap">{{ o.OrderNo }}</td>
                <td class="text-nowrap text-muted">{{ o.CreatedDate?.slice(0,10) }}</td>
                <td class="text-end">{{ fmtMoney(o.FinalAmount) }}</td>
                <td class="text-end text-muted">{{ fmtMoney(o._itemsCost) }}</td>
                <td class="text-end text-muted">{{ fmtMoney(o._payFee) }}</td>
                <td class="text-end text-muted">{{ fmtMoney(o._shipCost) }}</td>
                <td class="text-end text-muted">{{ fmtMoney(o._consumableCost) }}</td>
                <td class="text-end text-muted">{{ fmtMoney(o._extraCosts) }}</td>
                <td class="text-end text-muted">{{ fmtMoney(o._taxAmt) }}</td>
                <td class="text-end fw-medium" :class="profitClass(o._profit)">{{ fmtMoney(o._profit) }}</td>
                <td class="text-end" :class="profitClass(o._margin)">{{ fmtPct(o._margin) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 備註 -->
    <div class="text-muted small mt-3">
      ＊ 淨利 ＝ 營收 − 商品進貨成本 − 金流手續費 − 實際出貨運費 − 耗材成本 − 退換貨費用 − 營業稅（5%）<br>
      ＊ 營業稅 ＝ 含稅營收 × 5／105（含稅售價反推，需每兩個月申報繳納）<br>
      ＊ 若訂單尚未填入實際運費（ActualShippingCost），該欄位計為 0<br>
      ＊ 耗材欄數字來自訂單出貨時紀錄的耗材用量，若未記錄顯示 NT$ 0
    </div>

  </div>
</template>
