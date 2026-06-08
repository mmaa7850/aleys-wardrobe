<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/lib/db'

const router  = useRouter()
const rows    = ref([])
const loading = ref(false)
const errMsg  = ref('')

onMounted(load)

async function load() {
  loading.value = true
  errMsg.value  = ''
  const { data, error } = await db
    .from('C_INV_ConsumablePurchaseList')
    .select('ID, "PurchaseNo", "PurchaseDate", "Status", "Note", "CreatedDate"')
    .order('CreatedDate', { ascending: false })
  if (error) errMsg.value = error.message
  else rows.value = data ?? []
  loading.value = false
}

async function createNew() {
  const now    = new Date()
  const y      = now.getFullYear()
  const m      = String(now.getMonth() + 1).padStart(2, '0')
  const d      = String(now.getDate()).padStart(2, '0')
  const rand   = String(Math.floor(Math.random() * 99999)).padStart(5, '0')
  const no     = `CPO_${y}${m}${d}_${rand}`

  const { data, error } = await db
    .from('C_INV_ConsumablePurchaseList')
    .insert({ PurchaseNo: no, PurchaseDate: `${y}-${m}-${d}`, Status: 'draft' })
    .select('ID').single()
  if (error) { errMsg.value = error.message; return }
  router.push(`/admin/inventory/consumable-purchases/${data.ID}`)
}

const STATUS_LABEL = { draft: '草稿', confirmed: '已確認' }
const STATUS_CLASS = { draft: 'bg-warning text-dark', confirmed: 'bg-success' }
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('zh-TW') : '—'
</script>

<template>
  <div class="container-fluid py-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-0 fw-semibold">耗材進貨</h4>
        <small class="text-muted">管理包材、贈品等耗材的採購記錄</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="createNew">＋ 新增進貨單</button>
    </div>

    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm me-2"></div>載入中…
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:13px">
            <thead class="table-light">
              <tr>
                <th>進貨單號</th>
                <th>進貨日期</th>
                <th>狀態</th>
                <th>備註</th>
                <th>建立時間</th>
                <th class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td colspan="6" class="text-center text-muted py-5">尚無進貨記錄</td>
              </tr>
              <tr v-for="r in rows" :key="r.ID" style="cursor:pointer" @click="router.push(`/admin/inventory/consumable-purchases/${r.ID}`)">
                <td class="font-monospace fw-medium">{{ r.PurchaseNo }}</td>
                <td>{{ r.PurchaseDate }}</td>
                <td><span class="badge" :class="STATUS_CLASS[r.Status] ?? 'bg-secondary'">{{ STATUS_LABEL[r.Status] ?? r.Status }}</span></td>
                <td class="text-muted">{{ r.Note || '—' }}</td>
                <td class="text-muted">{{ fmtDate(r.CreatedDate) }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-primary" @click.stop="router.push(`/admin/inventory/consumable-purchases/${r.ID}`)">查看</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
