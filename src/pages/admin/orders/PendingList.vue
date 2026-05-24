<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

// ── State ────────────────────────────────────────────────
const rows    = ref([])   // { memberId, fbName, email, hasLine, orderCount, totalAmount, latestAt, lineUserId }
const loading = ref(false)
const errMsg  = ref('')

// 通知狀態（memberID → 'sending' | 'sent' | 'failed'）
const notifyStatus = ref({})

// ── 下次銷單時間（下週一 00:00 台灣時間）────────────────
const nextCancelDate = computed(() => {
  const now = new Date()
  // 週幾（0=Sun, 1=Mon...）
  const day = now.getDay()
  // 距離下週一的天數
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
    // 1. 取所有 pending / payment_failed 訂單
    const { data: orders, error: ordErr } = await db
      .from('C_ORD_OrderList')
      .select('ID, CustomerEmail, CustomerName, FinalAmount, PaymentStatus, CreatedDate')
      .in('PaymentStatus', ['pending', 'payment_failed'])
      .order('CreatedDate', { ascending: false })

    if (ordErr) throw ordErr
    if (!orders?.length) { rows.value = []; return }

    // 2. 取所有相關會員資料（by CustomerEmail）
    const emails = [...new Set(orders.map(o => o.CustomerEmail).filter(Boolean))]
    const { data: members, error: mbrErr } = await db
      .from('C_MBR_MemberList')
      .select('ID, FbName, Email, LineUserID')
      .in('Email', emails)

    if (mbrErr) throw mbrErr

    const memberMap = Object.fromEntries((members ?? []).map(m => [m.Email, m]))

    // 3. 依 CustomerEmail 彙整
    const grouped = {}
    for (const ord of orders) {
      const email = ord.CustomerEmail
      if (!email) continue
      const m = memberMap[email]
      const key = email
      if (!grouped[key]) {
        grouped[key] = {
          memberId:    m?.ID ?? null,
          fbName:      m?.FbName || ord.CustomerName || '',
          email:       email,
          lineUserId:  m?.LineUserID || null,
          hasLine:     !!m?.LineUserID,
          orderCount:  0,
          totalAmount: 0,
          latestAt:    null,
        }
      }
      grouped[key].orderCount  += 1
      grouped[key].totalAmount += ord.FinalAmount ?? 0
      if (!grouped[key].latestAt || ord.CreatedDate > grouped[key].latestAt) {
        grouped[key].latestAt = ord.CreatedDate
      }
    }

    rows.value = Object.values(grouped)
      .sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''))
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
        message: `📢 提醒您，您有 ${row.orderCount} 筆訂單尚未完成付款，合計 NT$${row.totalAmount.toLocaleString()}。\n請於週一 00:00 銷單前完成付款，逾期訂單將自動取消。\n感謝您的支持！`,
      }),
    })
    if (!res.ok) throw new Error(await res.text())
    notifyStatus.value[row.memberId] = 'sent'
  } catch (e) {
    console.error('[PendingList] LINE notify error:', e)
    notifyStatus.value[row.memberId] = 'failed'
  }
}

// ── Format ────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
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
          待付款 / 付款失敗訂單彙整｜每位顧客的未付款總覽
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
      &nbsp;—&nbsp;逾期訂單將自動取消並回補庫存，購物金同步失效。
    </div>

    <!-- Error -->
    <div v-if="errMsg" class="alert alert-danger py-2" style="font-size:13px;">{{ errMsg }}</div>

    <!-- Empty -->
    <div v-if="!loading && !rows.length && !errMsg"
      class="text-center py-5 text-muted" style="font-size:14px;">
      目前沒有待付款訂單 🎉
    </div>

    <!-- Table -->
    <div v-if="rows.length" class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0" style="font-size:13px;">
          <thead style="background:#f9f6f2; font-size:12px; color:#6b5c4e;">
            <tr>
              <th class="px-3 py-3">顧客</th>
              <th class="px-3 py-3 text-center">LINE</th>
              <th class="px-3 py-3 text-end">訂單筆數</th>
              <th class="px-3 py-3 text-end">未付金額合計</th>
              <th class="px-3 py-3">最新訂單時間</th>
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

              <!-- 訂單筆數 -->
              <td class="px-3 py-3 text-end fw-semibold">
                {{ row.orderCount }}
              </td>

              <!-- 金額合計 -->
              <td class="px-3 py-3 text-end fw-semibold" style="color:#c0392b;">
                NT${{ row.totalAmount.toLocaleString() }}
              </td>

              <!-- 最新訂單時間 -->
              <td class="px-3 py-3 text-muted" style="font-size:12px;">
                {{ fmtDate(row.latestAt) }}
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
        共 {{ rows.length }} 位顧客，{{ rows.reduce((s, r) => s + r.orderCount, 0) }} 筆待付款訂單
      </div>
    </div>

  </div>
</template>
