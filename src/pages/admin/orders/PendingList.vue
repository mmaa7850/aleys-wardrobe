<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

// ── State ────────────────────────────────────────────────
const rows    = ref([])   // { memberId, fbName, email, hasLine, itemCount, totalAmount, lineUserId }
const loading = ref(false)
const errMsg  = ref('')

// 通知狀態（memberID → 'sending' | 'sent' | 'failed'）
const notifyStatus = ref({})

// ── 下次銷單時間（下週一 00:00 台灣時間）────────────────
const nextCancelDate = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const daysUntilMon = day === 0 ? 1 : 8 - day
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntilMon)
  next.setHours(0, 0, 0, 0)
  return next.toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Taipei',
  })
})

// ── Fetch ─────────────────────────────────────────────────
async function load() {
  loading.value = true
  errMsg.value  = ''
  try {
    // 1. 取所有非購物金購物車明細
    const { data: cartItems, error: ciErr } = await db
      .from('C_CART_CartItemList')
      .select('ID, CartID, ProductID, VariantID, Qty')
      .eq('IsReward', false)

    if (ciErr) throw ciErr
    if (!cartItems?.length) { rows.value = []; return }

    // 2. 取商品 + 變體資料（判斷是否預購、取單價）
    const productIds = [...new Set(cartItems.map(i => i.ProductID).filter(Boolean))]
    const variantIds = [...new Set(cartItems.map(i => i.VariantID).filter(Boolean))]

    const [{ data: products }, { data: variants }] = await Promise.all([
      db.from('C_PRD_ProductList').select('ID, Price, IsPreOrder').in('ID', productIds),
      db.from('C_PRD_ProductVariantList').select('ID, StockQty').in('ID', variantIds),
    ])

    const productMap = Object.fromEntries((products ?? []).map(p => [p.ID, p]))
    const variantMap = Object.fromEntries((variants ?? []).map(v => [v.ID, v]))

    // 3. 篩選非預購商品（IsPreOrder=false 或仍有庫存）
    const nonPreOrderItems = cartItems.filter(item => {
      const product = productMap[item.ProductID]
      const variant = variantMap[item.VariantID]
      const isPreOrder = product?.IsPreOrder && (variant?.StockQty ?? 0) <= 0
      return !isPreOrder
    })

    if (!nonPreOrderItems.length) { rows.value = []; return }

    // 4. 取 CartList → MemberID
    const cartIds = [...new Set(nonPreOrderItems.map(i => i.CartID))]
    const { data: carts, error: cartErr } = await db
      .from('C_CART_CartList')
      .select('ID, MemberID')
      .in('ID', cartIds)

    if (cartErr) throw cartErr

    const cartMap = Object.fromEntries((carts ?? []).map(c => [c.ID, c]))

    // 5. 取會員資料
    const memberIds = [...new Set((carts ?? []).map(c => c.MemberID).filter(Boolean))]
    if (!memberIds.length) { rows.value = []; return }

    const { data: members, error: mbrErr } = await db
      .from('C_MBR_MemberList')
      .select('ID, FbName, Email, LineUserID')
      .in('ID', memberIds)

    if (mbrErr) throw mbrErr

    const memberMap = Object.fromEntries((members ?? []).map(m => [m.ID, m]))

    // 6. 依會員彙整
    const grouped = {}
    for (const item of nonPreOrderItems) {
      const cart = cartMap[item.CartID]
      if (!cart) continue
      const mid = cart.MemberID
      if (!mid) continue
      const member = memberMap[mid]
      if (!member) continue

      const unitPrice = productMap[item.ProductID]?.Price ?? 0

      if (!grouped[mid]) {
        grouped[mid] = {
          memberId:    mid,
          fbName:      member.FbName || member.Email || '',
          email:       member.Email  || '',
          lineUserId:  member.LineUserID || null,
          hasLine:     !!member.LineUserID,
          itemCount:   0,
          totalAmount: 0,
        }
      }
      grouped[mid].itemCount   += item.Qty
      grouped[mid].totalAmount += unitPrice * item.Qty
    }

    rows.value = Object.values(grouped)
  } catch (e) {
    errMsg.value = e.message
  } finally {
    loading.value = false
  }
}

// ── LINE 通知 ─────────────────────────────────────────────
async function sendLineNotify(row) {
  if (!row.lineUserId) return
  notifyStatus.value[row.memberId] = 'sending'
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lineUserId: row.lineUserId,
        message: `🛍️ 提醒您，購物車中有 ${row.itemCount} 件現貨商品尚未結帳，合計約 NT$${row.totalAmount.toLocaleString()}。\n庫存有限，建議盡快完成結帳！\n感謝您的支持 💕`,
      }),
    })
    if (!res.ok) throw new Error(await res.text())
    notifyStatus.value[row.memberId] = 'sent'
  } catch (e) {
    console.error('[PendingList] LINE notify error:', e)
    notifyStatus.value[row.memberId] = 'failed'
  }
}

