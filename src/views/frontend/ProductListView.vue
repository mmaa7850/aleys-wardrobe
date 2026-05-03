<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useWishlistStore } from '@/stores/wishlist'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const wishlist = useWishlistStore()
const auth = useAuthStore()

const products    = ref([])
const categories  = ref([])
const isLoading   = ref(true)
const activeCategory = ref(route.query.category || '')
const sortBy      = ref('newest')
const PAGE_SIZE   = 12
const page        = ref(1)
const hasMore     = ref(false)

// ── helpers ──────────────────────────────────────────
function getImageUrl(path) {
  if (!path) return null
  const url = supabase.storage.from('product-pictures').getPublicUrl(path).data?.publicUrl || null
  return url
}

function getMainMedia(product) {
  const pics = product.C_PRD_ProductPictureList || []
  return pics.find(p => p.IsMain) || pics[0] || null
}

function getMainImage(product) {
  const main = getMainMedia(product)
  return main ? getImageUrl(main.StoragePath) : null
}

// ── fetch ─────────────────────────────────────────────
async function fetchCategories() {
  const { data } = await db.from('S_PRD_CategoryList').select('ID, Name').order('Name')
  if (data) categories.value = data
}

async function fetchProducts(reset = true) {
  if (reset) { page.value = 1; products.value = [] }
  isLoading.value = true

  let query = db
    .from('C_PRD_ProductList')
    .select(`ID, ProductName, Price, OriginPrice, Category,
      C_PRD_ProductPictureList(StoragePath, AltText, IsMain, Type)`)
    .eq('IsActive', true)
    .range((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)

  if (activeCategory.value) query = query.eq('Category', activeCategory.value)

  if (sortBy.value === 'price_asc')  query = query.order('Price', { ascending: true })
  else if (sortBy.value === 'price_desc') query = query.order('Price', { ascending: false })
  else query = query.order('CreatedDate', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('[ProductList] fetch error:', error)
    isLoading.value = false
    return
  }

  if (data) {
    hasMore.value = data.length > PAGE_SIZE
    const batch = hasMore.value ? data.slice(0, PAGE_SIZE) : data
    if (reset) products.value = batch
    else products.value.push(...batch)
  }
  isLoading.value = false
}

async function loadMore() {
  page.value++
  await fetchProducts(false)
}

function selectCategory(cat) {
  activeCategory.value = cat
  router.replace({ query: cat ? { category: cat } : {} })
}

async function toggleWishlist(productId, event) {
  event.preventDefault()
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }
  await wishlist.toggle(productId)
}

// ── init ──────────────────────────────────────────────
onMounted(() => {
  fetchCategories()
  fetchProducts()
  if (auth.isLoggedIn) {
    wishlist.fetch()
  }
})

watch(sortBy, () => fetchProducts())
watch(() => route.query.category, (val) => {
  activeCategory.value = val || ''
  fetchProducts()
})
</script>

<template>
  <!-- Page hero -->
  <div class="pl-hero">
    <p class="pl-hero__eyebrow">Collection</p>
    <h1 class="pl-hero__title">所有商品</h1>
  </div>

  <!-- Sticky filter bar -->
  <div class="pl-bar">
    <div class="pl-bar__inner">
      <!-- Category pills -->
      <div class="pl-cats">
        <button
          :class="['pl-cat', { 'pl-cat--active': activeCategory === '' }]"
          @click="selectCategory('')"
        >全部</button>
        <button
          v-for="cat in categories"
          :key="cat.ID"
          :class="['pl-cat', { 'pl-cat--active': activeCategory === cat.Name }]"
          @click="selectCategory(cat.Name)"
        >{{ cat.Name }}</button>
      </div>

      <!-- Sort -->
      <select v-model="sortBy" class="pl-sort">
        <option value="newest">最新上架</option>
        <option value="price_asc">價格：低到高</option>
        <option value="price_desc">價格：高到低</option>
      </select>
    </div>
  </div>

  <!-- Product count -->
  <div class="pl-meta" v-if="!isLoading">
    共 {{ products.length }}{{ hasMore ? '+' : '' }} 件商品
  </div>

  <!-- Grid -->
  <div class="pl-grid-wrap">
    <!-- Skeleton -->
    <div v-if="isLoading && products.length === 0" class="pl-grid">
      <div v-for="n in PAGE_SIZE" :key="n" class="pcard pcard--skeleton">
        <div class="pcard__img-wrap skeleton-box"></div>
        <div class="pcard__info">
          <div class="sk-text sk-text--lg"></div>
          <div class="sk-text"></div>
        </div>
      </div>
    </div>

    <!-- Products -->
    <div v-else-if="products.length" class="pl-grid">
      <RouterLink
        v-for="p in products"
        :key="p.ID"
        :to="`/products/${p.ID}`"
        class="pcard"
      >
        <div class="pcard__img-wrap">
          <template v-if="getMainImage(p)">
            <video
              v-if="getMainMedia(p)?.Type === 'video'"
              :src="getMainImage(p)"
              class="pcard__img"
              muted
              loop
              playsinline
              autoplay
            />
            <img
              v-else
              :src="getMainImage(p)"
              :alt="p.ProductName"
              class="pcard__img"
              loading="lazy"
            />
          </template>
          <div v-else class="pcard__no-img">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="m21 15-5-5L5 21"/>
            </svg>
          </div>
          <div class="pcard__overlay"><span>查看商品</span></div>
          <div v-if="p.OriginPrice && p.OriginPrice > p.Price" class="pcard__badge">SALE</div>

          <!-- Wishlist heart -->
          <button
            :class="['pcard__heart-btn', { 'pcard__heart-btn--active': wishlist.has(p.ID) }]"
            @click="toggleWishlist(p.ID, $event)"
            :aria-label="wishlist.has(p.ID) ? '移除收藏' : '加入收藏'"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" :fill="wishlist.has(p.ID) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
        <div class="pcard__info">
          <p class="pcard__name">{{ p.ProductName }}</p>
          <div class="pcard__price-row">
            <s v-if="p.OriginPrice && p.OriginPrice > p.Price" class="pcard__origin">
              NT$ {{ p.OriginPrice.toLocaleString() }}
            </s>
            <span class="pcard__price">NT$ {{ p.Price.toLocaleString() }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Empty -->
    <div v-else class="pl-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <p>找不到符合的商品</p>
    </div>

    <!-- Load more -->
    <div v-if="hasMore && !isLoading" class="pl-more">
      <button class="btn-outline" @click="loadMore">載入更多</button>
    </div>
    <div v-if="isLoading && products.length > 0" class="pl-more">
      <span class="pl-loading-text">載入中...</span>
    </div>
  </div>
</template>

<style scoped>
/* ── Hero ── */
.pl-hero {
  padding: 120px 36px 48px;
  text-align: center;
  background: var(--fe-cream);
}

.pl-hero__eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 12px;
}

