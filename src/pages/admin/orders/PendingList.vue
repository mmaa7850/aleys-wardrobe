<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

// ── State ────────────────────────────────────────────────
const activeTab     = ref('cart')   // 'cart' | 'cancelled'
const cartRows      = ref([])       // 購物車待結帳
const cancelledRows = ref([])       // 本週已銷單
const loading       = ref(false)
const errMsg        = ref('')

const notifyStatus = ref({})   // key: memberId 或 email

// ── [TEST] 手動觸發銷單 ───────────────────────────────────
const cancellingAll = ref(false)
const cancelResult  = ref('')

async function triggerCancelOrders() {
  if (!confirm('確定要立即觸發銷單？所有 pending 訂單將被取消並回補庫存。')) return
  cancellingAll.value = true
  cancelResult.value  = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data))
    cancelResult.value = `✅ 銷訂單 ${data.cancelled} 筆，清購物車 ${data.cartCleared} 筆，封鎖 ${data.blocked} 位會員`
    await load()
  } catch (e) {
    cancelResult.value = `❌ ${e instanceof Error ? e.message : JSON.stringify(e)}`
  } finally {
    cancellingAll.value = false
  }
}

// ── 計算本週週一 00:00 台灣時間對應的 UTC ISO string ──────
function thisWeekMondayUTC() {
  const now = new Date()
  // 換算到台灣時間（UTC+8）
  const OFFSET_MS = 8 * 60 * 60 * 1000
  const taiwanNow = new Date(now.getTime() + OFFSET_MS)
  const dow = taiwanNow.getUTCDay() // 0=Sun
  const daysSinceMon = dow === 0 ? 6 : dow - 1
  // 本週一 00:00 台灣 → 設回 UTC
  const mondayTaiwan = new Date(taiwanNow)
  mondayTaiwan.setUTCDate(taiwanNow.getUTCDate() - daysSinceMon)
  mondayTaiwan.setUTCHours(0, 0, 0, 0)
  return new Date(mondayTaiwan.getTime() - OFFSET_MS).toISOString()
}

// ── 下次銷單時間（下週一 00:00）────────────────────────────
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

// ── Tab 1：購物車待結帳 ───────────────────────────────────
async function loadCart() {
  try {
    // 1. 所有非購物金購物車明細
    const { data: cartItems, error: ciErr } = await db
      .from('C_CART_CartItemList')
      .select('ID, CartID, ProductID, VariantID, Qty')
      .eq('IsReward', false)
      .is('CancelledAt', null)

    if (ciErr) throw ciErr
    if (!cartItems?.length) { cartRows.value = []; return }

    // 2. 商品 + 變體（判斷預購、取單價）
    const productIds = [...new Set(cartItems.map(i => i.ProductID).filter(Boolean))]
    const variantIds = [...new Set(cartItems.map(i => i.VariantID).filter(Boolean))]

    const [{ data: products }, { data: variants }] = await Promise.all([
      db.from('C_PRD_ProductList').select('ID, Price, IsPreOrder').in('ID', productIds),
      db.from('C_PRD_ProductVariantList').select('ID, StockQty').in('ID', variantIds),
    ])

    const productMap = Object.fromEntries((products ?? []).map(p => [p.ID, p]))
    const variantMap = Object.fromEntries((variants ?? []).map(v => [v.ID, v]))

    // 3. 篩掉預購（IsPreOrder=true 且 StockQty<=0）
    const nonPreOrderItems = cartItems.filter(item => {
      const p = productMap[item.ProductID]
      const v = variantMap[item.VariantID]
      return !(p?.IsPreOrder && (v?.StockQty ?? 0) <= 0)
    })

    if (!nonPreOrderItems.length) { cartRows.value = []; return }

    // 4. CartList → MemberID
    const cartIds = [...new Set(nonPreOrderItems.map(i => i.CartID))]
    const { data: carts, error: cartErr } = await db
      .from('C_CART_CartList').select('ID, MemberID').in('ID', cartIds)

    if (cartErr) throw cartErr
    const cartMap = Object.fromEntries((carts ?? []).map(c => [c.ID, c]))

    // 5. 會員資料
    const memberIds = [...new Set((carts ?? []).map(c => c.MemberID).filter(Boolean))]
    if (!memberIds.length) { cartRows.value = []; return }

    const { data: members, error: mbrErr } = await db
      .from('C_MBR_MemberList').select('ID, FbName, Email, LineUserID').in('ID', memberIds)

    if (mbrErr) throw mbrErr
    const memberMap = Object.fromEntries((members ?? []).map(m => [m.ID, m]))

    // 6. 彙整
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
          memberId: mid, key: `cart_${mid}`,
          fbName:   member.FbName || member.Email || '',
          email:    member.Email  || '',
          lineUserId: member.LineUserID || null,
          hasLine:  !!member.LineUserID,
          itemCount: 0, totalAmount: 0,
        }
      }
      grouped[mid].itemCount   += item.Qty
      grouped[mid].totalAmount += unitPrice * item.Qty
    }

    cartRows.value = Object.values(grouped)
  } catch (e) {
    throw e
  }
}

