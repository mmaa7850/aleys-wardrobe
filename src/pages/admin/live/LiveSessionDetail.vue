<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

// 商品瀏覽器（Modal 內）
const browseProducts        = ref([])
const browseLoading         = ref(false)
const browseImageMap        = ref({})      // productId → storagePath
const categoryList          = ref([])
const categoryFilter        = ref('')
const productSearchText     = ref('')
const selectedBrowseProduct = ref(null)
const browseVariants        = ref([])
const browseVariantsLoading = ref(false)
let _browseTimer = null

// ── Tab ───────────────────────────────────────────────────
const activeTab = ref('products')

// ── 直播監控（FB 即時搶標）────────────────────────────────
const fbPages        = ref([])          // 管理的粉專列表
const selPageIdx     = ref(0)           // 選中的粉專 index
const pageToken      = ref('')          // Page Access Token
const fbPageId       = ref('')          // Page ID
const videoId        = ref('')          // Live Video ID
const detectingVideo = ref(false)
const monitorStatus  = ref('idle')      // idle | connecting | live | error
const monitorError   = ref('')
const nextSince      = ref(null)
const activeLiveBids  = ref([])          // 目前開標中的商品
const recentOrders    = ref([])          // 最近入單記錄（最新 50 筆）
const startingBidCode = ref('')          // 正在起標中的商品代碼（loading 狀態用）
let   _pollTimer      = null

// 連接 FB：用 provider_token 取粉專列表
async function connectFb() {
  monitorError.value = ''
  monitorStatus.value = 'connecting'
  try {
    const { data: { session: authSess } } = await supabase.auth.getSession()
    const userToken = authSess?.provider_token
    if (!userToken) {
      monitorError.value = '找不到 FB Token，請重新以 Facebook 登入（需授權粉專管理權限）'
      monitorStatus.value = 'error'
      return
    }
    const res  = await fetch(`https://graph.facebook.com/me/accounts?access_token=${userToken}&fields=id,name,access_token`)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    fbPages.value   = data.data ?? []
    if (!fbPages.value.length) {
      monitorError.value = '此帳號沒有管理任何粉絲專頁'
      monitorStatus.value = 'error'
      return
    }
    selectPage(0)
    monitorStatus.value = 'idle'
  } catch (e) {
    monitorError.value = String(e)
    monitorStatus.value = 'error'
  }
}

function selectPage(idx) {
  selPageIdx.value = idx
  const page = fbPages.value[idx]
  if (page) {
    pageToken.value = page.access_token
    fbPageId.value  = page.id
    videoId.value   = session.value?.FbLiveVideoId ?? ''
  }
}

