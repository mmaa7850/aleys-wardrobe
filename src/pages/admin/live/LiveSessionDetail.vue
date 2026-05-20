<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

const route     = useRoute()
const router    = useRouter()
const sessionId = Number(route.params.id)

// ── 場次資料 ──────────────────────────────────────────────
const session        = ref(null)
const loadingSession = ref(true)
const sessionErr     = ref('')
const editMode       = ref(false)
const editForm       = ref({})
const savingInfo     = ref(false)
const saveInfoErr    = ref('')

const STATUS_LABEL = { planned: '籌備中', active: '直播中', closed: '已結束' }
const STATUS_CLS   = { planned: 'bg-secondary', active: 'bg-success', closed: 'bg-dark' }

// ── 商品對照表 ────────────────────────────────────────────
const products    = ref([])
const loadingProd = ref(false)

let _prodModal  = null
const editProdId = ref(null)
const prodForm   = ref({ Code: '', ColorName: '', SizeName: '', LivePrice: '', VariantID: null, ProductName: '' })
const prodSaving = ref(false)
const prodErr    = ref('')

const variantSearch  = ref('')
const variantResults = ref([])
const variantLoading = ref(false)
let _variantTimer = null

// ── Tab ───────────────────────────────────────────────────
const activeTab = ref('products')

// ── 留言匯入 ──────────────────────────────────────────────
const rawText            = ref('')
const parsedItems        = ref([])
const skippedMultiBlocks = ref([])   // 一則留言有多筆商品 → 整個跳過
const parseError         = ref('')
const importing          = ref(false)
const importDone         = ref(false)
const importResults      = ref([])

// ═══════════════════════════════════════════════════════════
// 場次
// ═══════════════════════════════════════════════════════════
async function loadSession() {
  loadingSession.value = true
  const { data, error } = await db
    .from('C_LIV_SessionList')
    .select('*')
    .eq('ID', sessionId)
    .single()
  loadingSession.value = false
  if (error || !data) { sessionErr.value = '找不到此場次'; return }
  session.value = data
}

function startEditInfo() {
  editForm.value = { ...session.value }
  editMode.value = true
  saveInfoErr.value = ''
}

async function saveInfo() {
  savingInfo.value = true
  saveInfoErr.value = ''
  const { error } = await db
    .from('C_LIV_SessionList')
    .update({
      Title:    editForm.value.Title,
      LiveDate: editForm.value.LiveDate || null,
      Status:   editForm.value.Status,
      Notes:    editForm.value.Notes || null,
    })
    .eq('ID', sessionId)
  savingInfo.value = false
  if (error) { saveInfoErr.value = error.message; return }
  session.value = { ...session.value, ...editForm.value }
  editMode.value = false
}

// ═══════════════════════════════════════════════════════════
// 商品對照表
// ═══════════════════════════════════════════════════════════
async function loadProducts() {
  loadingProd.value = true
  const { data } = await db
    .from('C_LIV_ProductList')
    .select('*')
    .eq('SessionID', sessionId)
    .order('ID')
  loadingProd.value = false
  products.value = data || []
}

function openAddProduct() {
  editProdId.value = null
  prodForm.value   = { Code: '', ColorName: '', SizeName: '', LivePrice: '', VariantID: null, ProductName: '' }
  variantSearch.value  = ''
  variantResults.value = []
  prodErr.value = ''
  _prodModal = _prodModal || new Modal(document.getElementById('prodModal'))
  _prodModal.show()
}

function openEditProduct(p) {
  editProdId.value = p.ID
  prodForm.value   = {
    Code:        p.Code,
    ColorName:   p.ColorName,
    SizeName:    p.SizeName,
    LivePrice:   String(p.LivePrice),
    VariantID:   p.VariantID,
    ProductName: p.ProductName,
  }
  variantSearch.value  = `${p.ProductName} ${p.ColorName} ${p.SizeName}`
  variantResults.value = []
  prodErr.value = ''
  _prodModal = _prodModal || new Modal(document.getElementById('prodModal'))
  _prodModal.show()
}

