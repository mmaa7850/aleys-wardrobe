<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

// ── 主表 ──────────────────────────────────────────────
const order      = ref(null)
const loading    = ref(false)
const saving     = ref(false)
const errMsg     = ref('')
const successMsg = ref('')

// ── 輔助資料 ──────────────────────────────────────────
const suppliers  = ref([])
const costTypes  = ref([])
const products   = ref([])   // { ID, ProductName, C_PRD_ProductVariantList: [...] }
const variantMap = ref({})   // variantId -> { label, productId, productName, colorName, sizeName }
const colorMap   = ref({})   // colorId -> name
const sizeMap    = ref({})   // sizeId  -> name
const imgMap        = ref({})   // productId -> publicUrl
const categoryList  = ref([])   // [{ Name, Description }]
const productSearch = ref('')
const categoryFilter = ref('')

// ── 明細 & 附加成本 ────────────────────────────────────
const items = ref([])   // C_INV_PurchaseOrderItemList
const costs = ref([])   // C_INV_PurchaseOrderCostList

// ── 新增明細 Modal ─────────────────────────────────────
const itemModalEl  = ref(null)
let   itemModal    = null
const itemForm     = ref({ ProductID: '', VariantID: '', Qty: 1, UnitCost: 0 })
const itemSaveErr  = ref('')
const itemSaving   = ref(false)
const editItemId   = ref(null)

// ── 新增附加成本 Modal ─────────────────────────────────
const costModalEl  = ref(null)
let   costModal    = null
const costForm     = ref({ CostTypeID: '', Amount: 0, Note: '' })
const costSaveErr  = ref('')
const costSaving   = ref(false)
const editCostId   = ref(null)

const isDraft = computed(() => order.value?.Status === 'draft')

