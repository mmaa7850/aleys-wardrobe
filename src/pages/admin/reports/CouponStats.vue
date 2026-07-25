<script setup>
import { ref, onMounted } from 'vue'
import { db } from '@/lib/db'

const loading = ref(false)
const rows = ref([])

const today = new Date().toISOString().slice(0, 10)
const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7)
const in7Str = in7Days.toISOString().slice(0, 10)

function soonExpiring(endDate) {
  return endDate && endDate >= today && endDate <= in7Str
}
function expired(endDate) {
  return endDate && endDate < today
}

async function load() {
  loading.value = true

  const [{ data: coupons }, { data: orders }] = await Promise.all([
    db.from('S_PRM_CouponList')
      .select('ID, Name, Description, DiscountValue, MinOrderAmount, IsAutoApply, StartDate, EndDate, IsActive, UsageCount')
      .order('EndDate', { ascending: false }),
    db.from('C_ORD_OrderList')
      .select('CouponID, DiscountAmount, FinalAmount, PaymentStatus')
      .not('CouponID', 'is', null),
  ])

  // Build per-coupon order stats
  const statsMap = {}
  ;(orders ?? []).forEach(o => {
    const couponId = o.CouponID
    if (!couponId) return
    if (!statsMap[couponId]) statsMap[couponId] = { usedCount: 0, discountTotal: 0, revenueTotal: 0 }
    if (o.PaymentStatus === 'paid') {
      statsMap[couponId].usedCount++
      statsMap[couponId].discountTotal += o.DiscountAmount ?? 0
      statsMap[couponId].revenueTotal  += o.FinalAmount ?? 0
    }
  })

  rows.value = (coupons ?? []).map(c => {
    const usedCount = statsMap[c.ID]?.usedCount ?? 0
    const remainingCount = c.UsageCount ?? 0
    const issuedCount = usedCount + remainingCount
    return {
      ...c,
      usedCount,
      remainingCount,
      discountTotal: statsMap[c.ID]?.discountTotal ?? 0,
      revenueTotal:  statsMap[c.ID]?.revenueTotal  ?? 0,
      usageRate: issuedCount > 0 ? Math.round(usedCount / issuedCount * 100) : null,
    }
  })

  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="container-fluid py-3">
    <div class="mb-4">
      <h4 class="mb-0">優惠券效益分析</h4>
      <div class="text-muted small">已付款訂單統計，使用次數 / 折扣金額 / 帶動營收</div>
    </div>

    <div class="card">
      <div v-if="loading" class="text-muted text-center py-5">載入中...</div>
      <div v-else-if="rows.length === 0" class="text-muted text-center py-5">目前沒有優惠券資料</div>
      <div v-else class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light">
            <tr>
              <th>優惠券名稱</th>
              <th>類型</th>
              <th class="text-end">折扣金額</th>
              <th class="text-end">已使用 / 剩餘</th>
              <th class="text-end">使用率</th>
              <th class="text-end">折扣總額</th>
              <th class="text-end">帶動營收</th>
              <th>到期日</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.ID">
              <td>
                <div class="fw-semibold">{{ r.Name }}</div>
                <div class="text-muted small">{{ r.Description }}</div>
              </td>
              <td>
                <span class="badge bg-light text-dark border">
                  {{ r.IsAutoApply ? '滿額自動折抵' : '手動優惠碼' }}
                </span>
                <span v-if="r.MinOrderAmount" class="d-block text-muted" style="font-size:11px">
                  滿 NT$ {{ r.MinOrderAmount.toLocaleString() }}
                </span>
              </td>
              <td class="text-end">NT$ {{ r.DiscountValue?.toLocaleString() }}</td>
              <td class="text-end">
                {{ r.usedCount }} / {{ r.remainingCount }}
              </td>
              <td class="text-end">
                <template v-if="r.usageRate !== null">
                  <div class="usage-bar-wrap">
                    <div class="usage-bar" :style="{ width: Math.min(r.usageRate, 100) + '%' }"></div>
                  </div>
                  <span class="small">{{ r.usageRate }}%</span>
                </template>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="text-end text-danger">－NT$ {{ r.discountTotal.toLocaleString() }}</td>
              <td class="text-end text-success">NT$ {{ r.revenueTotal.toLocaleString() }}</td>
              <td>
                <span v-if="soonExpiring(r.EndDate)" class="badge bg-warning text-dark">
                  {{ r.EndDate }} ⚠️
                </span>
                <span v-else-if="expired(r.EndDate)" class="badge bg-secondary">
                  {{ r.EndDate }} 已到期
                </span>
                <span v-else class="text-muted small">{{ r.EndDate ?? '—' }}</span>
              </td>
              <td>
                <span class="badge" :class="r.IsActive ? 'bg-success' : 'bg-light text-dark border'">
                  {{ r.IsActive ? '啟用' : '停用' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usage-bar-wrap {
  height: 5px;
  background: #e5e7eb;
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 3px;
  width: 80px;
  margin-left: auto;
}
.usage-bar {
  height: 100%;
  background: #C8A882;
  border-radius: 99px;
}
</style>