.pl-hero__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(36px, 6vw, 56px);
  font-weight: 500;
  margin: 0;
  color: var(--fe-text);
}

/* ── Filter bar ── */
.pl-bar {
  position: sticky;
  top: 68px;
  z-index: 100;
  background: rgba(254,254,254,0.96);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--fe-border);
}

.pl-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 36px;
  height: 56px;
}

/* Category pills */
.pl-cats {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
}

.pl-cats::-webkit-scrollbar { display: none; }

.pl-cat {
  white-space: nowrap;
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid var(--fe-border);
  background: transparent;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--fe-muted);
  cursor: pointer;
  transition: all 0.18s;
  flex-shrink: 0;
}

.pl-cat:hover {
  border-color: var(--fe-text);
  color: var(--fe-text);
}

.pl-cat--active {
  background: var(--fe-text);
  border-color: var(--fe-text);
  color: #fff;
}

/* Sort */
.pl-sort {
  flex-shrink: 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--fe-text);
  border: 1px solid var(--fe-border);
  background: transparent;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
}

/* Meta */
.pl-meta {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 36px 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--fe-muted);
}

/* ── Grid ── */
.pl-grid-wrap {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 36px 96px;
}

.pl-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 1199px) { .pl-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 767px)  {
  .pl-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .pl-bar__inner { padding: 0 16px; }
  .pl-grid-wrap  { padding: 16px 16px 80px; }
  .pl-meta       { padding: 16px 16px 0; }
  .pl-hero       { padding: 100px 20px 36px; }
}

/* ── Product card ── */
.pcard {
  text-decoration: none;
  color: var(--fe-text);
  display: block;
}

.pcard__img-wrap {
  position: relative;
  aspect-ratio: 3/4;
  overflow: hidden;
  background: var(--fe-linen);
  margin-bottom: 12px;
}

.pcard__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.pcard:hover .pcard__img { transform: scale(1.04); }

.pcard__no-img {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pcard__overlay {
  position: absolute;
  inset: 0;
  background: rgba(28,23,20,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.pcard:hover .pcard__overlay { opacity: 1; }

.pcard__overlay span {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.7);
  padding: 9px 18px;
}

.pcard__badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: var(--fe-gold-d);
  color: #fff;
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 3px 8px;
}

.pcard__heart-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
  color: var(--fe-muted);
  z-index: 2;
  box-shadow: 0 1px 4px rgba(28,23,20,0.08);
  opacity: 0;
}

.pcard:hover .pcard__heart-btn,
.pcard__heart-btn--active {
  opacity: 1;
}

.pcard__heart-btn--active {
  color: var(--fe-gold-d);
  border-color: var(--fe-gold);
  background: var(--fe-white);
}

.pcard__heart-btn:hover {
  transform: scale(1.12);
  border-color: var(--fe-gold-d);
  color: var(--fe-gold-d);
}

.pcard__name {
  font-size: 13px;
  margin: 0 0 5px;
  line-height: 1.4;
}

.pcard__price-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.pcard__origin {
  font-size: 11.5px;
  color: var(--fe-muted);
}

.pcard__price {
  font-size: 13.5px;
  font-weight: 500;
}

/* ── Empty ── */
.pl-empty {
  text-align: center;
  padding: 100px 0;
  color: var(--fe-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  letter-spacing: 0.06em;
}

/* ── Load more ── */
.pl-more {
  text-align: center;
  margin-top: 56px;
}

.btn-outline {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  border: 1px solid var(--fe-border);
  padding: 13px 40px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.btn-outline:hover {
  border-color: var(--fe-text);
  background: var(--fe-cream);
}

.pl-loading-text {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--fe-muted);
}

/* ── Skeleton ── */
.skeleton-box {
  background: linear-gradient(90deg, var(--fe-linen) 25%, var(--fe-cream) 50%, var(--fe-linen) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.sk-text {
  height: 11px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--fe-linen) 25%, var(--fe-cream) 50%, var(--fe-linen) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 7px;
  width: 75%;
}

.sk-text--lg { width: 55%; height: 13px; }

@keyframes shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
</style>
