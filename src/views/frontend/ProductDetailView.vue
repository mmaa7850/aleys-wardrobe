<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import { useAuthStore } from '@/stores/auth'
import { trackViewItem, trackAddToCart } from '@/lib/gtag'

// ── 點擊來源偵測 ───────────────────────────────────────
function detectClickSource(qSrc) {
  if (qSrc === 'line') return 'LINE'
  const ref = document.referrer
  if (!ref) return '直接'
  try {
    const refUrl = new URL(ref)
    if (refUrl.hostname !== window.location.hostname) return '外部'
    const path = refUrl.pathname
    if (path === '/' || path === '') return '首頁'
    if (path === '/products' || path.startsWith('/products?')) return '商品列表'
    if (path === '/cart') return '購物車'
    if (path === '/wishlist') return '願望清單'
    return '其他'
  } catch { return '直接' }
}

const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const wishlist = useWishlistStore()
const auth = useAuthStore()

const product     = ref(null)
const colors      = ref([])
const sizes       = ref([])
const isLoading   = ref(true)
const notFound    = ref(false)

const selectedColor   = ref(null)
const selectedSize    = ref(null)
const activeMediaIdx  = ref(0)
const activeTab       = ref('desc')

const addingToCart = ref(false)
const cartAdded    = ref(false)
const qty          = ref(1)

// ── media ─────────────────────────────────────────────
const sortedMedia = computed(() => {
  if (!product.value) return []
  return [...(product.value.C_PRD_ProductPictureList || [])]
    .sort((a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0))
})

const activeMedia = computed(() => sortedMedia.value[activeMediaIdx.value] || null)

function getUrl(path) {
  if (!path) return null
  return supabase.storage.from('product-pictures').getPublicUrl(path).data?.publicUrl || null
}

// ── variants ──────────────────────────────────────────
const availableColors = computed(() => {
  if (!product.value) return []
  const ids = [...new Set(
    (product.value.C_PRD_ProductVariantList || [])
      .filter(v => v.IsActive !== false)
      .map(v => v.ColorID)
  )]
  return colors.value.filter(c => ids.includes(c.ID))
})

const availableSizes = computed(() => {
  if (!product.value || !selectedColor.value) return []
  const ids = (product.value.C_PRD_ProductVariantList || [])
    .filter(v => v.ColorID === selectedColor.value && v.IsActive !== false)
    .map(v => v.SizeID)
  return sizes.value.filter(s => ids.includes(s.ID))
})

const selectedVariant = computed(() =>
  (product.value?.C_PRD_ProductVariantList || []).find(
    v => v.ColorID === selectedColor.value && v.SizeID === selectedSize.value
  ) || null
)

const maxQty = computed(() => {
  if (isActivePreOrder.value) return 99
  return selectedVariant.value?.StockQty ?? 1
})

watch(selectedVariant, () => { qty.value = 1 })

function decQty() { if (qty.value > 1) qty.value-- }
function incQty() { if (qty.value < maxQty.value) qty.value++ }

const stockStatus = computed(() => {
  if (!selectedVariant.value) return null
  const qty = selectedVariant.value.StockQty
  if (qty <= 0)  return { label: '已售完', cls: 'out' }
  if (qty <= 5)  return { label: `僅剩 ${qty} 件`, cls: 'low' }
  return { label: '有現貨', cls: 'in' }
})

const isOnSale = computed(() =>
  product.value?.OriginPrice && product.value.OriginPrice > product.value.Price
)

const isActivePreOrder = computed(() =>
  !!product.value?.IsPreOrder && stockStatus.value?.cls === 'out'
)

// ── size spec ─────────────────────────────────────────
const sizeSpecs = computed(() => product.value?.C_PRD_ProductSizeSpecList || [])

