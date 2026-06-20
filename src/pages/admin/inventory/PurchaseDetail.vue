<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
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
const imgMap         = ref({})   // productId -> publicUrl
const categoryList   = ref([])   // [{ Name, Description }]
const productSearch  = ref('')
const categoryFilter = ref('')

// ── 進貨明細搜尋 & 折疊 ────────────────────────────────
const itemSearch         = ref('')
const itemCategoryFilter = ref('')
const collapsedGroups    = ref(new Set())

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

// ── 收據上傳 ───────────────────────────────────────────
const receiptFile       = ref(null)
const receiptPreviewUrl = ref('')
const receiptUploading  = ref(false)
const receiptError      = ref('')
const receiptFileInput  = ref(null)

function getReceiptPublicUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from('receipts').getPublicUrl(path)
  return data?.publicUrl ?? null
}
function isImagePath(path) {
  return /\.(jpe?g|png|gif|webp|heic|avif)$/i.test(path ?? '')
}
function onReceiptFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  receiptFile.value = file
  receiptPreviewUrl.value = URL.createObjectURL(file)
}
async function uploadReceipt() {
  if (!receiptFile.value) return
  receiptUploading.value = true
  receiptError.value = ''
  try {
    const file = receiptFile.value
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `purchases/${props.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
    if (upErr) throw upErr
    const { error: dbErr } = await db.from('C_INV_PurchaseOrderList')
      .update({ ReceiptStoragePath: path, UpdatedDate: new Date().toISOString() })
      .eq('ID', props.id)
    if (dbErr) throw dbErr
    order.value.ReceiptStoragePath = path
    receiptPreviewUrl.value = getReceiptPublicUrl(path) ?? ''
    receiptFile.value = null
    if (receiptFileInput.value) receiptFileInput.value.value = ''
  } catch (e) {
    receiptError.value = '上傳失敗：' + (e?.message ?? String(e))
  } finally {
    receiptUploading.value = false
  }
}
async function removeReceipt() {
  if (!confirm('確定移除此收據？')) return
  const oldPath = order.value.ReceiptStoragePath
  const { error } = await db.from('C_INV_PurchaseOrderList')
    .update({ ReceiptStoragePath: null, UpdatedDate: new Date().toISOString() })
    .eq('ID', props.id)
  if (error) { errMsg.value = error.message; return }
  if (oldPath) supabase.storage.from('receipts').remove([oldPath]).catch(() => {})
  order.value.ReceiptStoragePath = null
  receiptPreviewUrl.value = ''
  receiptFile.value = null
  if (receiptFileInput.value) receiptFileInput.value.value = ''
}

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
        .select(`ID, "PurchaseNo", "SupplierID", "PurchaseDate", "Status", "TotalCost", "Note", "ReceiptStoragePath"`)
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
    receiptPreviewUrl.value = getReceiptPublicUrl(ord?.ReceiptStoragePath) ?? ''
    suppliers.value = sups ?? []
    costTypes.value = cts  ?? []
    items.value     = its  ?? []
    costs.value     = csts ?? []
    // 預設全部折疊
    collapsedGroups.value = new Set((its ?? []).map(i => i.ProductName))

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
// 新增模式：選完商品後展開的規格行列表
const variantRows = ref([])  // [{ id, colorName, sizeName, qty, unitCost }]

watch(() => itemForm.value.ProductID, (pid) => {
  if (!pid || editItemId.value) { variantRows.value = []; return }
  variantRows.value = Object.entries(variantMap.value)
    .filter(([, v]) => v.productId === Number(pid))
    .map(([id, v]) => ({ id: Number(id), colorName: v.colorName, sizeName: v.sizeName, qty: null, unitCost: null }))
})

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

  if (editItemId.value) {
    // ── 編輯模式：單筆更新 ──
    if (!itemForm.value.VariantID) { itemSaveErr.value = '請選擇商品規格'; return }
    if (!(Number(itemForm.value.Qty) > 0)) { itemSaveErr.value = '數量須大於 0'; return }
    if (Number(itemForm.value.UnitCost) < 0) { itemSaveErr.value = '單位成本不可為負'; return }
    const vm = variantMap.value[Number(itemForm.value.VariantID)]
    const payload = {
      PurchaseOrderID: Number(props.id),
      ProductID:   vm?.productId   ?? 0,
      VariantID:   Number(itemForm.value.VariantID),
      ProductName: vm?.productName ?? '',
      ColorName:   vm?.colorName   ?? '',
      SizeName:    vm?.sizeName    ?? '',
      Qty:         Number(itemForm.value.Qty),
      UnitCost:    Number(itemForm.value.UnitCost),
    }
    itemSaving.value = true
    const { error } = await db.from('C_INV_PurchaseOrderItemList').update(payload).eq('ID', editItemId.value)
    itemSaving.value = false
    if (error) { itemSaveErr.value = error.message; return }
  } else {
    // ── 新增模式：批次 insert（只存數量 > 0 的行）──
    const toSave = variantRows.value.filter(r => Number(r.qty) > 0)
    if (!toSave.length) { itemSaveErr.value = '請至少填入一個規格的進貨數量'; return }
    if (toSave.some(r => Number(r.unitCost) < 0)) { itemSaveErr.value = '單位成本不可為負'; return }
    const payloads = toSave.map(r => ({
      PurchaseOrderID: Number(props.id),
      ProductID:   variantMap.value[r.id]?.productId   ?? 0,
      VariantID:   r.id,
      ProductName: variantMap.value[r.id]?.productName ?? '',
      ColorName:   r.colorName,
      SizeName:    r.sizeName,
      Qty:         Number(r.qty),
      UnitCost:    Number(r.unitCost) || 0,
    }))
    itemSaving.value = true
    const { error } = await db.from('C_INV_PurchaseOrderItemList').insert(payloads)
    itemSaving.value = false
    if (error) { itemSaveErr.value = error.message; return }
  }

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
  if (!confirm('確認後將新增 FIFO 進貨批次並增加庫存。確定要確認此進貨單？')) return

  confirming.value = true
  errMsg.value     = ''
  successMsg.value = ''

  try {
    // 1. 每個 Variant 分配到的落地成本 = UnitCost + (附加成本 / 總件數) 按比例分攤
    const totalQty = items.value.reduce((s, i) => s + i.Qty, 0) || 1
    const extraPerUnit = costsTotal.value / totalQty

    // 2. 取得現有 StockQty（不再需要 CostPrice，改用 FIFO 批次）
    const variantIds = [...new Set(items.value.map(i => i.VariantID))]
    const { data: variants, error: vErr } = await db
      .from('C_PRD_ProductVariantList')
      .select('ID, "StockQty"')
      .in('ID', variantIds)
    if (vErr) throw vErr

    const variantCurrent = Object.fromEntries((variants ?? []).map(v => [v.ID, v]))

    // 3. 按 VariantID 合計本次進貨（含附加成本分攤）
    const byVariant = {}
    for (const item of items.value) {
      const vid = item.VariantID
      if (!byVariant[vid]) byVariant[vid] = { qty: 0, cost: 0 }
      byVariant[vid].qty  += item.Qty
      byVariant[vid].cost += item.Qty * (Number(item.UnitCost) + extraPerUnit)
    }

    // 4. FIFO：新增進貨批次 + 更新庫存數量
    const purchaseDate = order.value?.PurchaseDate ?? new Date().toISOString().slice(0, 10)
    const batchInserts = []
    const stockUpdates = []

    for (const [vidStr, incoming] of Object.entries(byVariant)) {
      const vid    = Number(vidStr)
      const cur    = variantCurrent[vid]
      if (!cur) continue
      const newQty       = (Number(cur.StockQty) || 0) + incoming.qty
      const fifoUnitCost = parseFloat((incoming.cost / incoming.qty).toFixed(4))

      batchInserts.push(
        db.from('C_INV_VariantBatchList').insert({
          VariantID:       vid,
          PurchaseOrderID: Number(props.id),
          PurchaseDate:    purchaseDate,
          UnitCost:        fifoUnitCost,
          OriginalQty:     incoming.qty,
          RemainingQty:    incoming.qty,
        })
      )
      stockUpdates.push(
        db.from('C_PRD_ProductVariantList').update({ StockQty: newQty }).eq('ID', vid)
      )
    }

    const batchResults = await Promise.all(batchInserts)
    for (const r of batchResults) { if (r.error) throw r.error }
    const stockResults = await Promise.all(stockUpdates)
    for (const r of stockResults) { if (r.error) throw r.error }

    // 5. 更新進貨單 Status + TotalCost
    const { error: updErr } = await db.from('C_INV_PurchaseOrderList').update({
      Status:      'confirmed',
      TotalCost:   parseFloat(grandTotal.value.toFixed(4)),
      UpdatedDate: new Date().toISOString(),
    }).eq('ID', props.id)
    if (updErr) throw updErr

    successMsg.value = '進貨已確認！FIFO 批次已建立，庫存已更新。'
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
// productName -> category 查找表
const productCategoryMap = computed(() => {
  const m = {}
  for (const p of products.value) m[p.ProductName] = p.Category ?? ''
  return m
})

// 分類顯示名稱
const categoryDescMap = computed(() =>
  Object.fromEntries(categoryList.value.map(c => [c.Name, c.Description]))
)

// 依商品名稱分組（含搜尋過濾）
const groupedItems = computed(() => {
  const q   = itemSearch.value.trim().toLowerCase()
  const cat = itemCategoryFilter.value
  const map = {}
  for (const item of items.value) {
    if (q   && !item.ProductName.toLowerCase().includes(q)) continue
    if (cat && productCategoryMap.value[item.ProductName] !== cat) continue
    if (!map[item.ProductName]) map[item.ProductName] = []
    map[item.ProductName].push(item)
  }
  return Object.entries(map).map(([name, rows]) => ({ name, rows }))
})

function toggleGroup(name) {
  const s = new Set(collapsedGroups.value)
  s.has(name) ? s.delete(name) : s.add(name)
  collapsedGroups.value = s
}

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

            <!-- 收據 / 憑證 -->
            <div class="col-12 mt-1">
              <label class="form-label mb-1">收據 / 憑證（選填）</label>
              <div class="d-flex align-items-start gap-3 flex-wrap">
                <!-- 已儲存收據 & 未選新檔案 -->
                <div v-if="order.ReceiptStoragePath && !receiptFile" class="receipt-thumb-wrap text-center">
                  <a :href="receiptPreviewUrl" target="_blank" rel="noopener">
                    <img v-if="isImagePath(order.ReceiptStoragePath)" :src="receiptPreviewUrl" class="receipt-thumb" alt="收據" />
                    <span v-else class="btn btn-sm btn-outline-secondary">📄 查看收據</span>
                  </a>
                  <button class="btn btn-xs btn-outline-danger mt-1 d-block w-100" @click="removeReceipt">移除</button>
                </div>
                <!-- 新選檔案預覽 -->
                <div v-if="receiptFile" class="receipt-thumb-wrap text-center">
                  <img v-if="receiptFile.type.startsWith('image/')" :src="receiptPreviewUrl" class="receipt-thumb" alt="預覽" />
                  <span v-else class="text-muted small d-block py-2">📄 {{ receiptFile.name }}</span>
                  <button class="btn btn-xs btn-success mt-1 d-block w-100" @click="uploadReceipt" :disabled="receiptUploading">
                    <span v-if="receiptUploading" class="spinner-border spinner-border-sm me-1"></span>上傳
                  </button>
                  <button class="btn btn-xs btn-outline-secondary mt-1 d-block w-100" @click="receiptFile=null; receiptPreviewUrl=getReceiptPublicUrl(order.ReceiptStoragePath)??''" :disabled="receiptUploading">取消</button>
                </div>
                <!-- 選檔按鈕 -->
                <div>
                  <input ref="receiptFileInput" type="file" class="form-control form-control-sm" accept="image/jpeg,image/png,image/webp,.pdf" @change="onReceiptFileChange" style="max-width:240px" />
                  <div class="form-text">JPG / PNG / WebP / PDF，選填</div>
                  <div v-if="receiptError" class="text-danger small mt-1">{{ receiptError }}</div>
                </div>
              </div>
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
          <!-- 搜尋列 -->
          <div class="px-3 py-2 border-bottom d-flex gap-2">
            <input v-model="itemSearch" type="text" class="form-control form-control-sm" style="max-width:220px" placeholder="🔍 搜尋商品名稱…" />
            <select v-model="itemCategoryFilter" class="form-select form-select-sm" style="max-width:180px">
              <option value="">全部分類</option>
              <option v-for="c in categoryList" :key="c.Name" :value="c.Name">{{ c.Description }}</option>
            </select>
          </div>

          <div v-if="!items.length" class="text-center py-4 text-muted">尚無進貨明細</div>
          <div v-else-if="!groupedItems.length" class="text-center py-4 text-muted">找不到符合的商品</div>
          <div v-else class="table-responsive">
            <table class="table align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>顏色</th>
                  <th>尺寸</th>
                  <th class="text-end">數量</th>
                  <th class="text-end">單位成本</th>
                  <th class="text-end">小計</th>
                  <th style="width:80px"></th>
                </tr>
              </thead>
              <tbody v-for="group in groupedItems" :key="group.name">
                <!-- 商品名稱分組 header -->
                <tr class="table-group-header" style="cursor:pointer" @click="toggleGroup(group.name)">
                  <td :colspan="isDraft ? 5 : 5" class="fw-semibold text-dark py-2 ps-3">
                    {{ group.name }}
                    <span class="text-muted small ms-2">{{ group.rows.length }} 個規格</span>
                  </td>
                  <td class="text-end pe-3">
                    <span class="group-toggle-arrow" :class="{ collapsed: collapsedGroups.has(group.name) }">▾</span>
                  </td>
                </tr>
                <!-- 該商品的規格列 -->
                <template v-if="!collapsedGroups.has(group.name)">
                  <tr v-for="item in group.rows" :key="item.ID">
                    <td class="ps-4 text-muted">{{ item.ColorName }}</td>
                    <td class="text-muted">{{ item.SizeName }}</td>
                    <td class="text-end">{{ item.Qty }}</td>
                    <td class="text-end">{{ fmt(item.UnitCost) }}</td>
                    <td class="text-end fw-medium">{{ fmt(item.SubTotal) }}</td>
                    <td class="text-end">
                      <template v-if="isDraft">
                        <button class="btn btn-xs btn-outline-secondary me-1" @click="openEditItem(item)">✎</button>
                        <button class="btn btn-xs btn-outline-danger" @click="deleteItem(item.ID)">✕</button>
                      </template>
                    </td>
                  </tr>
                </template>
              </tbody>
              <tfoot class="table-light">
                <tr>
                  <td colspan="4" class="text-end fw-semibold">商品小計</td>
                  <td class="text-end fw-semibold">NT$ {{ fmt(itemsTotal) }}</td>
                  <td></td>
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

          <!-- 新增模式：規格表格 -->
          <template v-if="!editItemId && itemForm.ProductID && variantRows.length">
            <hr class="my-3" />
            <p class="text-muted small mb-2">填入要進貨的規格數量，未填或 0 的規格會略過。</p>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>顏色</th>
                    <th>尺寸</th>
                    <th style="width:130px">進貨數量</th>
                    <th style="width:150px">單位成本（元）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in variantRows" :key="row.id">
                    <td>{{ row.colorName }}</td>
                    <td>{{ row.sizeName }}</td>
                    <td>
                      <input v-model.number="row.qty" type="number" min="0" class="form-control form-control-sm"
                        :class="{ 'border-primary': Number(row.qty) > 0 }" placeholder="0" />
                    </td>
                    <td>
                      <input v-model.number="row.unitCost" type="number" min="0" step="0.0001" class="form-control form-control-sm"
                        :disabled="!(Number(row.qty) > 0)" placeholder="0" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- 編輯模式：單筆下拉 -->
          <template v-if="editItemId">
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

.receipt-thumb-wrap {
  min-width: 72px;
}
.receipt-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #ddd;
  display: block;
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

/* 進貨明細分組 header */
.table-group-header td {
  background-color: #f5f0ea;
  border-top: 2px solid #e8ddd0;
  font-size: 14px;
  letter-spacing: 0.02em;
}
.table-group-header:hover td {
  background-color: #ede8e0;
}
.group-toggle-arrow {
  display: inline-block;
  transition: transform 0.2s;
  font-size: 16px;
  color: #888;
}
.group-toggle-arrow.collapsed {
  transform: rotate(180deg);
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
