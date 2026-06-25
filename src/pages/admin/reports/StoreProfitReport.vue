<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'

// ── 篩選：選月份 ──────────────────────────────────────
const now      = new Date()
const selYear  = ref(now.getFullYear())
const selMonth = ref(now.getMonth() + 1)
const years    = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
const months   = Array.from({ length: 12 }, (_, i) => i + 1)

// ── 資料 ──────────────────────────────────────────────
const orders   = ref([])
const expenses = ref([])
const loading  = ref(false)
const errMsg   = ref('')

onMounted(load)

async function load() {
  loading.value = true
  errMsg.value  = ''
  try {
    const y = selYear.value
    const m = String(selMonth.value).padStart(2, '0')
    const dFrom = `${y}-${m}-01T00:00:00`
    const lastDay = new Date(y, selMonth.value, 0).getDate()
    const dTo   = `${y}-${m}-${String(lastDay).padStart(2,'0')}T23:59:59`

    // ① 訂單毛利（已付款）
    const { data: orderData, error: oe } = await db
      .from('C_ORD_OrderList')
      .select(`
        ID, "OrderNo", "FinalAmount", "ActualShippingCost", "PaymentFee",
        C_ORD_OrderItemList ( "Qty", "UnitCost", "LineCost" )
      `)
      .eq('PaymentStatus', 'paid')
      .gte('CreatedDate', dFrom)
      .lte('CreatedDate', dTo)
    if (oe) throw oe

    const orderList = orderData ?? []
    const orderIds  = orderList.map(o => o.ID)

    // ② 額外成本
    let extraMap = {}
    if (orderIds.length) {
      try {
        const { data: ec } = await db
          .from('C_ORD_OrderExtraCostList')
          .select('"OrderID", "Amount"')
          .in('OrderID', orderIds)
        for (const c of (ec ?? [])) extraMap[c.OrderID] = (extraMap[c.OrderID] ?? 0) + Number(c.Amount)
      } catch { /* 忽略 */ }
    }

    // ③ 訂單耗材成本
    let consumableMap = {}
    if (orderIds.length) {
      try {
        const { data: oc } = await db
          .from('C_ORD_OrderConsumableList')
          .select('"OrderID", "Amount"')
          .in('OrderID', orderIds)
        for (const c of (oc ?? [])) consumableMap[c.OrderID] = (consumableMap[c.OrderID] ?? 0) + Number(c.Amount)
      } catch { /* 忽略 */ }
    }

    // ④ 費用記錄
    const { data: expData, error: ee } = await db
      .from('C_FIN_MonthlyExpenseList')
      .select('ID, "Name", "Amount", "ExpenseDate", S_FIN_ExpenseCategoryList("Name")')
      .gte('ExpenseDate', `${y}-${m}-01`)
      .lte('ExpenseDate', `${y}-${m}-${String(lastDay).padStart(2, '0')}`)
      .order('ExpenseDate')
    if (ee) throw ee

    // 組合訂單資料
    orders.value   = orderList
      .filter(o => (o.C_ORD_OrderItemList ?? []).some(i => Number(i.UnitCost) > 0))
      .map(o => computeOrderProfit(o, extraMap[o.ID] ?? 0, consumableMap[o.ID] ?? 0))
    expenses.value = expData ?? []
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

const FEE_RATE = 0.015

function computeOrderProfit(o, extraCost, consumableCost) {
  const revenue        = Number(o.FinalAmount) || 0
  const itemsCost      = (o.C_ORD_OrderItemList ?? []).reduce(
    (s, i) => s + (i.LineCost != null
      ? Number(i.LineCost)
      : (Number(i.UnitCost) || 0) * (Number(i.Qty) || 0)), 0
  )
  const payFee         = o.PaymentFee != null ? Number(o.PaymentFee) : Math.round(revenue * FEE_RATE)
  const shipCost       = Number(o.ActualShippingCost) || 0
  // 營業稅：含稅售價反推 5% 稅額（5/105）
  const taxAmt         = Math.round(revenue * 5 / 105)
  const totalVarCost   = itemsCost + payFee + shipCost + extraCost + consumableCost + taxAmt
  const grossProfit    = revenue - totalVarCost
  const grossMargin    = revenue > 0 ? (grossProfit / revenue * 100) : 0
  return { ...o, _revenue: revenue, _itemsCost: itemsCost, _payFee: payFee, _shipCost: shipCost, _extraCost: extraCost, _consumableCost: consumableCost, _taxAmt: taxAmt, _grossProfit: grossProfit, _grossMargin: grossMargin }
}

// ── 彙總計算 ──────────────────────────────────────────
const grossSummary = computed(() => {
  const list = orders.value
  const revenue          = list.reduce((s, o) => s + o._revenue, 0)
  const itemsCost        = list.reduce((s, o) => s + o._itemsCost, 0)
  const payFee           = list.reduce((s, o) => s + o._payFee, 0)
  const shipCost         = list.reduce((s, o) => s + o._shipCost, 0)
  const extraCost        = list.reduce((s, o) => s + o._extraCost, 0)
  const consumableCost   = list.reduce((s, o) => s + o._consumableCost, 0)
  const taxAmt           = list.reduce((s, o) => s + o._taxAmt, 0)
  const grossProfit      = list.reduce((s, o) => s + o._grossProfit, 0)
  const grossMargin      = revenue > 0 ? (grossProfit / revenue * 100) : 0
  return { count: list.length, revenue, itemsCost, payFee, shipCost, extraCost, consumableCost, taxAmt, grossProfit, grossMargin }
})

const totalMonthlyExp = computed(() =>
  expenses.value.reduce((s, e) => s + Number(e.Amount ?? 0), 0)
)

const netProfit = computed(() => grossSummary.value.grossProfit - totalMonthlyExp.value)
const netMargin = computed(() =>
  grossSummary.value.revenue > 0 ? (netProfit.value / grossSummary.value.revenue * 100) : 0
)

// ── 格式化 ────────────────────────────────────────────
const fmtMoney = (n) => {
  const v = Number(n ?? 0)
  return (v < 0 ? '-' : '') + 'NT$ ' + Math.abs(v).toLocaleString('zh-TW')
}
const fmtPct = (n) => Number(n ?? 0).toFixed(1) + '%'
const clr = (n) => n >= 0 ? 'text-success' : 'text-danger'
</script>

<template>
  <div class="container-fluid py-4">
    <div class="mb-4">
      <h4 class="mb-0 fw-semibold">賣場淨利報表</h4>
      <small class="text-muted">訂單毛利 − 月度固定費用 ＝ 本月淨利</small>
    </div>

    <!-- 月份篩選 -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body py-2">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 fw-medium">年份</label>
            <select v-model.number="selYear" class="form-select form-select-sm" style="width:auto">
              <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 fw-medium">月份</label>
            <select v-model.number="selMonth" class="form-select form-select-sm" style="width:auto">
              <option v-for="m in months" :key="m" :value="m">{{ m }} 月</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" @click="load" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>查詢
          </button>
        </div>
      </div>
    </div>

    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>
    <div v-if="loading" class="text-center py-5 text-muted">
      <div class="spinner-border spinner-border-sm me-2"></div>載入中…
    </div>

    <template v-if="!loading">
      <!-- ① 淨利總覽卡片 -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="text-muted small mb-1">本月訂單數</div>
              <div class="fs-4 fw-bold">{{ grossSummary.count }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="text-muted small mb-1">本月營收</div>
              <div class="fs-5 fw-bold">{{ fmtMoney(grossSummary.revenue) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="text-muted small mb-1">訂單毛利</div>
              <div class="fs-5 fw-bold" :class="clr(grossSummary.grossProfit)">{{ fmtMoney(grossSummary.grossProfit) }}</div>
              <small class="text-muted">{{ fmtPct(grossSummary.grossMargin) }}</small>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm h-100 border-2" :class="netProfit >= 0 ? 'border-success' : 'border-danger'">
            <div class="card-body">
              <div class="text-muted small mb-1">本月淨利</div>
              <div class="fs-4 fw-bold" :class="clr(netProfit)">{{ fmtMoney(netProfit) }}</div>
              <small :class="clr(netMargin)">淨利率 {{ fmtPct(netMargin) }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- ② 毛利成本拆解 -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white fw-medium border-bottom">第一層：訂單毛利拆解</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-6 col-md-2">
              <div class="text-muted small">商品進貨成本</div>
              <div class="fw-medium">{{ fmtMoney(grossSummary.itemsCost) }}</div>
            </div>
            <div class="col-6 col-md-2">
              <div class="text-muted small">金流手續費</div>
              <div class="fw-medium">{{ fmtMoney(grossSummary.payFee) }}</div>
            </div>
            <div class="col-6 col-md-2">
              <div class="text-muted small">出貨運費</div>
              <div class="fw-medium">{{ fmtMoney(grossSummary.shipCost) }}</div>
            </div>
            <div class="col-6 col-md-2">
              <div class="text-muted small">耗材成本（包材/贈品）</div>
              <div class="fw-medium">{{ fmtMoney(grossSummary.consumableCost) }}</div>
            </div>
            <div class="col-6 col-md-2">
              <div class="text-muted small">退換貨額外費用</div>
              <div class="fw-medium">{{ fmtMoney(grossSummary.extraCost) }}</div>
            </div>
            <div class="col-6 col-md-2">
              <div class="text-muted small">營業稅（5%）</div>
              <div class="fw-medium">{{ fmtMoney(grossSummary.taxAmt) }}</div>
            </div>
            <div class="col-6 col-md-2 border-start">
              <div class="text-muted small fw-semibold">訂單毛利</div>
              <div class="fw-bold" :class="clr(grossSummary.grossProfit)">{{ fmtMoney(grossSummary.grossProfit) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ③ 費用記錄 -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white fw-medium border-bottom d-flex justify-content-between align-items-center">
          <span>第二層：月度固定費用</span>
          <span class="fw-bold text-danger">－ {{ fmtMoney(totalMonthlyExp) }}</span>
        </div>
        <div class="card-body p-0">
          <div v-if="!expenses.length" class="text-center text-muted py-4">
            {{ selYear }}年{{ selMonth }}月 尚無費用記錄記錄
            <div class="mt-1">
              <RouterLink to="/admin/finance/monthly-expenses" class="btn btn-sm btn-outline-primary">前往新增</RouterLink>
            </div>
          </div>
          <div v-else class="table-responsive">
            <table class="table align-middle mb-0" style="font-size:13px">
              <thead class="table-light">
                <tr>
                  <th>分類</th>
                  <th>費用說明</th>
                  <th class="text-end">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in expenses" :key="e.ID">
                  <td><span class="badge bg-info text-dark">{{ e.S_FIN_ExpenseCategoryList?.Name ?? '—' }}</span></td>
                  <td>{{ e.Name }}</td>
                  <td class="text-end font-monospace">{{ fmtMoney(e.Amount) }}</td>
                </tr>
              </tbody>
              <tfoot class="table-light">
                <tr>
                  <td colspan="2" class="text-end fw-semibold">費用合計</td>
                  <td class="text-end fw-bold font-monospace text-danger">{{ fmtMoney(totalMonthlyExp) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ④ 淨利計算摘要 -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2" style="font-size:14px">
            <div>
              <span class="text-muted">訂單毛利</span>
              <span class="fw-bold ms-2" :class="clr(grossSummary.grossProfit)">{{ fmtMoney(grossSummary.grossProfit) }}</span>
            </div>
            <div class="text-muted fs-5">－</div>
            <div>
              <span class="text-muted">費用記錄</span>
              <span class="fw-bold ms-2 text-danger">{{ fmtMoney(totalMonthlyExp) }}</span>
            </div>
            <div class="text-muted fs-5">＝</div>
            <div class="p-2 rounded" :class="netProfit >= 0 ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'">
              <span class="text-muted">本月淨利</span>
              <span class="fw-bold ms-2 fs-5" :class="clr(netProfit)">{{ fmtMoney(netProfit) }}</span>
              <span class="ms-2 text-muted small">（淨利率 {{ fmtPct(netMargin) }}）</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ⑤ 訂單明細（含耗材欄） -->
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-white fw-medium border-bottom">
          訂單毛利明細
          <span v-if="orders.length" class="badge bg-secondary ms-2">{{ orders.length }}</span>
        </div>
        <div class="card-body p-0">
          <div v-if="!orders.length" class="text-center py-5 text-muted">此月份無付款訂單</div>
          <div v-else class="table-responsive">
            <table class="table table-hover align-middle mb-0" style="font-size:12px">
              <thead class="table-light">
                <tr>
                  <th>訂單編號</th>
                  <th class="text-end">營收</th>
                  <th class="text-end">進貨成本</th>
                  <th class="text-end">手續費</th>
                  <th class="text-end">運費</th>
                  <th class="text-end">耗材</th>
                  <th class="text-end">其他</th>
                  <th class="text-end">營業稅</th>
                  <th class="text-end">毛利</th>
                  <th class="text-end">淨利率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in orders" :key="o.ID">
                  <td class="text-nowrap font-monospace">{{ o.OrderNo }}</td>
                  <td class="text-end">{{ fmtMoney(o._revenue) }}</td>
                  <td class="text-end text-muted">{{ fmtMoney(o._itemsCost) }}</td>
                  <td class="text-end text-muted">{{ fmtMoney(o._payFee) }}</td>
                  <td class="text-end text-muted">{{ fmtMoney(o._shipCost) }}</td>
                  <td class="text-end text-muted">{{ fmtMoney(o._consumableCost) }}</td>
                  <td class="text-end text-muted">{{ fmtMoney(o._extraCost) }}</td>
                  <td class="text-end text-muted">{{ fmtMoney(o._taxAmt) }}</td>
                  <td class="text-end fw-medium" :class="clr(o._grossProfit)">{{ fmtMoney(o._grossProfit) }}</td>
                  <td class="text-end" :class="clr(o._grossMargin)">{{ fmtPct(o._grossMargin) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="text-muted small mt-3">
        ＊ 淨利 ＝ 訂單毛利 − 月度固定費用（租金、水電…）<br>
        ＊ 訂單毛利 ＝ 營收 − 商品進貨成本 − 金流手續費 − 出貨運費 − 耗材成本 − 退換貨費用 − 營業稅（5%）<br>
        ＊ 營業稅 ＝ 含稅營收 × 5／105（含稅售價反推，需每兩個月申報繳納）<br>
        ＊ 耗材欄數字來自訂單出貨時紀錄的耗材用量；若訂單未記錄，顯示 NT$ 0
      </div>
    </template>
  </div>
</template>