// 自動偵測目前直播影片
async function detectVideo() {
  if (!pageToken.value || !fbPageId.value) return
  detectingVideo.value = true
  monitorError.value   = ''
  try {
    const res  = await fetch(`https://graph.facebook.com/${fbPageId.value}/live_videos?status=LIVE&fields=id,title&access_token=${pageToken.value}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    const live = data.data?.[0]
    if (!live) { monitorError.value = '目前沒有進行中的直播'; return }
    videoId.value = live.id
  } catch (e) {
    monitorError.value = String(e)
  } finally {
    detectingVideo.value = false
  }
}

// 開始監控
async function startMonitoring() {
  if (!pageToken.value || !fbPageId.value || !videoId.value) {
    monitorError.value = '請先連接 FB 並確認直播影片 ID'
    return
  }
  monitorError.value = ''
  monitorStatus.value = 'live'
  nextSince.value = null

  // 儲存 FbPageId + FbLiveVideoId 到場次
  await db.from('C_LIV_SessionList').update({
    FbPageId:      fbPageId.value,
    FbLiveVideoId: videoId.value,
  }).eq('ID', sessionId)

  // 立即執行一次，之後每 8 秒輪詢
  await pollOnce()
  _pollTimer = setInterval(pollOnce, 8000)
}

function stopMonitoring() {
  clearInterval(_pollTimer)
  _pollTimer = null
  monitorStatus.value = 'idle'
}

async function pollOnce() {
  try {
    const { data: { session: authSess } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-bid-poll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSess?.access_token}`,
        },
        body: JSON.stringify({
          action:           'poll',
          sessionId,
          pageAccessToken:  pageToken.value,
          liveVideoId:      videoId.value,
          pageId:           fbPageId.value,
          since:            nextSince.value,
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)

    nextSince.value = data.nextSince

    // 更新開標中商品
    for (const bid of (data.newActiveBids ?? [])) {
      if (!activeLiveBids.value.find(b => b.Code === bid.Code)) {
        activeLiveBids.value.push(bid)
      }
    }
    for (const closed of (data.closedBids ?? [])) {
      activeLiveBids.value = activeLiveBids.value.filter(b => b.Code !== closed.code)
    }

    // 新增入單記錄（最多保留 100 筆）
    for (const order of (data.orders ?? [])) {
      recentOrders.value.unshift({ ...order, ts: new Date().toLocaleTimeString('zh-TW') })
    }
    if (recentOrders.value.length > 100) recentOrders.value.splice(100)

  } catch (e) {
    if (import.meta.env.DEV) console.error('[pollOnce]', e)
    monitorError.value = `輪詢失敗：${String(e)}`
  }
}

// 手動截標
async function manualCloseBid(bid) {
  if (!confirm(`確定手動截標「${bid.Code} ${bid.ProductName ?? ''}」？系統會自動在 FB 發送結標線與結標公告。`)) return
  try {
    const { data: { session: authSess } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-bid-poll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSess?.access_token}`,
        },
        body: JSON.stringify({
          action:          'manual_close',
          sessionId,
          pageAccessToken: pageToken.value,
          liveVideoId:     videoId.value,
          pageId:          fbPageId.value,
          code:            bid.Code,
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    activeLiveBids.value = activeLiveBids.value.filter(b => b.Code !== bid.Code)
    recentOrders.value.unshift({ code: bid.Code, status: 'closed_manual', ts: new Date().toLocaleTimeString('zh-TW') })
  } catch (e) {
    alert(`截標失敗：${String(e)}`)
  }
}

// 起標（從商品表直接點按鈕，由系統在 FB 發出起標線）
function isFirstOfCode(code, idx) {
  return products.value.findIndex(p => p.Code === code) === idx
}

async function startBid(code, productName) {
  if (monitorStatus.value !== 'live') {
    alert('請先在「直播監控」Tab 開始監控，才能使用起標功能')
    return
  }
  if (!confirm(`確定對「${code} ${productName}」起標？系統將在 FB 直播留言發出起標線。`)) return
  startingBidCode.value = code
  try {
    const { data: { session: authSess } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-bid-poll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSess?.access_token}`,
        },
        body: JSON.stringify({
          action:          'start_bid',
          sessionId,
          pageAccessToken: pageToken.value,
          liveVideoId:     videoId.value,
          pageId:          fbPageId.value,
          code,
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    if (!activeLiveBids.value.find(b => b.Code === data.bid.Code)) {
      activeLiveBids.value.push(data.bid)
    }
  } catch (e) {
    alert(`起標失敗：${String(e)}`)
  } finally {
    startingBidCode.value = ''
  }
}

// 入單狀態顯示
const ORDER_STATUS = {
  success:      { label: '✅ 建單成功', cls: 'text-success' },
  no_stock:     { label: '❌ 庫存不足', cls: 'text-danger'  },
  no_member:    { label: '⚠️ 找不到會員', cls: 'text-warning fw-semibold' },
  blocked:      { label: '🚫 會員已封鎖', cls: 'text-danger fw-semibold'  },
  error:        { label: '❌ 錯誤', cls: 'text-danger'      },
  closed_manual:{ label: '🔒 手動截標', cls: 'text-muted'   },
}

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
      Title:     editForm.value.Title,
      LiveDate:  editForm.value.LiveDate || null,
      Status:    editForm.value.Status,
      Notes:     editForm.value.Notes || null,
      YtVideoId: editForm.value.YtVideoId?.trim() || null,
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
  editProdId.value            = null
  prodForm.value              = { Code: '', ColorName: '', SizeName: '', LivePrice: '', VariantID: null, ProductName: '' }
  selectedBrowseProduct.value = null
  browseVariants.value        = []
  productSearchText.value     = ''
  categoryFilter.value        = ''
  prodErr.value               = ''
  browseProductList()
  _prodModal = _prodModal || new Modal(document.getElementById('prodModal'))
  _prodModal.show()
}

async function openEditProduct(p) {
  editProdId.value = p.ID
  prodForm.value   = {
    Code:        p.Code,
    ColorName:   p.ColorName,
    SizeName:    p.SizeName,
    LivePrice:   String(p.LivePrice),
    VariantID:   p.VariantID,
    ProductName: p.ProductName,
  }
  selectedBrowseProduct.value = null
  browseVariants.value        = []
  productSearchText.value     = ''
  categoryFilter.value        = ''
  prodErr.value               = ''

  // 從 VariantID 反查 ProductID，再載入商品 + 規格
  const { data: variant } = await db
    .from('C_PRD_ProductVariantList')
    .select('ProductID')
    .eq('ID', p.VariantID)
    .single()

  await browseProductList()

  if (variant?.ProductID) {
    let prod = browseProducts.value.find(pr => pr.ID === variant.ProductID)
    if (!prod) {
      // 商品不在目前清單（例如未上架）→ 直接查
      const { data: directProd } = await db
        .from('C_PRD_ProductList')
        .select('ID, ProductName, Category, IsActive, LiveCode')
        .eq('ID', variant.ProductID)
        .single()
      prod = directProd
    }
    if (prod) await loadVariantsForProduct(prod, true)  // true = 保留已選 VariantID
  }

  _prodModal = _prodModal || new Modal(document.getElementById('prodModal'))
  _prodModal.show()
}

// ── 商品瀏覽器函式 ───────────────────────────────────────
async function loadCategories() {
  const { data } = await db.from('S_PRD_CategoryList').select('ID, Name').order('Name')
  categoryList.value = data || []
}

function onBrowseInput() {
  clearTimeout(_browseTimer)
  _browseTimer = setTimeout(browseProductList, 300)
}

async function browseProductList() {
  browseLoading.value  = true
  browseProducts.value = []

  let query = db
    .from('C_PRD_ProductList')
    .select('ID, ProductName, Category, IsActive, LiveCode')
    .eq('IsActive', true)
    .order('UpdatedDate', { ascending: false })
    .limit(30)

  if (productSearchText.value.trim())
    query = query.ilike('ProductName', `%${productSearchText.value.trim()}%`)
  if (categoryFilter.value)
    query = query.eq('Category', categoryFilter.value)

  const { data: prods } = await query
  browseProducts.value = prods || []

  // 批次取主圖
  if (prods?.length) {
    const ids = prods.map(p => p.ID)
    const { data: pics } = await db
      .from('C_PRD_ProductPictureList')
      .select('ProductID, StoragePath')
      .in('ProductID', ids)
      .eq('IsMain', true)
    const map = {}
    for (const pic of pics || []) {
      if (!map[pic.ProductID]) map[pic.ProductID] = pic.StoragePath
    }
    browseImageMap.value = map
  }

  browseLoading.value = false
}

function getImageUrl(path) {
  if (!path) return null
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-pictures/${path}`
}

async function loadVariantsForProduct(prod, keepVariant = false) {
  selectedBrowseProduct.value = prod
  prodForm.value.ProductName  = prod.ProductName
  // 新增商品時自動帶入商品設定的直播代碼（編輯時保留既有代碼）
  if (!editProdId.value && prod.LiveCode) {
    prodForm.value.Code = prod.LiveCode.toUpperCase()
  }
  if (!keepVariant) {
    prodForm.value.VariantID  = null
    prodForm.value.ColorName  = ''
    prodForm.value.SizeName   = ''
  }
  browseVariantsLoading.value = true
  browseVariants.value        = []

  const [{ data: variants }, { data: colors }, { data: sizes }] = await Promise.all([
    db.from('C_PRD_ProductVariantList').select('ID, ColorID, SizeID, StockQty').eq('ProductID', prod.ID),
    db.from('S_PRD_ColorList').select('ID, Name'),
    db.from('S_PRD_SizeList').select('ID, Name'),
  ])

  const colorMap = Object.fromEntries((colors || []).map(c => [c.ID, c.Name]))
  const sizeMap  = Object.fromEntries((sizes  || []).map(s => [s.ID, s.Name]))

  browseVariants.value = (variants || []).map(v => ({
    ID:        v.ID,
    StockQty:  v.StockQty,
    ColorName: colorMap[v.ColorID] || '',
    SizeName:  sizeMap[v.SizeID]   || '',
  }))

  browseVariantsLoading.value = false
}

function selectVariant(v) {
  prodForm.value.VariantID = v.ID
  prodForm.value.ColorName = v.ColorName
  prodForm.value.SizeName  = v.SizeName
}

async function saveProduct() {
  const { Code, ColorName, SizeName, LivePrice, VariantID, ProductName } = prodForm.value
  if (!Code.trim() || !LivePrice || !VariantID) {
    prodErr.value = '請從商品列表選擇規格，並填寫留言代碼與直播特價'
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
// 一般格式：AA藍M+1；包色格式：AA包色M+1
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
    const codeU = code.toUpperCase()
    const sizeU = sizeName.toUpperCase()

    // ── 包色：展開為每個顏色各 1 件 ──────────────────────────
    if (colorName === '包色') {
      const bundleProds = products.value.filter(
        p => p.Code.toUpperCase() === codeU && p.SizeName.toUpperCase() === sizeU
      )
      for (const bp of bundleProds) {
        parsed.push({
          _id:         Math.random().toString(36).slice(2),
          fbName:      block.name,
          rawLine:     line,
          code:        codeU,
          colorName:   bp.ColorName,
          sizeName:    sizeU,
          qty:         1,
          livProduct:  bp,
          isBundle:    true,
          selected:    true,
          isDuplicate: false,
        })
      }
      // 找不到任何顏色 → 當作 null
      if (!bundleProds.length) {
        parsed.push({
          _id:         Math.random().toString(36).slice(2),
          fbName:      block.name,
          rawLine:     line,
          code:        codeU,
          colorName:   '包色',
          sizeName:    sizeU,
          qty:         Number(qtyStr),
          livProduct:  null,
          isBundle:    true,
          selected:    true,
          isDuplicate: false,
        })
      }
      continue
    }

    // ── 一般單色 ──────────────────────────────────────────────
    const key = `${codeU}|${colorName}|${sizeU}`
    parsed.push({
      _id:         Math.random().toString(36).slice(2),
      fbName:      block.name,
      rawLine:     line,
      code:        codeU,
      colorName,
      sizeName:    sizeU,
      qty:         Number(qtyStr),
      livProduct:  productMap.value.get(key) ?? null,
      isBundle:    false,
      selected:    true,
      isDuplicate: false,
    })
  }

  skippedMultiBlocks.value = skipped

  if (!parsed.length && !skipped.length) {
    parseError.value = '未解析到任何商品留言，請確認格式（名字一行、商品代碼一行，例：Y77藍L+1）'
    return
  }

  // ── Step 5：標記跨留言重複（同人同代碼+顏色+尺寸已出現過）
  const cnt = {}
  for (const item of parsed) {
    // 包色展開的各色視為不同 key，用 colorName 區分
    const k = `${item.fbName}|${item.code}|${item.colorName}|${item.sizeName}`
    cnt[k] = (cnt[k] || 0) + 1
  }
  for (const item of parsed) {
    const k = `${item.fbName}|${item.code}|${item.colorName}|${item.sizeName}`
    item.isDuplicate = (cnt[k] || 0) > 1
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
  blocked:   { label: '🚫 會員已封鎖', cls: 'text-danger fw-semibold' },
  error:     { label: '❌ 錯誤', cls: 'text-danger' },
}

onMounted(async () => {
  await loadSession()
  await loadProducts()
  await loadCategories()
  // 如果場次已儲存直播影片 ID，預先填入
  if (session.value?.FbLiveVideoId) videoId.value = session.value.FbLiveVideoId
})

onUnmounted(() => {
  stopMonitoring()
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
              <div v-if="session.YtVideoId" class="col-sm-6">
                <span style="color:#a08060;">YouTube 影片 ID：</span>
                <span class="font-monospace" style="font-size:12px;">{{ session.YtVideoId }}</span>
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
              <div class="col-sm-6">
                <label class="form-label">YouTube 影片 ID <span class="text-muted" style="font-size:11px;">（選填，如 dQw4w9WgXcQ）</span></label>
                <input v-model="editForm.YtVideoId" class="form-control font-monospace" placeholder="留空代表不嵌入直播" />
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
            <span class="badge bg-secondary ms-1" style="font-size:10px;">直播後</span>
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link d-flex align-items-center gap-1"
            :class="{ active: activeTab === 'live' }"
            @click="activeTab = 'live'"
          >
            直播監控
            <span v-if="monitorStatus === 'live'" class="badge bg-danger ms-1" style="font-size:10px; animation: pulse 1.5s infinite;">● 直播中</span>
            <span v-else class="badge bg-secondary ms-1" style="font-size:10px;">直播中用</span>
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
                <tr v-for="(p, pIdx) in products" :key="p.ID">
                  <td><code style="font-size:13px;">{{ p.Code }}</code></td>
                  <td>{{ p.ColorName }}</td>
                  <td>{{ p.SizeName }}</td>
                  <td>{{ p.ProductName }}</td>
                  <td>NT${{ p.LivePrice.toLocaleString() }}</td>
                  <td style="white-space:nowrap;">
                    <!-- 起標按鈕：每個 Code 只在第一列顯示 -->
                    <template v-if="isFirstOfCode(p.Code, pIdx)">
                      <span
                        v-if="activeLiveBids.find(b => b.Code === p.Code)"
                        class="badge bg-success me-1"
                        style="font-size:11px; vertical-align:middle;"
                      >● 開標中</span>
                      <button
                        v-else
                        class="btn btn-sm btn-outline-success me-1"
                        :disabled="monitorStatus !== 'live' || startingBidCode === p.Code"
                        :title="monitorStatus !== 'live' ? '請先在「直播監控」Tab 開始監控' : `起標 ${p.Code}`"
                        @click="startBid(p.Code, p.ProductName)"
                      >
                        {{ startingBidCode === p.Code ? '起標中...' : '▶ 起標' }}
                      </button>
                    </template>
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

      <!-- ════ Tab 3：直播監控 ════ -->
      <div v-show="activeTab === 'live'">

        <!-- ① FB 連接區 -->
        <div class="card mb-3">
          <div class="card-header d-flex align-items-center justify-content-between">
            <span>FB 連接設定</span>
            <button class="btn btn-sm btn-outline-primary" @click="connectFb" :disabled="monitorStatus === 'live'">
              {{ fbPages.length ? '重新連接' : '連接 FB 帳號' }}
            </button>
          </div>
          <div class="card-body">
            <div v-if="monitorError" class="alert alert-danger py-2 mb-3" style="font-size:13px;">{{ monitorError }}</div>

            <!-- 選擇粉專 -->
            <div v-if="fbPages.length" class="row g-3 align-items-end">
              <div class="col-sm-4">
                <label class="form-label" style="font-size:12px;">粉絲專頁</label>
                <select class="form-select form-select-sm" :value="selPageIdx" @change="selectPage(Number($event.target.value))" :disabled="monitorStatus === 'live'">
                  <option v-for="(p, i) in fbPages" :key="p.id" :value="i">{{ p.name }}</option>
                </select>
              </div>
              <div class="col-sm-5">
                <label class="form-label" style="font-size:12px;">直播影片 ID</label>
                <div class="input-group input-group-sm">
                  <input v-model="videoId" class="form-control" placeholder="自動偵測或手動貼上" :disabled="monitorStatus === 'live'" />
                  <button class="btn btn-outline-secondary" @click="detectVideo" :disabled="detectingVideo || monitorStatus === 'live'">
                    {{ detectingVideo ? '偵測中...' : '自動偵測' }}
                  </button>
                </div>
              </div>
              <div class="col-sm-3">
                <button
                  v-if="monitorStatus !== 'live'"
                  class="btn btn-success btn-sm w-100"
                  :disabled="!videoId"
                  @click="startMonitoring"
                >
                  ▶ 開始監控
                </button>
                <button v-else class="btn btn-danger btn-sm w-100" @click="stopMonitoring">
                  ■ 停止監控
                </button>
              </div>
            </div>

            <p v-if="!fbPages.length" class="text-muted mb-0" style="font-size:12.5px;">
              點「連接 FB 帳號」後選擇要監控的粉絲專頁，再輸入或自動偵測直播影片 ID。
            </p>
          </div>
        </div>

        <!-- 監控中才顯示以下區塊 -->
        <template v-if="monitorStatus === 'live' || activeLiveBids.length || recentOrders.length">

          <!-- ② 開標中商品 -->
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span style="font-size:13px; font-weight:600; color:#3d2e1e;">開標中商品</span>
              <span v-if="monitorStatus === 'live'" class="badge bg-danger" style="font-size:11px; animation: pulse 1.5s infinite;">● 輪詢中（每 8 秒）</span>
            </div>
            <div v-if="!activeLiveBids.length" class="text-muted" style="font-size:13px;">
              尚無開標中的商品。當系統偵測到粉專在直播中貼出「起標線」留言時，商品會自動出現在這裡。
            </div>
            <div v-for="bid in activeLiveBids" :key="bid.Code" class="card mb-2" style="border-left: 3px solid #28a745;">
              <div class="card-body py-2 d-flex align-items-center justify-content-between">
                <div>
                  <code style="font-size:16px; color:#3d2e1e;">{{ bid.Code }}</code>
                  <span class="ms-2 text-muted" style="font-size:13px;">{{ bid.ProductName }}</span>
                  <span class="badge bg-success ms-2" style="font-size:10px;">開標中</span>
                </div>
                <button class="btn btn-sm btn-outline-danger" @click="manualCloseBid(bid)" :disabled="monitorStatus !== 'live'">
                  手動截標
                </button>
              </div>
            </div>
          </div>

          <!-- ③ 即時入單記錄 -->
          <div class="card">
            <div class="card-header d-flex align-items-center justify-content-between">
              <span>即時入單記錄</span>
              <button class="btn btn-sm btn-outline-secondary" @click="recentOrders = []">清除</button>
            </div>
            <div v-if="!recentOrders.length" class="card-body text-muted" style="font-size:13px;">
              尚無入單紀錄
            </div>
            <div v-else class="table-responsive">
              <table class="table table-sm mb-0" style="font-size:13px;">
                <thead>
                  <tr>
                    <th style="width:80px;">時間</th>
                    <th style="width:60px;">代碼</th>
                    <th>FB 名稱</th>
                    <th>樣式</th>
                    <th>狀態</th>
                    <th>訂單號</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(o, i) in recentOrders" :key="i">
                    <td class="text-muted">{{ o.ts }}</td>
                    <td><code>{{ o.code }}</code></td>
                    <td>{{ o.fbName || '–' }}</td>
                    <td>{{ o.style || '–' }}</td>
                    <td :class="ORDER_STATUS[o.status]?.cls || 'text-muted'">
                      {{ ORDER_STATUS[o.status]?.label || o.status }}
                    </td>
                    <td style="font-size:11px; font-family:monospace;">{{ o.orderNo || '–' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </template>
      </div>

    </template>

    <!-- ════ 商品對照 Modal ════ -->
    <div class="modal fade" id="prodModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ editProdId ? '編輯商品對照' : '新增商品對照' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">

            <!-- ① 篩選列 -->
            <div class="row g-2 mb-2">
              <div class="col-sm-4">
                <select
                  v-model="categoryFilter"
                  class="form-select form-select-sm"
                  @change="browseProductList"
                >
                  <option value="">全部分類</option>
                  <option v-for="c in categoryList" :key="c.ID" :value="c.Name">{{ c.Name }}</option>
                </select>
              </div>
              <div class="col-sm-8">
                <input
                  v-model="productSearchText"
                  class="form-control form-control-sm"
                  placeholder="搜尋商品名稱..."
                  @input="onBrowseInput"
                />
              </div>
            </div>

            <!-- ② 商品列表 -->
            <div
              style="max-height:220px; overflow-y:auto; border:1px solid #e8ddd0; border-radius:6px;"
              class="mb-3"
            >
              <table class="table table-hover table-sm mb-0" style="font-size:13px;">
                <thead style="position:sticky; top:0; background:#faf7f4; z-index:1;">
                  <tr>
                    <th style="width:56px;">圖片</th>
                    <th>商品名稱</th>
                    <th style="width:100px;">分類</th>
                    <th style="width:40px;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="browseLoading">
                    <td colspan="4" class="text-center py-3" style="color:#a08060;">載入中...</td>
                  </tr>
                  <tr v-else-if="!browseProducts.length">
                    <td colspan="4" class="text-center py-3" style="color:#a08060;">找不到商品</td>
                  </tr>
                  <tr
                    v-for="p in browseProducts"
                    :key="p.ID"
                    style="cursor:pointer;"
                    :style="selectedBrowseProduct?.ID === p.ID ? 'background:#fdf5eb;' : ''"
                    @click="loadVariantsForProduct(p)"
                  >
                    <td>
                      <img
                        v-if="browseImageMap[p.ID]"
                        :src="getImageUrl(browseImageMap[p.ID])"
                        style="width:40px; height:40px; object-fit:cover; border-radius:4px;"
                      />
                      <div
                        v-else
                        style="width:40px; height:40px; background:#f0e8dc; border-radius:4px;"
                      ></div>
                    </td>
                    <td>{{ p.ProductName }}</td>
                    <td style="color:#a08060;">{{ p.Category || '–' }}</td>
                    <td class="text-center">
                      <span v-if="selectedBrowseProduct?.ID === p.ID" style="color:#c8a882; font-weight:600;">✓</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- ③ 規格列表（選完商品後顯示） -->
            <template v-if="selectedBrowseProduct">
              <div class="mb-1" style="font-size:13px; color:#a08060;">
                選擇規格：<strong style="color:#3d2e1e;">{{ selectedBrowseProduct.ProductName }}</strong>
              </div>
              <div
                style="max-height:160px; overflow-y:auto; border:1px solid #e8ddd0; border-radius:6px;"
                class="mb-3"
              >
                <table class="table table-hover table-sm mb-0" style="font-size:13px;">
                  <thead style="position:sticky; top:0; background:#faf7f4;">
                    <tr>
                      <th>顏色</th>
                      <th>尺寸</th>
                      <th>庫存</th>
                      <th style="width:40px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="browseVariantsLoading">
                      <td colspan="4" class="text-center py-2" style="color:#a08060;">載入中...</td>
                    </tr>
                    <tr v-else-if="!browseVariants.length">
                      <td colspan="4" class="text-center py-2" style="color:#a08060;">無可用規格</td>
                    </tr>
                    <tr
                      v-for="v in browseVariants"
                      :key="v.ID"
                      style="cursor:pointer;"
                      :style="prodForm.VariantID === v.ID ? 'background:#fdf5eb;' : ''"
                      @click="selectVariant(v)"
                    >
                      <td>{{ v.ColorName }}</td>
                      <td>{{ v.SizeName }}</td>
                      <td>{{ v.StockQty }}</td>
                      <td class="text-center">
                        <span v-if="prodForm.VariantID === v.ID" style="color:#c8a882; font-weight:600;">✓</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <!-- ④ 已選規格 banner + 代碼 & 特價（選完規格後顯示） -->
            <template v-if="prodForm.VariantID">
              <div class="mb-3 px-3 py-2 rounded" style="background:#fdf5eb; border:1px solid #e8c98a; font-size:13px;">
                ✓ 已選：<strong>{{ prodForm.ProductName }}</strong>
                　{{ prodForm.ColorName }} {{ prodForm.SizeName }}
              </div>
              <div class="row g-3">
                <div class="col-sm-6">
                  <label class="form-label">留言代碼 <span class="text-danger">*</span></label>
                  <input
                    v-model="prodForm.Code"
                    class="form-control"
                    placeholder="例：A1"
                    style="text-transform:uppercase;"
                  />
                  <div class="form-text">客人留言時用的英數代碼</div>
                </div>
                <div class="col-sm-6">
                  <label class="form-label">直播特價（NT$）<span class="text-danger">*</span></label>
                  <input
                    v-model="prodForm.LivePrice"
                    type="number"
                    min="0"
                    class="form-control"
                    placeholder="例：890"
                  />
                </div>
              </div>
            </template>

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

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
</style>