// ── Tab 2：本週被封鎖名單（銷訂單 + 清購物車合併）─────────
async function loadCancelled() {
  try {
    const since = thisWeekMondayUTC()

    // 1. 本週被封鎖的會員（IsBlocked=true 且 UpdatedDate >= 本週一）
    const { data: blockedMembers, error: mbrErr } = await db
      .from('C_MBR_MemberList')
      .select('ID, FbName, Email, LineUserID, UpdatedDate')
      .eq('IsBlocked', true)
      .gte('UpdatedDate', since)

    if (mbrErr) throw mbrErr
    if (!blockedMembers?.length) { cancelledRows.value = []; return }

    // 2. 查這些會員的本週已取消訂單（有的話顯示商品）
    const emails = blockedMembers.map(m => m.Email).filter(Boolean)
    const { data: orders } = await db
      .from('C_ORD_OrderList')
      .select('ID, OrderNo, CustomerEmail, FinalAmount, UpdatedDate')
      .eq('PaymentStatus', 'cancelled')
      .gte('UpdatedDate', since)
      .in('CustomerEmail', emails)

    const orderIds = (orders ?? []).map(o => o.ID)
    let itemsByOrder = {}

    if (orderIds.length) {
      const { data: orderItems } = await db
        .from('C_ORD_OrderItemList')
        .select('OrderID, ProductName, ColorName, SizeName, Qty')
        .in('OrderID', orderIds)

      for (const it of orderItems ?? []) {
        if (!itemsByOrder[it.OrderID]) itemsByOrder[it.OrderID] = []
        itemsByOrder[it.OrderID].push(it)
      }
    }

    // 3. 查本週被軟刪除的購物車品項（cartOnly 會員用）
    const memberIds = blockedMembers.map(m => m.ID)
    const { data: memberCarts } = await db
      .from('C_CART_CartList').select('ID, MemberID').in('MemberID', memberIds)

    const cartIdsByMember = {}
    for (const c of memberCarts ?? []) {
      if (!cartIdsByMember[c.MemberID]) cartIdsByMember[c.MemberID] = []
      cartIdsByMember[c.MemberID].push(c.ID)
    }

    const allCartIds = (memberCarts ?? []).map(c => c.ID)
    let cancelledCartItems = []
    if (allCartIds.length) {
      const { data: cCartItems } = await db
        .from('C_CART_CartItemList')
        .select('ID, CartID, ProductID, VariantID, Qty, CancelledAt')
        .in('CartID', allCartIds)
        .gte('CancelledAt', since)
        .not('CancelledAt', 'is', null)

      if (cCartItems?.length) {
        const pIds = [...new Set(cCartItems.map(i => i.ProductID).filter(Boolean))]
        const vIds = [...new Set(cCartItems.map(i => i.VariantID).filter(Boolean))]
        const [{ data: prods }, { data: vars }] = await Promise.all([
          db.from('C_PRD_ProductList').select('ID, ProductName').in('ID', pIds),
          db.from('C_PRD_ProductVariantList').select('ID, ColorName, SizeName').in('ID', vIds),
        ])
        const prodMap = Object.fromEntries((prods ?? []).map(p => [p.ID, p]))
        const varMap  = Object.fromEntries((vars  ?? []).map(v => [v.ID, v]))
        cancelledCartItems = cCartItems.map(i => ({
          ...i,
          ProductName: prodMap[i.ProductID]?.ProductName || '–',
          ColorName:   varMap[i.VariantID]?.ColorName || '',
          SizeName:    varMap[i.VariantID]?.SizeName  || '',
        }))
      }
    }

    // 依 MemberID 分組購物車品項
    const cartItemsByMember = {}
    for (const ci of cancelledCartItems) {
      const cart = (memberCarts ?? []).find(c => c.ID === ci.CartID)
      if (!cart) continue
      const mid = cart.MemberID
      if (!cartItemsByMember[mid]) cartItemsByMember[mid] = []
      cartItemsByMember[mid].push(ci)
    }

    // 4. 彙整：依會員整理訂單與商品清單
    const ordersByEmail = {}
    for (const ord of orders ?? []) {
      if (!ordersByEmail[ord.CustomerEmail]) ordersByEmail[ord.CustomerEmail] = []
      ordersByEmail[ord.CustomerEmail].push(ord)
    }

    cancelledRows.value = blockedMembers.map(m => {
      const memberOrders = ordersByEmail[m.Email] ?? []
      const orderItems   = memberOrders.flatMap(o => itemsByOrder[o.ID] ?? [])
      const cartItems2   = cartItemsByMember[m.ID] ?? []
      const items        = memberOrders.length ? orderItems : cartItems2
      const totalAmount  = memberOrders.reduce((s, o) => s + (o.FinalAmount ?? 0), 0)

      return {
        key:        `cancelled_${m.ID}`,
        memberId:   m.ID,
        fbName:     m.FbName || m.Email || '',
        email:      m.Email || '',
        lineUserId: m.LineUserID || null,
        hasLine:    !!m.LineUserID,
        orderCount: memberOrders.length,
        totalAmount,
        items,
        cancelledAt: m.UpdatedDate,
        cartOnly:   memberOrders.length === 0,
      }
    }).sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt))

  } catch (e) {
    throw e
  }
}