const specFields = [
  { key: 'Bust',           label: '胸圍' },
  { key: 'Waist',          label: '腰圍' },
  { key: 'Hip',            label: '臀圍' },
  { key: 'ClothLength',    label: '衣長' },
  { key: 'SleeveLength',   label: '袖長' },
  { key: 'ShoulderWidth',  label: '肩寬' },
  { key: 'SkirtLength',    label: '裙長' },
]

const activeSpecFields = computed(() =>
  specFields.filter(f => sizeSpecs.value.some(s => s[f.key]))
)

function getSizeName(id) {
  return sizes.value.find(s => s.ID === id)?.Name || id
}

// ── fetch ─────────────────────────────────────────────
async function fetchData() {
  isLoading.value = true

  const [{ data: prd, error: prdErr }, { data: clrs }, { data: szs }, { data: specs }] = await Promise.all([
    db.from('C_PRD_ProductList')
      .select(`
        ID, ProductName, ProductTitle, SubTitle, Description,
        Material, WashingMethod, OriginPrice, Price,
        IsPreOrder, PreOrderNote,
        C_PRD_ProductPictureList(ID, StoragePath, AltText, IsMain, SortOrder, Type),
        C_PRD_ProductVariantList(ID, ColorID, SizeID, StockQty, IsActive)
      `)
      .eq('ID', route.params.id)
      .single(),
    db.from('S_PRD_ColorList').select('ID, Name'),
    db.from('S_PRD_SizeList').select('ID, Name').order('SortOrder'),
    db.from('C_PRD_ProductSizeSpecList')
      .select('SizeID, Bust, ClothLength, SleeveLength, ShoulderWidth, Waist, SkirtLength, Hip, Memo')
      .eq('ProductID', route.params.id),
  ])


  if (prdErr || !prd) { notFound.value = true; isLoading.value = false; return }

  product.value  = { ...prd, C_PRD_ProductSizeSpecList: specs || [] }
  trackViewItem(product.value)
  colors.value   = clrs || []
  sizes.value    = szs  || []

  // ── 記錄商品點擊（fire & forget，不阻擋頁面載入）────────
  db.from('C_ANL_ProductClickLog').insert({
    ProductID:   prd.ID,
    ProductName: prd.ProductName ?? '',
    Source:      detectClickSource(route.query.src),
  }).then() // 忽略結果

  // 預設選第一個顏色
  if (availableColors.value.length) {
    selectedColor.value = availableColors.value[0].ID
  }

  // 主圖設為 active
  const mainIdx = sortedMedia.value.findIndex(m => m.IsMain)
  activeMediaIdx.value = mainIdx >= 0 ? mainIdx : 0

  isLoading.value = false
}

function selectColor(id) {
  selectedColor.value = id
  selectedSize.value  = null
}

async function onAddToCart() {
  if (!selectedVariant.value) return
  if (!auth.isLoggedIn) { router.push('/login?redirect=' + encodeURIComponent(route.fullPath)); return }
  if (!auth.lineUserId) {
    router.push('/account?requireLine=1')
    return
  }
  addingToCart.value = true
  try {
    await cart.addItem(product.value.ID, selectedVariant.value.ID, qty.value)
    cartAdded.value = true
    setTimeout(() => { cartAdded.value = false }, 2000)
    const colorName = colors.value.find(c => c.ID === selectedColor.value)?.Name ?? ''
    const sizeName  = sizes.value.find(s => s.ID === selectedSize.value)?.Name ?? ''
    trackAddToCart(product.value, qty.value, colorName, sizeName)
  } catch (err) {
    console.error('[ProductDetail] addItem error:', err)
  } finally {
    addingToCart.value = false
  }
}

async function toggleWishlist() {
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }
  await wishlist.toggle(product.value.ID)
}