// Variant 搜尋（兩步：先查商品名，再查 variants）
function onVariantInput() {
  clearTimeout(_variantTimer)
  if (!variantSearch.value.trim()) { variantResults.value = []; return }
  _variantTimer = setTimeout(doVariantSearch, 300)
}

async function doVariantSearch() {
  variantLoading.value = true
  variantResults.value = []

  const { data: prods } = await db
    .from('C_PRD_ProductList')
    .select('ID, ProductName')
    .ilike('ProductName', `%${variantSearch.value.trim()}%`)
    .limit(10)

  if (!prods?.length) { variantLoading.value = false; return }

  const productIds = prods.map(p => p.ID)

  const [{ data: variants }, { data: allColors }, { data: allSizes }] = await Promise.all([
    db.from('C_PRD_ProductVariantList').select('ID, ProductID, ColorID, SizeID, StockQty').in('ProductID', productIds),
    db.from('S_PRD_ColorList').select('ID, Name'),
    db.from('S_PRD_SizeList').select('ID, Name'),
  ])

  const prodMap  = Object.fromEntries((prods      || []).map(p => [p.ID, p.ProductName]))
  const colorMap = Object.fromEntries((allColors  || []).map(c => [c.ID, c.Name]))
  const sizeMap  = Object.fromEntries((allSizes   || []).map(s => [s.ID, s.Name]))

  variantResults.value = (variants || []).map(v => ({
    ID:          v.ID,
    StockQty:    v.StockQty,
    ProductName: prodMap[v.ProductID]  || '',
    ColorName:   colorMap[v.ColorID]   || '',
    SizeName:    sizeMap[v.SizeID]     || '',
  }))

  variantLoading.value = false
}

function selectVariant(v) {
  prodForm.value.VariantID   = v.ID
  prodForm.value.ProductName = v.ProductName
  if (!prodForm.value.ColorName) prodForm.value.ColorName = v.ColorName
  if (!prodForm.value.SizeName)  prodForm.value.SizeName  = v.SizeName
  variantSearch.value  = `${v.ProductName} ${v.ColorName} ${v.SizeName}`
  variantResults.value = []
}

async function saveProduct() {
  const { Code, ColorName, SizeName, LivePrice, VariantID, ProductName } = prodForm.value
  if (!Code.trim() || !ColorName.trim() || !SizeName.trim() || !LivePrice || !VariantID) {
    prodErr.value = '請填寫所有欄位，並從搜尋結果中選擇商品規格'
    return
  }
  prodSaving.value = true
  prodErr.value    = ''

  const payload = {
    SessionID:   sessionId,
    Code:        Code.trim().toUpperCase(),
    ColorName:   ColorName.trim(),
    SizeName:    SizeName.trim().toUpperCase(),
    LivePrice:   Number(LivePrice),
    VariantID:   Number(VariantID),
    ProductName: ProductName.trim(),
  }

  const { error } = editProdId.value
    ? await db.from('C_LIV_ProductList').update(payload).eq('ID', editProdId.value)
    : await db.from('C_LIV_ProductList').insert(payload)

  prodSaving.value = false
  if (error) { prodErr.value = error.message; return }
  _prodModal.hide()
  await loadProducts()
}

async function deleteProduct(id) {
  if (!confirm('確定要刪除這筆商品對照？')) return
  await db.from('C_LIV_ProductList').delete().eq('ID', id)
  await loadProducts()
}

// ═══════════════════════════════════════════════════════════
// 留言解析（客戶端）
// ═══════════════════════════════════════════════════════════
const productMap = computed(() => {
  const m = new Map()
  for (const p of products.value) {
    m.set(`${p.Code.toUpperCase()}|${p.ColorName}|${p.SizeName.toUpperCase()}`, p)
  }
  return m
})

const NOISE_RE = [
  /^頭號粉絲/,
  /^\d+(天|小時|分鐘|秒)/,
  /^·?\s*\d+(天|小時)/,
]
const PRODUCT_RE = /^([A-Za-z]+\d+)([一-鿿]+)([A-Za-z]+)\+(\d+)$/

