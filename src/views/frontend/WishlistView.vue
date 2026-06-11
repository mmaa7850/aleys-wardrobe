<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useWishlistStore } from '@/stores/wishlist'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const wishlist = useWishlistStore()
const cart = useCartStore()
const auth = useAuthStore()

const products = ref([])
const isLoading = ref(true)

function getImageUrl(path) {
  if (!path) return null
  return supabase.storage.from('product-pictures').getPublicUrl(path).data?.publicUrl || null
}

function getMainMedia(product) {
  const pics = product.C_PRD_ProductPictureList || []
  return pics.find(p => p.IsMain) || pics[0] || null
}

function getMainImage(product) {
  const main = getMainMedia(product)
  return main ? getImageUrl(main.StoragePath) : null
}

async function fetchWishlistProducts() {
  isLoading.value = true

  await wishlist.fetch()

  if (wishlist.productIds.length === 0) {
    products.value = []
    isLoading.value = false
    return
  }

  const { data, error } = await db
    .from('C_PRD_ProductList')
    .select(`
      ID, ProductName, Price, OriginPrice,
      C_PRD_ProductPictureList(StoragePath, AltText, IsMain, Type)
    `)
    .in('ID', wishlist.productIds)
    .eq('IsActive', true)

  if (error) {
    if (import.meta.env.DEV) console.error('[wishlist] fetchWishlistProducts error:', error)
  } else {
    products.value = data || []
  }

  isLoading.value = false
}

async function removeFromWishlist(productId, event) {
  event.preventDefault()
  await wishlist.toggle(productId)
  // Remove from local products list if removed from wishlist
  if (!wishlist.has(productId)) {
    products.value = products.value.filter(p => p.ID !== Number(productId))
  }
}

onMounted(async () => {
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }
  await fetchWishlistProducts()
})
</script>

<template>
  <div class="wl-root">

    <!-- Hero -->
    <div class="wl-hero">
      <p class="wl-hero__eyebrow">My Wishlist</p>
      <h1 class="wl-hero__title">收藏清單</h1>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="wl-loading">
      <div class="wl-spinner"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="products.length === 0" class="wl-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <p class="wl-empty__text">收藏清單是空的</p>
      <RouterLink to="/products" class="wl-empty__link">探索商品 →</RouterLink>
    </div>

    <!-- Grid -->
    <div v-else class="wl-grid-wrap">
      <p class="wl-meta">共 {{ products.length }} 件收藏商品</p>
      <div class="wl-grid">
        <div
          v-for="p in products"
          :key="p.ID"
          class="pcard"
        >
          <RouterLink :to="`/products/${p.ID}`" class="pcard__link">
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

              <!-- Heart button (remove from wishlist) -->
              <button
                class="pcard__heart-btn pcard__heart-btn--active"
                @click="removeFromWishlist(p.ID, $event)"
                aria-label="移除收藏"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
          </RouterLink>
          <div class="pcard__info">
            <RouterLink :to="`/products/${p.ID}`" class="pcard__name-link">
              <p class="pcard__name">{{ p.ProductName }}</p>
            </RouterLink>
            <div class="pcard__price-row">
              <s v-if="p.OriginPrice && p.OriginPrice > p.Price" class="pcard__origin">
                NT$ {{ p.OriginPrice.toLocaleString() }}
              </s>
              <span class="pcard__price">NT$ {{ p.Price.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Root ── */
.wl-root {
  padding-top: 68px;
  min-height: 80vh;
}

/* ── Hero ── */
.wl-hero {
  padding: 52px 36px 40px;
  text-align: center;
  background: var(--fe-cream);
}

.wl-hero__eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 12px;
}

.wl-hero__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 500;
  margin: 0;
  color: var(--fe-text);
}

/* ── Loading ── */
.wl-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40vh;
}

.wl-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Empty ── */
.wl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  gap: 16px;
  color: var(--fe-muted);
  padding: 60px 24px;
}

.wl-empty__text {
  font-size: 14px;
  letter-spacing: 0.06em;
  margin: 0;
}

.wl-empty__link {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  border-bottom: 1px solid var(--fe-border);
  padding-bottom: 2px;
  transition: border-color 0.2s;
}

.wl-empty__link:hover { border-color: var(--fe-text); }

/* ── Grid wrap ── */
.wl-grid-wrap {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 36px 96px;
}

.wl-meta {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--fe-muted);
  margin: 0 0 20px;
}

.wl-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

/* ── Product card ── */
.pcard {
  display: block;
  color: var(--fe-text);
}

.pcard__link {
  display: block;
  text-decoration: none;
  color: inherit;
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

.pcard__link:hover .pcard__img { transform: scale(1.04); }

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

.pcard__link:hover .pcard__overlay { opacity: 1; }

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

/* Heart button */
.pcard__heart-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
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
  box-shadow: 0 1px 4px rgba(28,23,20,0.1);
}

.pcard__heart-btn--active {
  color: var(--fe-gold-d);
  border-color: var(--fe-gold);
}

.pcard__heart-btn:hover {
  transform: scale(1.1);
  border-color: var(--fe-gold-d);
}

/* Card info */
.pcard__name-link {
  text-decoration: none;
  color: inherit;
}

.pcard__name {
  font-size: 13px;
  margin: 0 0 5px;
  line-height: 1.4;
  transition: color 0.15s;
}

.pcard__name-link:hover .pcard__name { color: var(--fe-gold-d); }

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

/* ── Responsive ── */
@media (max-width: 1199px) { .wl-grid { grid-template-columns: repeat(3, 1fr); } }

@media (max-width: 767px) {
  .wl-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .wl-grid-wrap { padding: 16px 16px 80px; }
  .wl-hero { padding: 40px 20px 28px; }
  .wl-meta { padding: 0; }
}
</style>