onMounted(load)
</script>

<template>
  <div class="container-fluid px-4 py-4">

    <!-- Header -->
    <div class="d-flex align-items-start justify-content-between mb-4">
      <div>
        <h5 class="fw-semibold mb-1" style="color:#1a1714;">待結清單</h5>
        <p class="text-muted mb-0" style="font-size:13px;">
          購物車有現貨商品但尚未結帳的顧客｜可發 LINE 提醒結帳
        </p>
      </div>
      <button class="btn btn-sm btn-outline-secondary" @click="load" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-1" />
        重新整理
      </button>
    </div>

    <!-- 銷單倒數提示 -->
    <div class="alert py-2 px-3 mb-3 d-flex align-items-center gap-2"
      style="background:#fff8e1; border:1px solid #f0c040; color:#7a5c00; font-size:13px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      下次自動銷單時間：<strong>{{ nextCancelDate }} 00:00（台灣）</strong>
      &nbsp;—&nbsp;逾期未結帳的現貨訂單將於銷單時自動取消並回補庫存。
    </div>

    <!-- Error -->
    <div v-if="errMsg" class="alert alert-danger py-2" style="font-size:13px;">{{ errMsg }}</div>

    <!-- Empty -->
    <div v-if="!loading && !rows.length && !errMsg"
      class="text-center py-5 text-muted" style="font-size:14px;">
      目前沒有待結帳的現貨顧客 🎉
    </div>

    <!-- Table -->
    <div v-if="rows.length" class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0" style="font-size:13px;">
          <thead style="background:#f9f6f2; font-size:12px; color:#6b5c4e;">
            <tr>
              <th class="px-3 py-3">顧客</th>
              <th class="px-3 py-3 text-center">LINE</th>
              <th class="px-3 py-3 text-end">購物車件數</th>
              <th class="px-3 py-3 text-end">合計金額（參考）</th>
              <th class="px-3 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.memberId">
              <!-- 顧客 -->
              <td class="px-3 py-3">
                <div class="fw-semibold" style="color:#1a1714;">
                  {{ row.fbName || '—' }}
                </div>
                <div class="text-muted" style="font-size:11px;">{{ row.email || '—' }}</div>
              </td>

              <!-- LINE 綁定 -->
              <td class="px-3 py-3 text-center">
                <span v-if="row.hasLine"
                  class="badge"
                  style="background:#00b900; color:#fff; font-size:11px;">已綁定</span>
                <span v-else
                  class="badge bg-secondary"
                  style="font-size:11px;">未綁定</span>
              </td>

              <!-- 件數 -->
              <td class="px-3 py-3 text-end fw-semibold">
                {{ row.itemCount }} 件
              </td>

              <!-- 金額合計 -->
              <td class="px-3 py-3 text-end fw-semibold" style="color:#c0392b;">
                NT${{ row.totalAmount.toLocaleString() }}
              </td>

              <!-- 操作 -->
              <td class="px-3 py-3 text-center">
                <button
                  v-if="row.hasLine"
                  class="btn btn-sm"
                  :class="{
                    'btn-outline-success': !notifyStatus[row.memberId] || notifyStatus[row.memberId] === 'failed',
                    'btn-success':         notifyStatus[row.memberId] === 'sent',
                    'btn-secondary':       notifyStatus[row.memberId] === 'sending',
                  }"
                  :disabled="notifyStatus[row.memberId] === 'sending' || notifyStatus[row.memberId] === 'sent'"
                  style="font-size:12px;"
                  @click="sendLineNotify(row)"
                >
                  <span v-if="notifyStatus[row.memberId] === 'sending'"
                    class="spinner-border spinner-border-sm me-1" />
                  <span v-else-if="notifyStatus[row.memberId] === 'sent'">✓ 已送出</span>
                  <span v-else-if="notifyStatus[row.memberId] === 'failed'">⚠ 重新發送</span>
                  <span v-else>LINE 提醒</span>
                </button>
                <span v-else class="text-muted" style="font-size:12px;">無法通知</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-3 py-2 text-muted" style="font-size:12px; border-top:1px solid #f0ece7;">
        共 {{ rows.length }} 位顧客，{{ rows.reduce((s, r) => s + r.itemCount, 0) }} 件現貨商品待結帳
      </div>
    </div>

  </div>
</template>