onMounted(async () => {
  await fetchData()
  if (auth.isLoggedIn) {
    wishlist.fetch()
  }
})
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="pd-loading">
    <div class="pd-spinner"></div>
  </div>

  <!-- Not found -->
  <div v-else-if="notFound" class="pd-notfound">
    <p>找不到此商品</p>
    <RouterLink to="/products" class="pd-back">← 返回商品列表</RouterLink>
  </div>

  <!-- Product -->
  <div v-else class="pd-root">

    <!-- Breadcrumb -->
    <div class="pd-breadcrumb">
      <RouterLink to="/">首頁</RouterLink>
      <span>/</span>
      <RouterLink to="/products">所有商品</RouterLink>
      <span>/</span>
      <span>{{ product.ProductName }}</span>
    </div>

    <!-- Main layout -->
    <div class="pd-main">

      <!-- ── Gallery ── -->
      <div class="pd-gallery">
        <!-- Main display -->
        <div class="pd-gallery__main">
          <video
            v-if="activeMedia?.Type === 'video'"
            :src="getUrl(activeMedia.StoragePath)"
            class="pd-gallery__media"
            controls
            loop
            muted
            playsinline
          />
          <img
            v-else-if="activeMedia"
            :src="getUrl(activeMedia.StoragePath)"
            :alt="activeMedia.AltText || product.ProductName"
            class="pd-gallery__media"
          />
          <div v-else class="pd-gallery__empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
            </svg>
          </div>

          <!-- Sale badge -->
          <div v-if="isOnSale" class="pd-badge">SALE</div>
        </div>

        <!-- Thumbnails -->
        <div v-if="sortedMedia.length > 1" class="pd-thumbs">
          <button
            v-for="(media, i) in sortedMedia"
            :key="media.ID"
            :class="['pd-thumb', { 'pd-thumb--active': activeMediaIdx === i }]"
            @click="activeMediaIdx = i"
          >
            <video v-if="media.Type === 'video'" :src="getUrl(media.StoragePath)" class="pd-thumb__media" muted />
            <img  v-else :src="getUrl(media.StoragePath)" :alt="media.AltText" class="pd-thumb__media" />
            <div v-if="media.Type === 'video'" class="pd-thumb__play">▶</div>
          </button>
        </div>
      </div>

      <!-- ── Info ── -->
      <div class="pd-info">
        <!-- Name & subtitle -->
        <p v-if="product.SubTitle" class="pd-subtitle">{{ product.SubTitle }}</p>
        <h1 class="pd-name">{{ product.ProductName }}</h1>
        <p v-if="product.ProductTitle" class="pd-title">{{ product.ProductTitle }}</p>

        <!-- Price -->
        <div class="pd-price-row">
          <s v-if="isOnSale" class="pd-origin">NT$ {{ product.OriginPrice.toLocaleString() }}</s>
          <span :class="['pd-price', { 'pd-price--sale': isOnSale }]">
            NT$ {{ product.Price.toLocaleString() }}
          </span>
        </div>

        <!-- Pre-order notice（庫存售完 + IsPreOrder = true 才顯示）-->
        <div v-if="isActivePreOrder" class="pd-preorder">
          <span class="pd-preorder__badge">預購中</span>
          <span class="pd-preorder__date">2-3 週內出貨</span>
          <p v-if="product.PreOrderNote" class="pd-preorder__note">{{ product.PreOrderNote }}</p>
        </div>

        <div class="pd-divider"></div>

        <!-- Color selector -->
        <div v-if="availableColors.length" class="pd-section">
          <p class="pd-section__label">
            顏色
            <span v-if="selectedColor" class="pd-section__val">
              {{ availableColors.find(c => c.ID === selectedColor)?.Name }}
            </span>
          </p>
          <div class="pd-colors">
            <button
              v-for="c in availableColors"
              :key="c.ID"
              :class="['pd-color-btn', { 'pd-color-btn--active': selectedColor === c.ID }]"
              @click="selectColor(c.ID)"
            >{{ c.Name }}</button>
          </div>
        </div>

        <!-- Size selector -->
        <div v-if="availableSizes.length" class="pd-section">
          <p class="pd-section__label">
            尺寸
            <span v-if="selectedSize" class="pd-section__val">
              {{ availableSizes.find(s => s.ID === selectedSize)?.Name }}
            </span>
          </p>
          <div class="pd-sizes">
            <button
              v-for="s in availableSizes"
              :key="s.ID"
              :class="['pd-size-btn', { 'pd-size-btn--active': selectedSize === s.ID }]"
              @click="selectedSize = s.ID"
            >{{ s.Name }}</button>
          </div>
        </div>

        <!-- Stock status（預購模式下不顯示「已售完」）-->
        <p v-if="stockStatus && !isActivePreOrder" :class="['pd-stock', `pd-stock--${stockStatus.cls}`]">
          {{ stockStatus.label }}
        </p>

        <!-- Quantity selector -->
        <div v-if="selectedVariant && (stockStatus?.cls !== 'out' || isActivePreOrder)" class="pd-qty-row">
          <button class="pd-qty-btn" @click="decQty" :disabled="qty <= 1">−</button>
          <span class="pd-qty-val">{{ qty }}</span>
          <button class="pd-qty-btn" @click="incQty" :disabled="qty >= maxQty">+</button>
        </div>

        <!-- Add to cart + Wishlist -->
        <div class="pd-cart-row">
          <button
            class="pd-cart-btn"
            :disabled="!selectedColor || !selectedSize || (stockStatus?.cls === 'out' && !isActivePreOrder) || addingToCart"
            @click="onAddToCart"
          >
            <span v-if="addingToCart">加入中...</span>
            <span v-else-if="cartAdded">已加入 ✓</span>
            <span v-else-if="!selectedColor">請選擇顏色</span>
            <span v-else-if="!selectedSize">請選擇尺寸</span>
            <span v-else-if="isActivePreOrder">立即預購</span>
            <span v-else-if="stockStatus?.cls === 'out'">已售完</span>
            <span v-else>加入購物車</span>
          </button>

          <button
            class="pd-wish-btn"
            :class="{ 'pd-wish-btn--active': product && wishlist.has(product.ID) }"
            @click="toggleWishlist"
            :aria-label="product && wishlist.has(product.ID) ? '移除收藏' : '加入收藏'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" :fill="product && wishlist.has(product.ID) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        <div class="pd-divider"></div>

        <!-- Material & washing -->
        <div class="pd-meta-list">
          <div v-if="product.Material" class="pd-meta-row">
            <span class="pd-meta-key">材質</span>
            <span class="pd-meta-val">{{ product.Material }}</span>
          </div>
          <div v-if="product.WashingMethod" class="pd-meta-row">
            <span class="pd-meta-key">洗滌</span>
            <span class="pd-meta-val">{{ product.WashingMethod }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tabs ── -->
    <div class="pd-tabs-wrap">
      <div class="pd-tabs">
        <button :class="['pd-tab', { 'pd-tab--active': activeTab === 'desc' }]" @click="activeTab = 'desc'">商品描述</button>
        <button v-if="sizeSpecs.length" :class="['pd-tab', { 'pd-tab--active': activeTab === 'size' }]" @click="activeTab = 'size'">尺寸規格</button>
      </div>

      <!-- Description -->
      <div v-if="activeTab === 'desc'" class="pd-tab-content">
        <p v-if="product.Description" class="pd-desc">{{ product.Description }}</p>
        <p v-else class="pd-desc pd-desc--empty">尚無商品描述</p>
      </div>

      <!-- Size spec table -->
      <div v-if="activeTab === 'size' && sizeSpecs.length" class="pd-tab-content">
        <div class="pd-spec-wrap">
          <table class="pd-spec-table">
            <thead>
              <tr>
                <th>尺寸</th>
                <th v-for="f in activeSpecFields" :key="f.key">{{ f.label }}(cm)</th>
                <th v-if="sizeSpecs.some(s => s.Memo)">備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="spec in sizeSpecs" :key="spec.SizeID">
                <td class="pd-spec-size">{{ getSizeName(spec.SizeID) }}</td>
                <td v-for="f in activeSpecFields" :key="f.key">{{ spec[f.key] || '—' }}</td>
                <td v-if="sizeSpecs.some(s => s.Memo)">{{ spec.Memo || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Loading / notfound ── */
.pd-loading {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 68px;
}

.pd-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.pd-notfound {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--fe-muted);
  font-size: 14px;
  padding-top: 68px;
}

.pd-back {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--fe-text);
  text-decoration: none;
  border-bottom: 1px solid var(--fe-border);
  padding-bottom: 2px;
}

/* ── Root ── */
.pd-root {
  padding-top: 68px;
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 36px;
  padding-right: 36px;
  padding-bottom: 96px;
}

/* ── Breadcrumb ── */
.pd-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0 32px;
  font-size: 12px;
  color: var(--fe-muted);
}

