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
    // 取出指定日期範圍內已付款/已出貨/已完成的訂單
    const { data, error } = await db
      .from('C_ORD_OrderList')
      .select(`
        ID, "OrderNo", "CreatedDate", "FinalAmount", "ShippingMethodID",
        "ActualShippingCost", "PaymentMethod",
        C_ORD_OrderItemList ( "ProductName", "ColorName", "SizeName", "Qty", "UnitPrice", "UnitCost" ),
        C_ORD_OrderExtraCostList ( "EventType", "CostType", "Amount" )
      `)
      .in('Status', ['paid', 'shipped', 'delivered', 'completed'])
      .gte('CreatedDate', dateFrom.value + 'T00:00:00')
      .lte('CreatedDate', dateTo.value   + 'T23:59:59')
      .order('CreatedDate', { ascending: false })

    if (error) throw error
    orders.value = (data ?? []).map(computeProfit)
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

function computeProfit(o) {
  const revenue   = Number(o.FinalAmount) || 0
  const itemsCost = (o.C_ORD_OrderItemList ?? []).reduce(
    (s, i) => s + (Number(i.UnitCost) || 0) * (Number(i.Qty) || 0), 0
  )
  const payFee      = Math.round(revenue * FEE_RATE)
  const shipCost    = Number(o.ActualShippingCost) || 0
  const extraCosts  = (o.C_ORD_OrderExtraCostList ?? []).reduce(
    (s, c) => s + (Number(c.Amount) || 0), 0
  )
  const totalCost = itemsCost + payFee + shipCost + extraCosts
  const profit    = revenue - totalCost
  const margin    = revenue > 0 ? (profit / revenue * 100) : 0

  return {
    ...o,
    _itemsCost:  itemsCost,
    _payFee:     payFee,
    _shipCost:   shipCost,
    _extraCosts: extraCosts,
    _totalCost:  totalCost,
    _profit:     profit,
    _margin:     margin,
  }
}

// ─────────────────────────────────────────────────────
// 彙總
// ─────────────────────────────────────────────────────
const summary = computed(() => {
  const list = orders.value
  if (!list.length) return null
  const revenue    = list.reduce((s, o) => s + (Number(o.FinalAmount) || 0), 0)
  const itemsCost  = list.reduce((s, o) => s + o._itemsCost,  0)
  const payFee     = list.reduce((s, o) => s + o._payFee,     0)
  const shipCost   = list.reduce((s, o) => s + o._shipCost,   0)
  const extraCosts = list.reduce((s, o) => s + o._extraCosts, 0)
  const profit     = list.reduce((s, o) => s + o._profit,     0)
  const margin     = revenue > 0 ? (profit / revenue * 100) : 0
  return { revenue, itemsCost, payFee, shipCost, extraCosts, profit, margin, count: list.length }
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
            <div class="text-muted small mb-1">毛利率</div>
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
            <div class="text-muted small">退換貨額外成本</div>
            <div class="fw-medium">{{ fmtMoney(summary.extraCosts) }}</div>
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
                <th class="text-end">退換費用</th>
                <th class="text-end">毛利</th>
                <th class="text-end">毛利率</th>
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
                <td class="text-end text-muted">{{ fmtMoney(o._extraCosts) }}</td>
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
      ＊ 毛利 ＝ 營收 − 商品進貨成本 − 金流手續費（1.5%）− 實際出貨運費 − 退換貨額外費用<br>
      ＊ 若訂單尚未填入實際運費（ActualShippingCost），該欄位計為 0<br>
      ＊ 若商品規格尚未設定成本（CostPrice），該規格成本計為 0
    </div>

  </div>
</template>