// ── 載入（兩個 tab 一起）────────────────────────────────
async function load() {
  loading.value = true
  errMsg.value  = ''
  notifyStatus.value = {}
  try {
    await Promise.all([loadCart(), loadCancelled()])
  } catch (e) {
    errMsg.value = e.message
  } finally {
    loading.value = false
  }
}

// ── LINE 通知 ─────────────────────────────────────────────
async function sendLineNotify(row, tab) {
  if (!row.lineUserId) return
  const k = row.key
  notifyStatus.value[k] = 'sending'
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    let message
    if (tab === 'cart') {
      message = `🛍️ 提醒您，購物車中有 ${row.itemCount} 件現貨商品尚未結帳，合計約 NT$${row.totalAmount.toLocaleString()}。\n庫存有限，建議盡快完成結帳！\n感謝您的支持 💕`
    } else {
      const itemList = row.items.slice(0, 5).map(i => {
        const spec = [i.colorName, i.sizeName].filter(Boolean).join(' / ')
        return `・${i.name}${spec ? `（${spec}）` : ''} × ${i.qty}`
      }).join('\n')
      const more = row.items.length > 5 ? `\n・…等共 ${row.items.length} 件` : ''
      message = `😢 您有 ${row.orderCount} 筆訂單因逾期未付款已自動取消：\n${itemList}${more}\n\n如有需要歡迎再次下單，感謝您的支持 💕`
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lineUserId: row.lineUserId, message }),
    })
    if (!res.ok) throw new Error(await res.text())
    notifyStatus.value[k] = 'sent'
  } catch (e) {
    console.error('[PendingList] LINE notify error:', e)
    notifyStatus.value[k] = 'failed'
  }
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  })
}

onMounted(load)
</script>

