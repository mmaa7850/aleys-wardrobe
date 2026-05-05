<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/lib/db'

const router = useRouter()

const variants = ref([])
const loading  = ref(false)
const filter   = ref('all') // all | low | out

onMounted(load)

async function load() {
  loading.value = true

  const [{ data: products }, { data: colors }, { data: sizes }] = await Promise.all([
    db.from('C_PRD_ProductList')
      .select('ID, ProductName, C_PRD_ProductVariantList(ID, ColorID, SizeID, StockQty, IsActive)')
      .eq('IsActive', true)
      .order('ID', { ascending: false }),
    db.from('S_PRD_ColorList').select('ID, Name'),
    db.from('S_PRD_SizeList').select('ID, Name'),
  ])

  const colorMap = Object.fromEntries((colors ?? []).map(c => [c.ID, c.Name]))
  const sizeMap  = Object.fromEntries((sizes  ?? []).map(s => [s.ID, s.Name]))

  const list = []
  for (const p of (products ?? [])) {
    for (const v of (p.C_PRD_ProductVariantList ?? [])) {
      if (!v.IsActive) continue
      list.push({
        productId:   p.ID,
        productName: p.ProductName,
        variantId:   v.ID,
        color:       colorMap[v.ColorID] ?? '—',
        size:        sizeMap[v.SizeID]   ?? '—',
        stock:       Number(v.StockQty)  || 0,
      })
    }
  }
  variants.value = list
  loading.value  = false
}

const filtered = computed(() => {
  if (filter.value === 'out') return variants.value.filter(v => v.stock === 0)
  if (filter.value === 'low') return variants.value.filter(v => v.stock > 0 && v.stock <= 5)
  return variants.value
})

const outCount = computed(() => variants.value.filter(v => v.stock === 0).length)
const lowCount = computed(() => variants.value.filter(v => v.stock > 0 && v.stock <= 5).length)

function stockClass(stock) {
  if (stock === 0)  return 'badge bg-danger'
  if (stock <= 5)   return 'badge bg-warning text-dark'
  return 'badge bg-success'
}

function goEdit(productId) {
  router.push(`/product/products/${productId}`)
}
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
      <div>
        <h4 class="mb-1">庫存總覽</h4>
        <div class="text-muted small">所有上架商品各規格剩餘庫存</div>
      </div>
      <button class="btn btn-sm btn-outline-primary" @click="load" :disabled="loading">
        ⟳ 重新整理
      </button>
    </div>

    <!-- Summary badges -->
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <span class="badge bg-danger fs-6">售完 {{ outCount }} 件規格</span>
      <span class="badge bg-warning text-dark fs-6">低庫存 {{ lowCount }} 件規格</span>
    </div>

    <!-- Filter -->
    <div class="card mb-3">
      <div class="card-body py-2 d-flex gap-2 align-items-center flex-wrap">
        <span class="text-muted small me-1">篩選：</span>
        <button :class="['btn btn-sm', filter === 'all' ? 'btn-primary' : 'btn-outline-secondary']" @click="filter = 'all'">全部 ({{ variants.length }})</button>
        <button :class="['btn btn-sm', filter === 'low' ? 'btn-warning' : 'btn-outline-warning']"  @click="filter = 'low'">低庫存 ≤5</button>
        <button :class="['btn btn-sm', filter === 'out' ? 'btn-danger'  : 'btn-outline-danger']"   @click="filter = 'out'">已售完</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-muted py-4 text-center">載入中...</div>

    <!-- Table -->
    <div v-else class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light">
            <tr>
              <th>商品名稱</th>
              <th>顏色</th>
              <th>尺寸</th>
              <th>庫存數量</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filtered.length">
              <td colspan="5" class="text-center text-muted py-4">無符合條件的資料</td>
            </tr>
            <tr v-for="v in filtered" :key="v.variantId">
              <td class="fw-medium">{{ v.productName }}</td>
              <td>{{ v.color }}</td>
              <td>{{ v.size }}</td>
              <td>
                <span :class="stockClass(v.stock)">{{ v.stock }} 件</span>
              </td>
              <td>
                <button class="btn btn-sm btn-outline-secondary" @click="goEdit(v.productId)">
                  編輯商品
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
