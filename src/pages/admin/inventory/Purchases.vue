<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/lib/db'

const router = useRouter()

const orders  = ref([])
const loading = ref(false)
const errMsg  = ref('')
const filter  = ref('all') // all | draft | confirmed

onMounted(load)

async function load() {
  loading.value = true
  errMsg.value  = ''
  try {
    const { data, error } = await db
      .from('C_INV_PurchaseOrderList')
      .select(`
        ID, "PurchaseNo", "PurchaseDate", "Status", "TotalCost", "Note", "CreatedDate",
        S_INV_SupplierList ( "Name" )
      `)
      .order('ID', { ascending: false })
    if (error) throw error
    orders.value = data ?? []
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  if (filter.value === 'all') return orders.value
  return orders.value.filter(o => o.Status === filter.value)
})

async function createNew() {
  // 產生單號 PO_YYYYMMDD_XXXXX
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
  const rand = String(Math.floor(Math.random() * 99999)).padStart(5, '0')
  const purchaseNo = `PO_${ymd}_${rand}`

  const { data, error } = await db
    .from('C_INV_PurchaseOrderList')
    .insert({
      PurchaseNo:   purchaseNo,
      PurchaseDate: now.toISOString().slice(0, 10),
      Status:       'draft',
    })
    .select('ID')
    .single()

  if (error) { alert('建立失敗：' + error.message); return }
  router.push(`/admin/inventory/purchases/${data.ID}`)
}

const formatDate = (val) => {
  if (!val) return ''
  return new Date(val).toLocaleDateString('zh-TW')
}

const formatAmount = (val) => {
  if (val == null) return '—'
  return 'NT$ ' + Number(val).toLocaleString()
}

const statusLabel = (s) => s === 'confirmed' ? '已確認' : '草稿'
const statusClass = (s) => s === 'confirmed' ? 'bg-success' : 'bg-secondary'
</script>

<template>
  <div class="container-fluid py-4">

    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 class="mb-0 fw-semibold">進貨單</h4>
        <small class="text-muted">建立並管理批次進貨記錄</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="createNew">
        <i class="bi bi-plus-lg me-1"></i>新增進貨單
      </button>
    </div>

    <!-- Filter -->
    <div class="mb-3 d-flex gap-2">
      <button class="btn btn-sm" :class="filter==='all'       ? 'btn-dark'      : 'btn-outline-secondary'" @click="filter='all'">全部</button>
      <button class="btn btn-sm" :class="filter==='draft'     ? 'btn-secondary' : 'btn-outline-secondary'" @click="filter='draft'">草稿</button>
      <button class="btn btn-sm" :class="filter==='confirmed' ? 'btn-success'   : 'btn-outline-secondary'" @click="filter='confirmed'">已確認</button>
    </div>

    <!-- Error -->
    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <!-- Table -->
    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm me-2"></div>載入中…
        </div>
        <div v-else-if="!filtered.length" class="text-center py-5 text-muted">尚無進貨單</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>進貨單號</th>
                <th>供應商</th>
                <th>進貨日期</th>
                <th>狀態</th>
                <th>總成本</th>
                <th>建立時間</th>
                <th style="width:80px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in filtered" :key="o.ID">
                <td class="fw-medium text-primary" style="cursor:pointer" @click="router.push(`/admin/inventory/purchases/${o.ID}`)">
                  {{ o.PurchaseNo }}
                </td>
                <td>{{ o.S_INV_SupplierList?.Name ?? '—' }}</td>
                <td>{{ o.PurchaseDate }}</td>
                <td><span class="badge" :class="statusClass(o.Status)">{{ statusLabel(o.Status) }}</span></td>
                <td>{{ formatAmount(o.TotalCost) }}</td>
                <td class="text-muted small">{{ formatDate(o.CreatedDate) }}</td>
                <td>
                  <button class="btn btn-sm btn-outline-secondary" @click="router.push(`/admin/inventory/purchases/${o.ID}`)">
                    查看
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>