// ─────────────────────────────────────────────────────
// 載入資料
// ─────────────────────────────────────────────────────
async function load() {
  loading.value = true
  errMsg.value  = ''
  try {
    const [
      { data: ord, error: e1 },
      { data: sups },
      { data: cts },
      { data: prods },
      { data: cats },
      { data: vars },
      { data: colors },
      { data: sizes },
      { data: pics },
      { data: its,  error: e2 },
      { data: csts, error: e3 },
    ] = await Promise.all([
      db.from('C_INV_PurchaseOrderList')
        .select(`ID, "PurchaseNo", "SupplierID", "PurchaseDate", "Status", "TotalCost", "Note"`)
        .eq('ID', props.id)
        .single(),
      db.from('S_INV_SupplierList').select('ID, "Name"').eq('IsActive', true).order('Name'),
      db.from('S_INV_CostTypeList').select('ID, "Name"').eq('IsActive', true).order('SortOrder'),
      db.from('C_PRD_ProductList').select('ID, "ProductName", "Category"').eq('IsActive', true),
      db.from('S_PRD_CategoryList').select('"Name", "Description"').order('Name'),
      db.from('C_PRD_ProductVariantList').select('ID, "ProductID", "ColorID", "SizeID", "IsActive"').eq('IsActive', true),
      db.from('S_PRD_ColorList').select('ID, "Name"'),
      db.from('S_PRD_SizeList').select('ID, "Name"'),
      db.from('C_PRD_ProductPictureList').select('"ProductID", "StoragePath", "IsMain", "SortOrder", "Type"').order('IsMain', { ascending: false }).order('SortOrder'),
      db.from('C_INV_PurchaseOrderItemList')
        .select('*')
        .eq('PurchaseOrderID', props.id)
        .order('ID'),
      db.from('C_INV_PurchaseOrderCostList')
        .select('*, S_INV_CostTypeList("Name")')
        .eq('PurchaseOrderID', props.id)
        .order('ID'),
    ])

    if (e1) throw e1
    if (e2) throw e2
    if (e3) throw e3

    order.value     = ord
    suppliers.value = sups ?? []
    costTypes.value = cts  ?? []
    items.value     = its  ?? []
    costs.value     = csts ?? []

    categoryList.value = cats ?? []

    // 建立 color / size map
    colorMap.value = Object.fromEntries((colors ?? []).map(c => [c.ID, c.Name]))
    sizeMap.value  = Object.fromEntries((sizes  ?? []).map(s => [s.ID, s.Name]))

    // 建立商品圖片 map（每個商品取第一張）
    const imap = {}
    for (const pic of (pics ?? [])) {
      if (!imap[pic.ProductID] && pic.StoragePath) {
        const { data: urlData } = supabase.storage.from('product-pictures').getPublicUrl(pic.StoragePath)
        imap[pic.ProductID] = { type: pic.Type, url: urlData?.publicUrl ?? '' }
      }
    }
    imgMap.value = imap

    // 建立 variant map
    const prodMap = Object.fromEntries((prods ?? []).map(p => [p.ID, p.ProductName]))
    const vmap = {}
    for (const v of (vars ?? [])) {
      const colorName = colorMap.value[v.ColorID] ?? ''
      const sizeName  = sizeMap.value[v.SizeID]   ?? ''
      vmap[v.ID] = {
        label:       `${prodMap[v.ProductID] ?? ''}｜${colorName} / ${sizeName}`,
        productId:   v.ProductID,
        productName: prodMap[v.ProductID] ?? '',
        colorName,
        sizeName,
      }
    }
    variantMap.value = vmap
    products.value   = prods ?? []
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

// ─────────────────────────────────────────────────────
// 編輯主表欄位（即時儲存）
// ─────────────────────────────────────────────────────
async function saveHeader() {
  if (!isDraft.value) return
  saving.value = true
  const { error } = await db.from('C_INV_PurchaseOrderList').update({
    SupplierID:   order.value.SupplierID   || null,
    PurchaseDate: order.value.PurchaseDate,
    Note:         order.value.Note?.trim() || null,
    UpdatedDate:  new Date().toISOString(),
  }).eq('ID', props.id)
  saving.value = false
  if (error) { errMsg.value = error.message }
}

// ─────────────────────────────────────────────────────
// 明細 CRUD
// ─────────────────────────────────────────────────────
const filteredProducts = computed(() => {
  let list = products.value
  if (categoryFilter.value) list = list.filter(p => p.Category === categoryFilter.value)
  const q = productSearch.value.trim().toLowerCase()
  if (q) list = list.filter(p => p.ProductName.toLowerCase().includes(q))
  return list
})

const variantsForProduct = computed(() => {
  if (!itemForm.value.ProductID) return []
  return Object.entries(variantMap.value)
    .filter(([, v]) => v.productId === Number(itemForm.value.ProductID))
    .map(([id, v]) => ({ id: Number(id), label: `${v.colorName} / ${v.sizeName}` }))
})

const ensureItemModal = async () => {
  await nextTick()
  if (!itemModal && itemModalEl.value) itemModal = new Modal(itemModalEl.value, { backdrop: 'static' })
}

const openAddItem = async () => {
  editItemId.value  = null
  itemForm.value    = { ProductID: '', VariantID: '', Qty: 1, UnitCost: 0 }
  itemSaveErr.value = ''
  productSearch.value  = ''
  categoryFilter.value = ''
  await ensureItemModal()
  itemModal.show()
}

const openEditItem = async (row) => {
  editItemId.value  = row.ID
  itemSaveErr.value = ''
  // 找出 ProductID
  const vm = variantMap.value[row.VariantID]
  itemForm.value = {
    ProductID:  vm?.productId ?? '',
    VariantID:  row.VariantID,
    Qty:        row.Qty,
    UnitCost:   Number(row.UnitCost),
  }
  await ensureItemModal()
  itemModal.show()
}

async function saveItem() {
  itemSaveErr.value = ''
  if (!itemForm.value.VariantID) { itemSaveErr.value = '請選擇商品規格'; return }
  if (!(Number(itemForm.value.Qty) > 0)) { itemSaveErr.value = '數量須大於 0'; return }
  if (Number(itemForm.value.UnitCost) < 0) { itemSaveErr.value = '單位成本不可為負'; return }

  const vm = variantMap.value[Number(itemForm.value.VariantID)]
  const payload = {
    PurchaseOrderID: Number(props.id),
    ProductID:    vm?.productId   ?? 0,
    VariantID:    Number(itemForm.value.VariantID),
    ProductName:  vm?.productName ?? '',
    ColorName:    vm?.colorName   ?? '',
    SizeName:     vm?.sizeName    ?? '',
    Qty:          Number(itemForm.value.Qty),
    UnitCost:     Number(itemForm.value.UnitCost),
  }

  itemSaving.value = true
  let error
  if (editItemId.value) {
    ;({ error } = await db.from('C_INV_PurchaseOrderItemList').update(payload).eq('ID', editItemId.value))
  } else {
    ;({ error } = await db.from('C_INV_PurchaseOrderItemList').insert(payload))
  }
  itemSaving.value = false
  if (error) { itemSaveErr.value = error.message; return }
  itemModal.hide()
  await load()
}

async function deleteItem(id) {
  if (!confirm('確認刪除此明細？')) return
  await db.from('C_INV_PurchaseOrderItemList').delete().eq('ID', id)
  await load()
}

// ─────────────────────────────────────────────────────
// 附加成本 CRUD
// ─────────────────────────────────────────────────────
const ensureCostModal = async () => {
  await nextTick()
  if (!costModal && costModalEl.value) costModal = new Modal(costModalEl.value, { backdrop: 'static' })
}

const openAddCost = async () => {
  editCostId.value  = null
  costForm.value    = { CostTypeID: '', Amount: 0, Note: '' }
  costSaveErr.value = ''
  await ensureCostModal()
  costModal.show()
}

const openEditCost = async (row) => {
  editCostId.value  = row.ID
  costSaveErr.value = ''
  costForm.value = {
    CostTypeID: row.CostTypeID ?? '',
    Amount:     Number(row.Amount),
    Note:       row.Note ?? '',
  }
  await ensureCostModal()
  costModal.show()
}

async function saveCost() {
  costSaveErr.value = ''
  if (Number(costForm.value.Amount) < 0) { costSaveErr.value = '金額不可為負'; return }

  const payload = {
    PurchaseOrderID: Number(props.id),
    CostTypeID:      costForm.value.CostTypeID || null,
    Amount:          Number(costForm.value.Amount),
    Note:            costForm.value.Note?.trim() || null,
  }

  costSaving.value = true
  let error
  if (editCostId.value) {
    ;({ error } = await db.from('C_INV_PurchaseOrderCostList').update(payload).eq('ID', editCostId.value))
  } else {
    ;({ error } = await db.from('C_INV_PurchaseOrderCostList').insert(payload))
  }
  costSaving.value = false
  if (error) { costSaveErr.value = error.message; return }
  costModal.hide()
  await load()
}

async function deleteCost(id) {
  if (!confirm('確認刪除此成本項目？')) return
  await db.from('C_INV_PurchaseOrderCostList').delete().eq('ID', id)
  await load()
}

// ─────────────────────────────────────────────────────
// 小計
// ─────────────────────────────────────────────────────
const itemsTotal = computed(() =>
  items.value.reduce((s, i) => s + Number(i.SubTotal ?? 0), 0)
)
const costsTotal = computed(() =>
  costs.value.reduce((s, c) => s + Number(c.Amount ?? 0), 0)
)
const grandTotal = computed(() => itemsTotal.value + costsTotal.value)

// ─────────────────────────────────────────────────────
// 確認進貨（核心邏輯）
// ─────────────────────────────────────────────────────
const confirming = ref(false)

async function confirmPurchase() {
  if (!isDraft.value) return
  if (!items.value.length) { errMsg.value = '請至少新增一筆進貨明細'; return }
  if (!confirm('確認後將更新各規格的加權平均成本，並增加庫存。確定要確認此進貨單？')) return

  confirming.value = true
  errMsg.value     = ''
  successMsg.value = ''

  try {
    // 1. 每個 Variant 分配到的落地成本 = UnitCost + (附加成本 / 總件數) 按比例分攤
    const totalQty = items.value.reduce((s, i) => s + i.Qty, 0) || 1
    const extraPerUnit = costsTotal.value / totalQty

    // 2. 取得現有 CostPrice & StockQty
    const variantIds = [...new Set(items.value.map(i => i.VariantID))]
    const { data: variants, error: vErr } = await db
      .from('C_PRD_ProductVariantList')
      .select('ID, "CostPrice", "StockQty"')
      .in('ID', variantIds)
    if (vErr) throw vErr

    const variantCurrent = Object.fromEntries((variants ?? []).map(v => [v.ID, v]))

    // 3. 按 VariantID 合計本次進貨
    const byVariant = {}
    for (const item of items.value) {
      const vid = item.VariantID
      if (!byVariant[vid]) byVariant[vid] = { qty: 0, cost: 0 }
      byVariant[vid].qty  += item.Qty
      byVariant[vid].cost += item.Qty * (Number(item.UnitCost) + extraPerUnit)
    }

    // 4. 計算新加權平均成本，並批次 update
    const updates = []
    for (const [vidStr, incoming] of Object.entries(byVariant)) {
      const vid     = Number(vidStr)
      const cur     = variantCurrent[vid]
      if (!cur) continue
      const oldQty  = Number(cur.StockQty)  || 0
      const oldCost = Number(cur.CostPrice) || 0
      const newQty  = oldQty + incoming.qty
      const newCost = newQty > 0
        ? (oldQty * oldCost + incoming.cost) / newQty
        : 0
      updates.push(
        db.from('C_PRD_ProductVariantList').update({
          CostPrice: parseFloat(newCost.toFixed(4)),
          StockQty:  newQty,
        }).eq('ID', vid)
      )
    }
    const results = await Promise.all(updates)
    for (const r of results) { if (r.error) throw r.error }

    // 5. 更新進貨單 Status + TotalCost
    const { error: updErr } = await db.from('C_INV_PurchaseOrderList').update({
      Status:      'confirmed',
      TotalCost:   parseFloat(grandTotal.value.toFixed(4)),
      UpdatedDate: new Date().toISOString(),
    }).eq('ID', props.id)
    if (updErr) throw updErr

    successMsg.value = '進貨已確認！庫存與加權平均成本已更新。'
    await load()
  } catch (e) {
    errMsg.value = '確認失敗：' + (e?.message ?? String(e))
  } finally {
    confirming.value = false
  }
}

// ─────────────────────────────────────────────────────
// 格式化
// ─────────────────────────────────────────────────────
const fmt = (n) => Number(n ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

onMounted(load)
</script>

<template>
  <div class="container-fluid py-4">

    <!-- Back + Title -->
    <div class="d-flex align-items-center mb-4 gap-3">
      <button class="btn btn-sm btn-outline-secondary" @click="router.push('/admin/inventory/purchases')">
        ← 返回列表
      </button>
      <div>
        <h4 class="mb-0 fw-semibold">
          進貨單
          <span class="text-muted fs-6 ms-2">{{ order?.PurchaseNo }}</span>
        </h4>
      </div>
      <span v-if="order" class="badge ms-1" :class="order.Status === 'confirmed' ? 'bg-success' : 'bg-secondary'">
        {{ order.Status === 'confirmed' ? '已確認' : '草稿' }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-5 text-muted">
      <div class="spinner-border me-2"></div>載入中…
    </div>

    <template v-else-if="order">
      <!-- Alerts -->
      <div v-if="errMsg"     class="alert alert-danger   py-2">{{ errMsg }}</div>
      <div v-if="successMsg" class="alert alert-success  py-2">{{ successMsg }}</div>

      <!-- ── Header Form ──────────────────────────────── -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white fw-medium border-bottom">基本資訊</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label">供應商</label>
              <select v-model="order.SupplierID" class="form-select" :disabled="!isDraft" @change="saveHeader">
                <option :value="null">— 不指定 —</option>
                <option v-for="s in suppliers" :key="s.ID" :value="s.ID">{{ s.Name }}</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">進貨日期</label>
              <input v-model="order.PurchaseDate" type="date" class="form-control" :disabled="!isDraft" @change="saveHeader" />
            </div>
            <div class="col-md-5">
              <label class="form-label">備註</label>
              <input v-model="order.Note" type="text" class="form-control" :disabled="!isDraft" @blur="saveHeader" placeholder="選填備註" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── 進貨明細 ──────────────────────────────────── -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white d-flex align-items-center justify-content-between border-bottom">
          <span class="fw-medium">進貨明細</span>
          <button v-if="isDraft" class="btn btn-sm btn-outline-primary" @click="openAddItem">
            <i class="bi bi-plus-lg me-1"></i>新增明細
          </button>
        </div>
        <div class="card-body p-0">
          <div v-if="!items.length" class="text-center py-4 text-muted">尚無進貨明細</div>
          <div v-else class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>商品</th>
                  <th>顏色</th>
                  <th>尺寸</th>
                  <th class="text-end">數量</th>
                  <th class="text-end">單位成本</th>
                  <th class="text-end">小計</th>
                  <th v-if="isDraft" style="width:60px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.ID">
                  <td>{{ item.ProductName }}</td>
                  <td>{{ item.ColorName }}</td>
                  <td>{{ item.SizeName }}</td>
                  <td class="text-end">{{ item.Qty }}</td>
                  <td class="text-end">{{ fmt(item.UnitCost) }}</td>
                  <td class="text-end fw-medium">{{ fmt(item.SubTotal) }}</td>
                  <td v-if="isDraft" class="text-end">
                    <button class="btn btn-xs btn-outline-secondary me-1" @click="openEditItem(item)">✎</button>
                    <button class="btn btn-xs btn-outline-danger" @click="deleteItem(item.ID)">✕</button>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-light">
                <tr>
                  <td colspan="5" class="text-end fw-semibold">商品小計</td>
                  <td class="text-end fw-semibold">NT$ {{ fmt(itemsTotal) }}</td>
                  <td v-if="isDraft"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ── 附加成本 ──────────────────────────────────── -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white d-flex align-items-center justify-content-between border-bottom">
          <span class="fw-medium">附加成本</span>
          <button v-if="isDraft" class="btn btn-sm btn-outline-primary" @click="openAddCost">
            <i class="bi bi-plus-lg me-1"></i>新增成本
          </button>
        </div>
        <div class="card-body p-0">
          <div v-if="!costs.length" class="text-center py-4 text-muted">尚無附加成本</div>
          <div v-else class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>成本類型</th>
                  <th class="text-end">金額</th>
                  <th>備註</th>
                  <th v-if="isDraft" style="width:60px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in costs" :key="c.ID">
                  <td>{{ c.S_INV_CostTypeList?.Name ?? '其他' }}</td>
                  <td class="text-end">NT$ {{ fmt(c.Amount) }}</td>
                  <td class="text-muted small">{{ c.Note || '—' }}</td>
                  <td v-if="isDraft" class="text-end">
                    <button class="btn btn-xs btn-outline-secondary me-1" @click="openEditCost(c)">✎</button>
                    <button class="btn btn-xs btn-outline-danger" @click="deleteCost(c.ID)">✕</button>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-light">
                <tr>
                  <td class="text-end fw-semibold">附加成本小計</td>
                  <td class="text-end fw-semibold">NT$ {{ fmt(costsTotal) }}</td>
                  <td></td>
                  <td v-if="isDraft"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ── 總計 + 確認按鈕 ──────────────────────────── -->
      <div class="d-flex justify-content-end align-items-center gap-4 mb-4">
        <div class="text-end">
          <div class="text-muted small">總落地成本</div>
          <div class="fs-5 fw-bold">NT$ {{ fmt(grandTotal) }}</div>
          <div class="text-muted small">（含商品成本 + 附加成本，按件數均攤）</div>
        </div>
        <button
          v-if="isDraft"
          class="btn btn-success"
          :disabled="confirming || !items.length"
          @click="confirmPurchase"
        >
          <span v-if="confirming" class="spinner-border spinner-border-sm me-1"></span>
          確認進貨
        </button>
      </div>
    </template>

  </div>

  <!-- ── 新增明細 Modal ───────────────────────────────── -->
  <div ref="itemModalEl" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ editItemId ? '編輯明細' : '新增明細' }}</h5>
          <button type="button" class="btn-close" @click="itemModal?.hide()"></button>
        </div>
        <div class="modal-body">
          <div v-if="itemSaveErr" class="alert alert-danger py-2 mb-3">{{ itemSaveErr }}</div>

          <!-- 商品搜尋 + card 選擇 -->
          <div class="mb-3">
            <label class="form-label fw-medium">選擇商品 <span class="text-danger">*</span></label>
            <div class="row g-2 mb-2">
              <div class="col-6">
                <input v-model="productSearch" type="text" class="form-control" placeholder="🔍 搜尋商品名稱…" />
              </div>
              <div class="col-6">
                <select v-model="categoryFilter" class="form-select">
                  <option value="">全部分類</option>
                  <option v-for="c in categoryList" :key="c.Name" :value="c.Name">{{ c.Description }}</option>
                </select>
              </div>
            </div>
            <div class="product-picker-grid">
              <div
                v-for="p in filteredProducts" :key="p.ID"
                class="product-card"
                :class="{ selected: itemForm.ProductID === p.ID }"
                @click="itemForm.ProductID = p.ID; itemForm.VariantID = ''"
              >
                <div class="product-card-img">
                  <img v-if="imgMap[p.ID]?.type === 'image'" :src="imgMap[p.ID].url" :alt="p.ProductName" />
                  <video v-else-if="imgMap[p.ID]?.type === 'video'" autoplay muted loop playsinline>
                    <source :src="imgMap[p.ID].url" />
                  </video>
                  <div v-else class="product-card-no-img">—</div>
                </div>
                <div class="product-card-name">{{ p.ProductName }}</div>
              </div>
              <div v-if="filteredProducts.length === 0" class="text-muted small py-2">找不到符合的商品</div>
            </div>
          </div>

          <!-- 規格 / 數量 / 成本（選完商品才顯示） -->
          <template v-if="itemForm.ProductID">
            <hr class="my-3" />
            <div class="row g-3">
              <div class="col-12 col-md-4">
                <label class="form-label fw-medium">規格 <span class="text-danger">*</span></label>
                <select v-model="itemForm.VariantID" class="form-select">
                  <option value="">— 選擇規格 —</option>
                  <option v-for="v in variantsForProduct" :key="v.id" :value="v.id">{{ v.label }}</option>
                </select>
              </div>
              <div class="col-6 col-md-4">
                <label class="form-label fw-medium">進貨數量</label>
                <input v-model.number="itemForm.Qty" type="number" min="1" class="form-control" />
              </div>
              <div class="col-6 col-md-4">
                <label class="form-label fw-medium">單位成本（元）</label>
                <input v-model.number="itemForm.UnitCost" type="number" min="0" step="0.0001" class="form-control" />
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="itemModal?.hide()" :disabled="itemSaving">取消</button>
          <button class="btn btn-primary" @click="saveItem" :disabled="itemSaving">
            <span v-if="itemSaving" class="spinner-border spinner-border-sm me-1"></span>
            儲存
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 新增附加成本 Modal ───────────────────────────── -->
  <div ref="costModalEl" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ editCostId ? '編輯附加成本' : '新增附加成本' }}</h5>
          <button type="button" class="btn-close" @click="costModal?.hide()"></button>
        </div>
        <div class="modal-body">
          <div v-if="costSaveErr" class="alert alert-danger py-2 mb-3">{{ costSaveErr }}</div>

          <div class="mb-3">
            <label class="form-label">成本類型</label>
            <select v-model="costForm.CostTypeID" class="form-select">
              <option value="">— 其他 —</option>
              <option v-for="ct in costTypes" :key="ct.ID" :value="ct.ID">{{ ct.Name }}</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label fw-medium">金額（元）<span class="text-danger">*</span></label>
            <input v-model.number="costForm.Amount" type="number" min="0" step="0.01" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label">備註</label>
            <input v-model="costForm.Note" type="text" class="form-control" placeholder="選填" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="costModal?.hide()" :disabled="costSaving">取消</button>
          <button class="btn btn-primary" @click="saveCost" :disabled="costSaving">
            <span v-if="costSaving" class="spinner-border spinner-border-sm me-1"></span>
            儲存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-xs {
  padding: 2px 6px;
  font-size: 12px;
}

/* 商品選擇 grid */
.product-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-height: 340px;
  overflow-y: auto;
  padding: 4px 2px;
}

.product-card {
  width: 110px;
  border: 2px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: #fff;
}
.product-card:hover {
  border-color: #aaa;
}
.product-card.selected {
  border-color: #c9a96e;
  box-shadow: 0 0 0 2px #c9a96e44;
}

.product-card-img {
  width: 100%;
  height: 80px;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}
.product-card-img img,
.product-card-img video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.product-card-no-img {
  color: #bbb;
  font-size: 18px;
}

.product-card-name {
  padding: 5px 6px;
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: #333;
}
</style>
