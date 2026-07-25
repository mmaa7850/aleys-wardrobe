<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'

const dateFrom = ref('')
const dateTo = ref('')
const orders = ref([])
const loading = ref(false)
const errMsg = ref('')

onMounted(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')
  dateFrom.value = `${year}-${month}-01`
  dateTo.value = `${year}-${month}-${lastDay}`
  load()
})

async function load() {
  if (!dateFrom.value || !dateTo.value) return

  loading.value = true
  errMsg.value = ''

  try {
    const { data, error } = await db
      .from('C_ORD_OrderList')
      .select(`
        ID, "OrderNo", "CreatedDate", "ItemsTotal", "ShippingFee",
        "DiscountAmount", "FinalAmount", "NewebpayAmt", "ActualShippingCost",
        "PaymentMethod", "PaymentFee"
      `)
      .eq('PaymentStatus', 'paid')
      .gte('CreatedDate', `${dateFrom.value}T00:00:00`)
      .lte('CreatedDate', `${dateTo.value}T23:59:59`)
      .order('CreatedDate', { ascending: false })

    if (error) throw error

    const orderList = data ?? []
    const orderIds = orderList.map(order => order.ID)
    const extraCostMap = {}
    const consumableCostMap = {}

    if (orderIds.length) {
      const [
        { data: extraCosts, error: extraErr },
        { data: consumables, error: consumableErr },
      ] = await Promise.all([
        db
          .from('C_ORD_OrderExtraCostList')
          .select('"OrderID", "Amount"')
          .in('OrderID', orderIds),
        db
          .from('C_ORD_OrderConsumableList')
          .select('"OrderID", "Amount"')
          .in('OrderID', orderIds),
      ])

      if (extraErr) throw extraErr
      if (consumableErr) throw consumableErr

      for (const cost of (extraCosts ?? [])) {
        extraCostMap[cost.OrderID] = (extraCostMap[cost.OrderID] ?? 0) + Number(cost.Amount ?? 0)
      }
      for (const consumable of (consumables ?? [])) {
        consumableCostMap[consumable.OrderID] =
          (consumableCostMap[consumable.OrderID] ?? 0) + Number(consumable.Amount ?? 0)
      }
    }

    orders.value = orderList.map(order =>
      computeSettlement(
        order,
        extraCostMap[order.ID] ?? 0,
        consumableCostMap[order.ID] ?? 0,
      ),
    )
  } catch (error) {
    errMsg.value = error?.message ?? String(error)
  } finally {
    loading.value = false
  }
}

function computeSettlement(order, extraCost, consumableCost) {
  const itemsTotal = Number(order.ItemsTotal) || 0
  const shippingIncome = Number(order.ShippingFee) || 0
  const discount = Number(order.DiscountAmount) || 0
  const received = Number(order.FinalAmount) || 0
  const paymentFee = order.PaymentFee == null ? 0 : Number(order.PaymentFee)
  const shippingCost = order.ActualShippingCost == null ? 0 : Number(order.ActualShippingCost)
  const otherCost = Number(extraCost) || 0
  const materialCost = Number(consumableCost) || 0
  const expenseTotal = paymentFee + shippingCost + materialCost + otherCost
  const noExternalPayment =
    order.PaymentMethod === 'wallet' ||
    (order.NewebpayAmt != null && Number(order.NewebpayAmt) === 0)

  return {
    ...order,
    _itemsTotal: itemsTotal,
    _shippingIncome: shippingIncome,
    _discount: discount,
    _received: received,
    _paymentFee: paymentFee,
    _shippingCost: shippingCost,
    _consumableCost: materialCost,
    _extraCost: otherCost,
    _expenseTotal: expenseTotal,
    _netReceived: received - expenseTotal,
    _missingPaymentFee: order.PaymentFee == null && !noExternalPayment,
    _missingShippingCost: order.ActualShippingCost == null,
  }
}

const summary = computed(() => {
  if (!orders.value.length) return null

  return orders.value.reduce((result, order) => {
    result.count += 1
    result.itemsTotal += order._itemsTotal
    result.shippingIncome += order._shippingIncome
    result.discount += order._discount
    result.received += order._received
    result.paymentFee += order._paymentFee
    result.shippingCost += order._shippingCost
    result.consumableCost += order._consumableCost
    result.extraCost += order._extraCost
    result.expenseTotal += order._expenseTotal
    result.netReceived += order._netReceived
    if (order._missingPaymentFee || order._missingShippingCost) result.incompleteCount += 1
    return result
  }, {
    count: 0,
    itemsTotal: 0,
    shippingIncome: 0,
    discount: 0,
    received: 0,
    paymentFee: 0,
    shippingCost: 0,
    consumableCost: 0,
    extraCost: 0,
    expenseTotal: 0,
    netReceived: 0,
    incompleteCount: 0,
  })
})