<template>
  <div class="container-fluid px-4 py-4">

    <!-- Header -->
    <div class="d-flex align-items-start justify-content-between mb-3">
      <div>
        <h5 class="fw-semibold mb-1" style="color:#1a1714;">待結清單</h5>
        <p class="text-muted mb-0" style="font-size:13px;">
          購物車結帳提醒 ＆ 本週已銷單追蹤
        </p>
      </div>
      <div class="d-flex gap-2 align-items-center flex-wrap justify-content-end">
        <!-- [TEST] 測試用，驗證後移除 -->
        <div class="d-flex flex-column align-items-end gap-1">
          <button class="btn btn-sm btn-danger" @click="triggerCancelOrders" :disabled="cancellingAll || loading"
            title="測試用：立即執行銷單，勿在正式環境誤觸">
            <span v-if="cancellingAll" class="spinner-border spinner-border-sm me-1" />
            ⚠ 立即觸發銷單（測試）
          </button>
          <small v-if="cancelResult" :class="cancelResult.startsWith('✅') ? 'text-success' : 'text-danger'"
            style="font-size:11px; max-width:280px; text-align:right;">{{ cancelResult }}</small>
        </div>
        <!-- [/TEST] -->
        <button class="btn btn-sm btn-outline-secondary" @click="load" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-1" />
          重新整理
        </button>
      </div>
    </div>

    <!-- 銷單提示 -->
    <div class="alert py-2 px-3 mb-3 d-flex align-items-center gap-2"
      style="background:#fff8e1; border:1px solid #f0c040; color:#7a5c00; font-size:13px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      下次自動銷單時間：<strong>{{ nextCancelDate }} 00:00（台灣）</strong>
      &nbsp;—&nbsp;屆時未結帳的現貨訂單將自動取消並回補庫存。
    </div>

    <!-- Tabs -->
    <ul class="nav nav-tabs mb-3" style="font-size:13px;">
      <li class="nav-item">
        <button class="nav-link" :class="{ active: activeTab === 'cart' }" @click="activeTab = 'cart'">
          購物車待結帳
          <span v-if="cartRows.length" class="badge rounded-pill ms-1"
            style="background:#c8a882; color:#fff; font-size:11px;">{{ cartRows.length }}</span>
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" :class="{ active: activeTab === 'cancelled' }" @click="activeTab = 'cancelled'">
          本週被封鎖名單
          <span v-if="cancelledRows.length" class="badge rounded-pill ms-1"
            style="background:#c0392b; color:#fff; font-size:11px;">{{ cancelledRows.length }}</span>
        </button>
      </li>
    </ul>

    <!-- Error -->
    <div v-if="errMsg" class="alert alert-danger py-2" style="font-size:13px;">{{ errMsg }}</div>

    <!-- ── Tab 1：購物車待結帳 ─────────────────────────────── -->
    <template v-if="activeTab === 'cart'">
      <div v-if="!loading && !cartRows.length && !errMsg"
        class="text-center py-5 text-muted" style="font-size:14px;">
        目前沒有待結帳的現貨顧客 🎉
      </div>

      <div v-if="cartRows.length" class="card border-0 shadow-sm">
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
              <tr v-for="row in cartRows" :key="row.key">
                <td class="px-3 py-3">
                  <div class="fw-semibold" style="color:#1a1714;">{{ row.fbName || '—' }}</div>
                  <div class="text-muted" style="font-size:11px;">{{ row.email || '—' }}</div>
                </td>
                <td class="px-3 py-3 text-center">
                  <span v-if="row.hasLine" class="badge" style="background:#00b900; color:#fff; font-size:11px;">已綁定</span>
                  <span v-else class="badge bg-secondary" style="font-size:11px;">未綁定</span>
                </td>
                <td class="px-3 py-3 text-end fw-semibold">{{ row.itemCount }} 件</td>
                <td class="px-3 py-3 text-end fw-semibold" style="color:#c0392b;">
                  NT${{ row.totalAmount.toLocaleString() }}
                </td>
                <td class="px-3 py-3 text-center">
                  <button v-if="row.hasLine" class="btn btn-sm"
                    :class="{
                      'btn-outline-success': !notifyStatus[row.key] || notifyStatus[row.key] === 'failed',
                      'btn-success':         notifyStatus[row.key] === 'sent',
                      'btn-secondary':       notifyStatus[row.key] === 'sending',
                    }"
                    :disabled="notifyStatus[row.key] === 'sending' || notifyStatus[row.key] === 'sent'"
                    style="font-size:12px;" @click="sendLineNotify(row, 'cart')"
                  >
                    <span v-if="notifyStatus[row.key] === 'sending'" class="spinner-border spinner-border-sm me-1" />
                    <span v-else-if="notifyStatus[row.key] === 'sent'">✓ 已送出</span>
                    <span v-else-if="notifyStatus[row.key] === 'failed'">⚠ 重新發送</span>
                    <span v-else>LINE 提醒</span>
                  </button>
                  <span v-else class="text-muted" style="font-size:12px;">無法通知</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-3 py-2 text-muted" style="font-size:12px; border-top:1px solid #f0ece7;">
          共 {{ cartRows.length }} 位顧客，{{ cartRows.reduce((s, r) => s + r.itemCount, 0) }} 件現貨商品待結帳
        </div>
      </div>
    </template>

    <!-- ── Tab 2：本週已銷單 ──────────────────────────────── -->
    <template v-if="activeTab === 'cancelled'">
      <div v-if="!loading && !cancelledRows.length && !errMsg"
        class="text-center py-5 text-muted" style="font-size:14px;">
        本週尚無銷單紀錄 🎉
      </div>

      <div v-if="cancelledRows.length" class="card border-0 shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:13px;">
            <thead style="background:#f9f6f2; font-size:12px; color:#6b5c4e;">
              <tr>
                <th class="px-3 py-3">顧客</th>
                <th class="px-3 py-3 text-center">LINE</th>
                <th class="px-3 py-3">被取消的商品</th>
                <th class="px-3 py-3 text-end">訂單金額</th>
                <th class="px-3 py-3">銷單時間</th>
                <th class="px-3 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in cancelledRows" :key="row.key">
                <td class="px-3 py-3">
                  <div class="fw-semibold" style="color:#1a1714;">{{ row.fbName || '—' }}</div>
                  <div class="text-muted" style="font-size:11px;">{{ row.email || '—' }}</div>
                </td>
                <td class="px-3 py-3 text-center">
                  <span v-if="row.hasLine" class="badge" style="background:#00b900; color:#fff; font-size:11px;">已綁定</span>
                  <span v-else class="badge bg-secondary" style="font-size:11px;">未綁定</span>
                </td>
                <!-- 商品清單 -->
                <td class="px-3 py-3" style="max-width:280px;">
                  <div v-if="row.cartOnly" class="text-muted" style="font-size:12px;">
                    <span class="badge bg-secondary me-1" style="font-size:10px;">購物車清除</span>
                    未建立訂單
                  </div>
                  <template v-else>
                    <div v-for="(it, i) in row.items.slice(0, 3)" :key="i"
                      class="text-muted" style="font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      {{ it.ProductName }}
                      <span v-if="it.ColorName || it.SizeName" style="color:#aaa;">
                        （{{ [it.ColorName, it.SizeName].filter(Boolean).join(' / ') }}）
                      </span>
                      × {{ it.Qty }}
                    </div>
                    <div v-if="row.items.length > 3" class="text-muted" style="font-size:11px;">
                      ⋯ 共 {{ row.items.length }} 件
                    </div>
                  </template>
                </td>
                <td class="px-3 py-3 text-end fw-semibold" style="color:#c0392b;">
                  <span v-if="row.cartOnly" class="text-muted">—</span>
                  <span v-else>NT${{ row.totalAmount.toLocaleString() }}</span>
                </td>
                <td class="px-3 py-3 text-muted" style="font-size:12px;">
                  {{ fmtDate(row.cancelledAt) }}
                </td>
                <td class="px-3 py-3 text-center">
                  <button v-if="row.hasLine" class="btn btn-sm"
                    :class="{
                      'btn-outline-warning': !notifyStatus[row.key] || notifyStatus[row.key] === 'failed',
                      'btn-warning':         notifyStatus[row.key] === 'sent',
                      'btn-secondary':       notifyStatus[row.key] === 'sending',
                    }"
                    :disabled="notifyStatus[row.key] === 'sending' || notifyStatus[row.key] === 'sent'"
                    style="font-size:12px;" @click="sendLineNotify(row, 'cancelled')"
                  >
                    <span v-if="notifyStatus[row.key] === 'sending'" class="spinner-border spinner-border-sm me-1" />
                    <span v-else-if="notifyStatus[row.key] === 'sent'">✓ 已送出</span>
                    <span v-else-if="notifyStatus[row.key] === 'failed'">⚠ 重新發送</span>
                    <span v-else>LINE 提醒重購</span>
                  </button>
                  <span v-else class="text-muted" style="font-size:12px;">無法通知</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-3 py-2 text-muted" style="font-size:12px; border-top:1px solid #f0ece7;">
          本週共 {{ cancelledRows.length }} 位會員被封鎖（{{ cancelledRows.filter(r => !r.cartOnly).length }} 筆訂單銷單、{{ cancelledRows.filter(r => r.cartOnly).length }} 位僅清購物車）
        </div>
      </div>
    </template>

  </div>
</template>