function parseRawText() {
  parseError.value        = ''
  importDone.value        = false
  importResults.value     = []
  skippedMultiBlocks.value = []

  if (!rawText.value.trim()) { parseError.value = '請先貼上留言文字'; return }
  if (!products.value.length) { parseError.value = '請先在「商品對照表」建立商品對應'; return }

  // ── Step 1：過濾雜訊（時間戳、頭號粉絲、作者回覆） ──────
  const rawLines = rawText.value.split('\n').map(l => l.trim())
  const cleanLines = []
  let skipNext = false

  for (const line of rawLines) {
    if (skipNext) { skipNext = false; continue }   // 跳過作者名稱行（品牌名）
    if (line === '作者') { skipNext = true; continue } // 小編回覆標記
    if (!line) continue
    if (NOISE_RE.some(re => re.test(line))) continue
    cleanLines.push(line)
  }

  // ── Step 2：將乾淨行分組成留言 block [{name, products[]}] ──
  const blocks = []
  let currentBlock = null

  for (const line of cleanLines) {
    if (PRODUCT_RE.test(line)) {
      if (!currentBlock) {
        currentBlock = { name: null, products: [] }
        blocks.push(currentBlock)
      }
      currentBlock.products.push(line)
    } else {
      currentBlock = { name: line, products: [] }
      blocks.push(currentBlock)
    }
  }

  // ── Step 3：倒序 → 舊留言（貼上後在底部）優先扣庫存 ─────
  blocks.reverse()

  // ── Step 4：篩選 block，超過 1 筆商品 → 整個跳過 ─────────
  const parsed = []
  const skipped = []

  for (const block of blocks) {
    if (block.products.length === 0) continue
    if (block.products.length > 1) {
      skipped.push(block)
      continue
    }
    const line = block.products[0]
    const m = line.match(PRODUCT_RE)
    if (!m) continue
    const [, code, colorName, sizeName, qtyStr] = m
    const key = `${code.toUpperCase()}|${colorName}|${sizeName.toUpperCase()}`
    parsed.push({
      _id:         Math.random().toString(36).slice(2),
      fbName:      block.name,
      rawLine:     line,
      code:        code.toUpperCase(),
      colorName,
      sizeName:    sizeName.toUpperCase(),
      qty:         Number(qtyStr),
      livProduct:  productMap.value.get(key) ?? null,
      selected:    true,
      isDuplicate: false,
    })
  }

  skippedMultiBlocks.value = skipped

  if (!parsed.length && !skipped.length) {
    parseError.value = '未解析到任何商品留言，請確認格式（名字一行、商品代碼一行，例：Y77藍L+1）'
    return
  }

  // ── Step 5：標記跨留言重複（同人同代碼留了兩次）─────────
  const cnt = {}
  for (const item of parsed) {
    const k = `${item.fbName}|${item.code}`
    cnt[k] = (cnt[k] || 0) + 1
  }
  for (const item of parsed) {
    item.isDuplicate = (cnt[`${item.fbName}|${item.code}`] || 0) > 1
  }

  parsedItems.value = parsed
}

// ═══════════════════════════════════════════════════════════
// 建單（呼叫 live-import）
// ═══════════════════════════════════════════════════════════
const selectedItems = computed(() =>
  parsedItems.value.filter(i => i.selected && i.livProduct && i.fbName)
)

async function confirmImport() {
  if (!selectedItems.value.length) {
    parseError.value = '沒有可建單的項目'
    return
  }
  if (!confirm(`確認對 ${selectedItems.value.length} 筆留言建立訂單？此操作無法復原。`)) return

  importing.value = true
  parseError.value = ''

  try {
    const { data: { session: authSess } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSess?.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          items: selectedItems.value.map(i => ({
            livProductId: i.livProduct.ID,
            fbName:       i.fbName,
            qty:          i.qty,
          })),
        }),
      }
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '建單失敗')
    importResults.value = json.results || []
    importDone.value    = true
    parsedItems.value   = []
    rawText.value       = ''
  } catch (e) {
    parseError.value = String(e)
  } finally {
    importing.value = false
  }
}