const fmtMoney = value => {
  const amount = Number(value ?? 0)
  const sign = amount < 0 ? '-' : ''
  return `${sign}NT$ ${Math.abs(amount).toLocaleString('zh-TW')}`
}

const netClass = value => Number(value) >= 0 ? 'text-success' : 'text-danger'
</script>

<template>
  <div class="container-fluid py-4">
    <div class="mb-4">
      <h4 class="mb-0 fw-semibold">訂單收支報表</h4>
      <small class="text-muted">依已付款訂單統計實收、金流、物流、耗材及其他額外成本</small>
    </div>

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
            <button class="btn btn-primary btn-sm" :disabled="loading" @click="load">
              <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
              查詢
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <div v-if="summary" class="row g-3 mb-4">
      <div class="col-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">訂單數</div>
            <div class="fs-5 fw-bold">{{ summary.count }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">商品售價合計</div>
            <div class="fs-5 fw-bold">{{ fmtMoney(summary.itemsTotal) }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">訂單實收合計</div>
            <div class="fs-5 fw-bold">{{ fmtMoney(summary.received) }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small mb-1">扣除營運成本後淨收</div>
            <div class="fs-5 fw-bold" :class="netClass(summary.netReceived)">
              {{ fmtMoney(summary.netReceived) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="summary" class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-white fw-medium border-bottom">期間收支拆解</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="text-muted small">顧客支付運費</div>
            <div class="fw-medium">{{ fmtMoney(summary.shippingIncome) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">折價券／折扣</div>
            <div class="fw-medium text-danger">- {{ fmtMoney(summary.discount) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">金流手續費</div>
            <div class="fw-medium">{{ fmtMoney(summary.paymentFee) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">實際物流成本</div>
            <div class="fw-medium">{{ fmtMoney(summary.shippingCost) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">耗材成本</div>
            <div class="fw-medium">{{ fmtMoney(summary.consumableCost) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">其他額外成本</div>
            <div class="fw-medium">{{ fmtMoney(summary.extraCost) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-muted small">營運成本合計</div>
            <div class="fw-medium">{{ fmtMoney(summary.expenseTotal) }}</div>
          </div>
        </div>
        <div v-if="summary.incompleteCount" class="alert alert-warning py-2 mt-3 mb-0 small">
          有 {{ summary.incompleteCount }} 張訂單尚未記錄金流手續費或實際物流成本，淨收暫以 0 計算缺少的欄位。
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white fw-medium border-bottom">
        訂單明細
        <span v-if="orders.length" class="badge bg-secondary ms-2">{{ orders.length }}</span>
      </div>
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm me-2"></div>載入中…
        </div>
        <div v-else-if="!orders.length" class="text-center py-5 text-muted">此區間無已付款訂單</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size: 13px">
            <thead class="table-light">
              <tr>
                <th>訂單編號</th>
                <th>日期</th>
                <th class="text-end">商品售價</th>
                <th class="text-end">顧客運費</th>
                <th class="text-end">折價券</th>
                <th class="text-end">訂單實收</th>
                <th class="text-end">金流</th>
                <th class="text-end">物流</th>
                <th class="text-end">耗材</th>
                <th class="text-end">額外成本</th>
                <th class="text-end">淨收</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.ID">
                <td class="text-nowrap">{{ order.OrderNo }}</td>
                <td class="text-nowrap text-muted">{{ order.CreatedDate?.slice(0, 10) }}</td>
                <td class="text-end">{{ fmtMoney(order._itemsTotal) }}</td>
                <td class="text-end">{{ fmtMoney(order._shippingIncome) }}</td>
                <td class="text-end text-danger">- {{ fmtMoney(order._discount) }}</td>
                <td class="text-end fw-medium">{{ fmtMoney(order._received) }}</td>
                <td class="text-end" :class="{ 'text-warning': order._missingPaymentFee }">
                  {{ order._missingPaymentFee ? '未記錄' : fmtMoney(order._paymentFee) }}
                </td>
                <td class="text-end" :class="{ 'text-warning': order._missingShippingCost }">
                  {{ order._missingShippingCost ? '未記錄' : fmtMoney(order._shippingCost) }}
                </td>
                <td class="text-end">{{ fmtMoney(order._consumableCost) }}</td>
                <td class="text-end">{{ fmtMoney(order._extraCost) }}</td>
                <td class="text-end fw-semibold" :class="netClass(order._netReceived)">
                  {{ fmtMoney(order._netReceived) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="text-muted small mt-3">
      ＊ 訂單實收已包含顧客支付運費並扣除折價券，折價券不會重複扣除。<br>
      ＊ 淨收＝訂單實收－金流手續費－實際物流成本－耗材成本－其他額外成本。<br>
      ＊ 本報表不讀取商品進貨成本、FIFO、UnitCost、LineCost，也不計算商品毛利或營業稅。
    </div>
  </div>
</template>