.pd-breadcrumb a {
  color: var(--fe-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.pd-breadcrumb a:hover { color: var(--fe-text); }

/* ── Main layout ── */
.pd-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
}

@media (max-width: 767px) {
  .pd-root { padding-left: 16px; padding-right: 16px; }
  .pd-main { grid-template-columns: 1fr; gap: 32px; }
}

/* ── Gallery ── */
.pd-gallery__main {
  position: relative;
  aspect-ratio: 3/4;
  background: var(--fe-linen);
  overflow: hidden;
}

.pd-gallery__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pd-gallery__empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pd-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  background: var(--fe-gold-d);
  color: #fff;
  font-size: 10px;
  letter-spacing: 0.12em;
  padding: 4px 10px;
}

.pd-thumbs {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.pd-thumb {
  position: relative;
  width: 72px;
  height: 96px;
  border: 1.5px solid transparent;
  background: var(--fe-linen);
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: border-color 0.15s;
  flex-shrink: 0;
}

.pd-thumb--active { border-color: var(--fe-text); }

.pd-thumb__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pd-thumb__play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.3);
  color: #fff;
  font-size: 16px;
}

/* ── Info ── */
.pd-subtitle {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 10px;
}

.pd-name {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 500;
  margin: 0 0 8px;
  line-height: 1.2;
}