// 建單結果 label
const RESULT_STATUS = {
  success:   { label: '✅ 建單成功', cls: 'text-success' },
  no_stock:  { label: '❌ 庫存不足', cls: 'text-danger' },
  no_member: { label: '⚠️ 找不到會員', cls: 'text-warning fw-semibold' },
  error:     { label: '❌ 錯誤', cls: 'text-danger' },
}

onMounted(async () => {
  await loadSession()
  await loadProducts()
})
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <nav style="font-size:12px; color:#a08060; margin-bottom:12px;">
      <button class="btn btn-link p-0" style="font-size:12px; color:#a08060;" @click="router.push('/admin/live')">
        直播場次
      </button>
      <span class="mx-1">›</span>
      <span>{{ session?.Title || '載入中...' }}</span>
    </nav>

    <div v-if="loadingSession" class="text-center py-5" style="color:#a08060;">載入中...</div>
    <p v-else-if="sessionErr" class="alert alert-danger">{{ sessionErr }}</p>

    <template v-else-if="session">

      <!-- ── 場次資訊 ── -->
      <div class="card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span>場次資訊</span>
          <div v-if="!editMode">
            <button class="btn btn-sm btn-outline-primary" @click="startEditInfo">編輯</button>
          </div>
          <div v-else class="d-flex gap-2">
            <button class="btn btn-sm btn-secondary" @click="editMode = false">取消</button>
            <button class="btn btn-sm btn-primary" :disabled="savingInfo" @click="saveInfo">
              {{ savingInfo ? '儲存中...' : '儲存' }}
            </button>
          </div>
        </div>
        <div class="card-body">
          <!-- 唯讀 -->
          <template v-if="!editMode">
            <div class="row g-2" style="font-size:13.5px;">
              <div class="col-sm-6">
                <span style="color:#a08060;">名稱：</span>
                <strong style="color:#3d2e1e;">{{ session.Title }}</strong>
              </div>
              <div class="col-sm-3">
                <span style="color:#a08060;">直播日期：</span>{{ session.LiveDate || '–' }}
              </div>
              <div class="col-sm-3">
                <span style="color:#a08060;">狀態：</span>
                <span class="badge" :class="STATUS_CLS[session.Status]">
                  {{ STATUS_LABEL[session.Status] || session.Status }}
                </span>
              </div>
              <div v-if="session.Notes" class="col-12" style="color:#6b5040;">
                {{ session.Notes }}
              </div>
            </div>
          </template>
          <!-- 編輯 -->
          <template v-else>
            <div class="row g-3">
              <div class="col-sm-6">
                <label class="form-label">場次名稱</label>
                <input v-model="editForm.Title" class="form-control" />
              </div>
              <div class="col-sm-3">
                <label class="form-label">直播日期</label>
                <input v-model="editForm.LiveDate" type="date" class="form-control" />
              </div>
              <div class="col-sm-3">
                <label class="form-label">狀態</label>
                <select v-model="editForm.Status" class="form-select">
                  <option value="planned">籌備中</option>
                  <option value="active">直播中</option>
                  <option value="closed">已結束</option>
                </select>
              </div>
              <div class="col-12">
                <label class="form-label">備注</label>
                <textarea v-model="editForm.Notes" class="form-control" rows="2"></textarea>
              </div>
              <div v-if="saveInfoErr" class="col-12">
                <p class="text-danger mb-0" style="font-size:12px;">{{ saveInfoErr }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ── Tabs ── -->
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'products' }"
            @click="activeTab = 'products'"
          >
            商品對照表
            <span class="badge bg-secondary ms-1" style="font-size:10px;">{{ products.length }}</span>
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'import' }"
            @click="activeTab = 'import'"
          >
            留言匯入
          </button>
        </li>
      </ul>

      <!-- ════ Tab 1：商品對照表 ════ -->
      <div v-show="activeTab === 'products'">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <p class="mb-0" style="font-size:12.5px; color:#a08060;">
            留言格式：<code>代碼顏色尺寸+數量</code>，例：<code>Y77藍L+1</code>（代碼 Y77、顏色 藍、尺寸 L、數量 1）
          </p>
          <button class="btn btn-primary btn-sm" @click="openAddProduct">＋ 新增商品</button>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>代碼</th>
                  <th>顏色</th>
                  <th>尺寸</th>
                  <th>商品名稱</th>
                  <th style="white-space:nowrap;">直播特價</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loadingProd">
                  <td colspan="6" class="text-center py-3" style="color:#a08060;">載入中...</td>
                </tr>
                <tr v-else-if="!products.length">
                  <td colspan="6" class="text-center py-3" style="color:#a08060;">尚未建立商品對照，請點右上角「新增商品」</td>
                </tr>
                <tr v-for="p in products" :key="p.ID">
                  <td><code style="font-size:13px;">{{ p.Code }}</code></td>
                  <td>{{ p.ColorName }}</td>
                  <td>{{ p.SizeName }}</td>
                  <td>{{ p.ProductName }}</td>
                  <td>NT${{ p.LivePrice.toLocaleString() }}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-secondary me-1" @click="openEditProduct(p)">編輯</button>
                    <button class="btn btn-sm btn-outline-danger" @click="deleteProduct(p.ID)">刪除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ════ Tab 2：留言匯入 ════ -->
      <div v-show="activeTab === 'import'">

        <!-- 建單完成結果 -->
        <template v-if="importDone">
          <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span>
                建單結果
                <span class="badge bg-success ms-1">成功 {{ importResults.filter(r => r.status === 'success').length }}</span>
                <span v-if="importResults.some(r => r.status !== 'success')" class="badge bg-danger ms-1">
                  失敗 {{ importResults.filter(r => r.status !== 'success').length }}
                </span>
              </span>
              <button class="btn btn-sm btn-outline-secondary" @click="importDone = false">
                繼續匯入
              </button>
            </div>
            <div class="table-responsive">
              <table class="table mb-0" style="font-size:13px;">
                <thead>
                  <tr>
                    <th>留言者</th>
                    <th>商品</th>
                    <th>狀態</th>
                    <th>訂單編號</th>
                    <th>LINE 通知</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in importResults" :key="i">
                    <td>{{ r.fbName }}</td>
                    <td>{{ r.productName }}</td>
                    <td :class="RESULT_STATUS[r.status]?.cls || ''">
                      {{ RESULT_STATUS[r.status]?.label || r.status }}
                      <span v-if="r.reason" style="font-size:11px; opacity:0.75;"> — {{ r.reason }}</span>
                    </td>
                    <td style="font-size:11px; font-family:monospace;">{{ r.orderNo || '–' }}</td>
                    <td style="font-size:12px;">
                      <span v-if="r.lineNotified">✅ 已發送</span>
                      <span v-else-if="r.status === 'success'" style="color:#c0921a;">⚠️ 未綁定</span>
                      <span v-else style="color:#aaa;">–</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 未通知名單 -->
            <div
              v-if="importResults.some(r => r.status === 'success' && !r.lineNotified)"
              class="card-footer"
              style="font-size:12px; color:#7a5c20; background:#fdf3e3;"
            >
              ⚠️ 以下客人尚未綁定 LINE，需小編手動聯絡：
              <ul class="mb-0 mt-1">
                <li
                  v-for="r in importResults.filter(r => r.status === 'success' && !r.lineNotified)"
                  :key="r.orderNo"
                >
                  {{ r.fbName }} — 訂單 {{ r.orderNo }}
                </li>
              </ul>
            </div>

            <!-- 找不到會員 -->
            <div
              v-if="importResults.some(r => r.status === 'no_member')"
              class="card-footer"
              style="font-size:12px; color:#7a0000; background:#fff0f0;"
            >
              ❌ 以下留言找不到對應會員（FbName 未在官網帳號中），需手動建單：
              <ul class="mb-0 mt-1">
                <li
                  v-for="r in importResults.filter(r => r.status === 'no_member')"
                  :key="r.fbName + r.productName"
                >
                  {{ r.fbName }} — {{ r.productName }}
                </li>
              </ul>
            </div>
          </div>
        </template>

        <!-- 匯入工具 -->
        <template v-else>
          <!-- 貼文字 -->
          <div class="card mb-3">
            <div class="card-header">① 貼上 FB 留言文字</div>
            <div class="card-body">
              <textarea
                v-model="rawText"
                class="form-control"
                rows="12"
                placeholder="從 FB 貼文底下複製全部留言文字，貼到這裡。系統會自動過濾雜訊（頭號粉絲、時間戳記等）。&#10;&#10;格式範例：&#10;頭號粉絲&#10;楊筱婷&#10;Y77藍L+1&#10;頭號粉絲&#10;李美麗&#10;A42黃F+2"
                style="font-family: monospace; font-size: 13px; line-height:1.7;"
              ></textarea>
              <div class="d-flex justify-content-between align-items-center mt-2">
                <p v-if="parseError" class="text-danger mb-0" style="font-size:13px;">{{ parseError }}</p>
                <span v-else></span>
                <button class="btn btn-outline-primary btn-sm" @click="parseRawText">解析留言 →</button>
              </div>
            </div>
          </div>

          <!-- 多筆商品被跳過的警告 -->
          <div
            v-if="skippedMultiBlocks.length"
            class="alert mb-3 py-2 px-3"
            style="font-size:12.5px; background:#fff8e1; border:1px solid #f0c040; color:#7a5c00;"
          >
            <strong>⚠️ 以下留言因一則留言含多筆商品，已整個跳過（請通知客人重新補留）：</strong>
            <ul class="mb-0 mt-1">
              <li v-for="(b, i) in skippedMultiBlocks" :key="i">
                <strong>{{ b.name || '（無名字）' }}</strong>：{{ b.products.join('、') }}
              </li>
            </ul>
          </div>

          <!-- 解析預覽 -->
          <div v-if="parsedItems.length" class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span>
                ② 確認解析結果
                <span class="badge bg-secondary ms-1">{{ parsedItems.length }} 筆</span>
                <span
                  v-if="parsedItems.some(i => i.isDuplicate)"
                  class="badge ms-1"
                  style="background:#c0921a;"
                >
                  ⚠️ 有重複留言，請確認
                </span>
              </span>
              <button
                class="btn btn-primary btn-sm"
                :disabled="importing || !selectedItems.length"
                @click="confirmImport"
              >
                {{ importing ? '建單中...' : `確認建單（${selectedItems.length} 筆）` }}
              </button>
            </div>
            <div class="table-responsive">
              <table class="table mb-0" style="font-size:13px;">
                <thead>
                  <tr>
                    <th style="width:36px;"></th>
                    <th>留言者（FbName）</th>
                    <th>留言內容</th>
                    <th>對應商品</th>
                    <th>數量</th>
                    <th>直播價</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in parsedItems"
                    :key="item._id"
                    :style="item.isDuplicate ? 'background:rgba(192,146,26,0.07);' : ''"
                  >
                    <td>
                      <input
                        type="checkbox"
                        v-model="item.selected"
                        :disabled="!item.livProduct || !item.fbName"
                      />
                    </td>
                    <td>
                      <span v-if="item.fbName">{{ item.fbName }}</span>
                      <em v-else style="color:#dc3545; font-size:12px;">（沒有名字）</em>
                    </td>
                    <td><code style="font-size:12px;">{{ item.rawLine }}</code></td>
                    <td>
                      <span v-if="item.livProduct">
                        {{ item.livProduct.ProductName }}
                        {{ item.colorName }} {{ item.sizeName }}
                      </span>
                      <span v-else style="color:#dc3545; font-size:12px;">
                        ❌ 「{{ item.code }}{{ item.colorName }}{{ item.sizeName }}」未對應
                      </span>
                    </td>
                    <td>{{ item.qty }}</td>
                    <td>
                      <span v-if="item.livProduct">
                        NT${{ item.livProduct.LivePrice.toLocaleString() }}
                      </span>
                      <span v-else style="color:#aaa;">–</span>
                    </td>
                    <td>
                      <span v-if="item.isDuplicate" class="badge" style="background:#c0921a;">⚠️ 重複</span>
                      <span v-else-if="!item.fbName" class="badge bg-danger" style="font-size:10px;">無名字</span>
                      <span v-else-if="!item.livProduct" class="badge bg-danger" style="font-size:10px;">未對應</span>
                      <span v-else class="badge bg-success" style="font-size:10px;">✓</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="card-footer" style="font-size:12px; color:#a08060;">
              勾選 ✓ 的項目才會建單。處理順序：舊留言優先（先留先得）。⚠️ 重複代表同一人留了多次相同商品，請確認後再建單。❌ 項目請先修改商品對照表。
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- ════ 商品對照 Modal ════ -->
    <div class="modal fade" id="prodModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ editProdId ? '編輯商品對照' : '新增商品對照' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">

              <!-- 搜尋商品規格 -->
              <div class="col-12">
                <label class="form-label">搜尋商品規格 <span class="text-danger">*</span></label>
                <input
                  v-model="variantSearch"
                  class="form-control"
                  placeholder="輸入商品名稱搜尋，例：白色鬆緊"
                  @input="onVariantInput"
                />
                <div v-if="variantLoading" style="font-size:12px; color:#a08060; margin-top:4px;">搜尋中...</div>
                <!-- 搜尋結果 dropdown -->
                <div
                  v-if="variantResults.length"
                  class="border rounded mt-1"
                  style="max-height:200px; overflow-y:auto; background:#fff; position:relative; z-index:10;"
                >
                  <div
                    v-for="v in variantResults"
                    :key="v.ID"
                    class="px-3 py-2"
                    style="cursor:pointer; font-size:13px; border-bottom:1px solid #f0e8dc; transition:background 0.12s;"
                    @mouseenter="$event.currentTarget.style.background='#fdf5eb'"
                    @mouseleave="$event.currentTarget.style.background=''"
                    @click="selectVariant(v)"
                  >
                    {{ v.ProductName }} {{ v.ColorName }} {{ v.SizeName }}
                    <span style="color:#a08060; font-size:11px; margin-left:6px;">庫存 {{ v.StockQty }}</span>
                  </div>
                </div>
                <!-- 已選 -->
                <div v-if="prodForm.VariantID" class="mt-1" style="font-size:12px; color:#3d8a4e;">
                  ✓ 已選擇：{{ prodForm.ProductName }} {{ prodForm.ColorName }} {{ prodForm.SizeName }}
                </div>
              </div>

              <!-- 代碼 -->
              <div class="col-sm-4">
                <label class="form-label">留言代碼 <span class="text-danger">*</span></label>
                <input
                  v-model="prodForm.Code"
                  class="form-control"
                  placeholder="例：Y77"
                  style="text-transform:uppercase;"
                />
                <div class="form-text">客人留言時用的英數代碼</div>
              </div>

              <!-- 顏色 -->
              <div class="col-sm-4">
                <label class="form-label">顏色名稱 <span class="text-danger">*</span></label>
                <input v-model="prodForm.ColorName" class="form-control" placeholder="例：藍" />
                <div class="form-text">留言中的中文顏色字（會自動比對）</div>
              </div>

              <!-- 尺寸 -->
              <div class="col-sm-4">
                <label class="form-label">尺寸 <span class="text-danger">*</span></label>
                <input
                  v-model="prodForm.SizeName"
                  class="form-control"
                  placeholder="例：L"
                  style="text-transform:uppercase;"
                />
                <div class="form-text">留言中的英文尺寸</div>
              </div>

              <!-- 直播特價 -->
              <div class="col-sm-4">
                <label class="form-label">直播特價（NT$）<span class="text-danger">*</span></label>
                <input v-model="prodForm.LivePrice" type="number" min="0" class="form-control" placeholder="例：890" />
              </div>
            </div>

            <p v-if="prodErr" class="text-danger mt-3 mb-0" style="font-size:13px;">{{ prodErr }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">取消</button>
            <button class="btn btn-primary btn-sm" :disabled="prodSaving" @click="saveProduct">
              {{ prodSaving ? '儲存中...' : '儲存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