.pd-title {
  font-size: 13px;
  color: var(--fe-muted);
  margin: 0 0 20px;
  line-height: 1.6;
}

.pd-price-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}

.pd-origin {
  font-size: 14px;
  color: var(--fe-muted);
}

.pd-price {
  font-size: 22px;
  font-weight: 500;
  color: var(--fe-text);
}

.pd-price--sale { color: #B45309; }

.pd-divider {
  height: 1px;
  background: var(--fe-border);
  margin: 20px 0;
}

/* ── Selectors ── */
.pd-section { margin-bottom: 20px; }

.pd-section__label {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
  margin: 0 0 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.pd-section__val {
  font-weight: 500;
  color: var(--fe-text);
  text-transform: none;
  letter-spacing: 0;
}

.pd-colors { display: flex; gap: 8px; flex-wrap: wrap; }

.pd-color-btn {
  padding: 7px 16px;
  border: 1px solid var(--fe-border);
  background: transparent;
  font-size: 12.5px;
  color: var(--fe-text);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 2px;
}

.pd-color-btn:hover { border-color: var(--fe-text); }
.pd-color-btn--active {
  border-color: var(--fe-text);
  background: var(--fe-text);
  color: #fff;
}

.pd-sizes { display: flex; gap: 8px; flex-wrap: wrap; }

.pd-size-btn {
  min-width: 48px;
  padding: 7px 14px;
  border: 1px solid var(--fe-border);
  background: transparent;
  font-size: 12.5px;
  color: var(--fe-text);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 2px;
  text-align: center;
}

.pd-size-btn:hover { border-color: var(--fe-text); }
.pd-size-btn--active {
  border-color: var(--fe-text);
  background: var(--fe-text);
  color: #fff;
}

/* Pre-order */
.pd-preorder {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.pd-preorder__badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  background: var(--fe-gold-d);
  color: #fff;
  font-size: 11px;
  letter-spacing: 0.08em;
  border-radius: 2px;
  font-weight: 500;
}

.pd-preorder__date {
  font-size: 12.5px;
  color: var(--fe-gold-d);
}

.pd-preorder__note {
  width: 100%;
  font-size: 12px;
  color: var(--fe-muted);
  margin: 0;
  line-height: 1.5;
}

/* Stock */
.pd-stock {
  font-size: 12px;
  margin: 0 0 16px;
  letter-spacing: 0.04em;
}

.pd-stock--in  { color: #15803D; }
.pd-stock--low { color: #B45309; }
.pd-stock--out { color: #DC2626; }

/* Quantity selector */
.pd-qty-row {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 14px;
  border: 1px solid var(--fe-border);
  width: fit-content;
}

.pd-qty-btn {
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--fe-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  line-height: 1;
}

.pd-qty-btn:hover:not(:disabled) { background: var(--fe-linen); }
.pd-qty-btn:disabled { color: var(--fe-muted); cursor: not-allowed; }

.pd-qty-val {
  min-width: 40px;
  text-align: center;
  font-size: 14px;
  border-left: 1px solid var(--fe-border);
  border-right: 1px solid var(--fe-border);
  line-height: 40px;
}

/* Cart row */
.pd-cart-row {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
}

/* Cart button */
.pd-cart-btn {
  flex: 1;
  padding: 15px;
  border: 1px solid var(--fe-text);
  background: var(--fe-text);
  color: #fff;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.pd-cart-btn:hover:not(:disabled) {
  background: transparent;
  color: var(--fe-text);
}

.pd-cart-btn:disabled {
  background: var(--fe-linen);
  border-color: var(--fe-border);
  color: var(--fe-muted);
  cursor: not-allowed;
}

/* Wishlist button */
.pd-wish-btn {
  width: 52px;
  flex-shrink: 0;
  border: 1px solid var(--fe-border);
  background: transparent;
  color: var(--fe-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}

.pd-wish-btn:hover {
  border-color: var(--fe-gold);
  color: var(--fe-gold-d);
}

.pd-wish-btn--active {
  border-color: var(--fe-gold);
  color: var(--fe-gold-d);
  background: var(--fe-linen);
}

/* Meta */
.pd-meta-list { display: flex; flex-direction: column; gap: 10px; }

.pd-meta-row {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.pd-meta-key {
  color: var(--fe-muted);
  min-width: 36px;
  letter-spacing: 0.04em;
}

.pd-meta-val { color: var(--fe-text); line-height: 1.6; }

/* ── Tabs ── */
.pd-tabs-wrap {
  margin-top: 64px;
  border-top: 1px solid var(--fe-border);
}

.pd-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--fe-border);
}

.pd-tab {
  padding: 16px 28px;
  background: none;
  border: none;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.pd-tab:hover { color: var(--fe-text); }

.pd-tab--active {
  color: var(--fe-text);
  border-bottom-color: var(--fe-text);
}

.pd-tab-content {
  padding: 36px 0;
}

.pd-desc {
  font-size: 14px;
  line-height: 2;
  color: var(--fe-muted);
  white-space: pre-line;
  max-width: 680px;
  margin: 0;
}

.pd-desc--empty { font-style: italic; }

/* Size spec table */
.pd-spec-wrap { overflow-x: auto; }

.pd-spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.pd-spec-table th {
  padding: 10px 16px;
  text-align: left;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
  border-bottom: 1px solid var(--fe-border);
  white-space: nowrap;
}

.pd-spec-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--fe-linen);
  color: var(--fe-text);
}

.pd-spec-size { font-weight: 500; }
</style>
