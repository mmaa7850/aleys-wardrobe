<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// ── Products ────────────────────────────────────────────────
const newArrivals = ref([])
const homeCategories = ref([])
const isLoading = ref(true)

function getProductImageUrl(storagePath) {
  if (!storagePath) return null
  const { data } = supabase.storage.from('product-pictures').getPublicUrl(storagePath)
  return data?.publicUrl || null
}

function getMainMedia(product) {
  const pics = product.C_PRD_ProductPictureList || []
  return pics.find(p => p.IsMain) || pics[0] || null
}

function getMainImage(product) {
  const main = getMainMedia(product)
  return main ? getProductImageUrl(main.StoragePath) : null
}

// ── Banners ─────────────────────────────────────────────────
const BANNER_BUCKET = 'banners'

const heroBanners = ref([])   // position: home-hero
const homeBanners = ref([])   // position: home-banner
const heroIdx = ref(0)
const bannerIdx = ref(0)
let heroTimer = null
let bannerTimer = null

function getBannerUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path)
  return data?.publicUrl || null
}

function resolveLink(url) {
  if (!url) return null
  return url
}

function bannerTarget(url) {
  if (!url) return undefined
  return url.startsWith('http') ? '_blank' : undefined
}

const currentHero  = computed(() => heroBanners.value[heroIdx.value]  || null)
const currentBanner = computed(() => homeBanners.value[bannerIdx.value] || null)

function goHero(i) {
  heroIdx.value = i
  restartHeroTimer()
}

function goBanner(i) {
  bannerIdx.value = i
  restartBannerTimer()
}

function restartHeroTimer() {
  clearInterval(heroTimer)
  if (heroBanners.value.length > 1) {
    heroTimer = setInterval(() => {
      heroIdx.value = (heroIdx.value + 1) % heroBanners.value.length
    }, 5000)
  }
}

function restartBannerTimer() {
  clearInterval(bannerTimer)
  if (homeBanners.value.length > 1) {
    bannerTimer = setInterval(() => {
      bannerIdx.value = (bannerIdx.value + 1) % homeBanners.value.length
    }, 6000)
  }
}

async function loadBanners() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await db
    .from('S_MKT_BannerList')
    .select('ID, ImagePath, LinkURL, AltText, Position, SortOrder')
    .eq('IsActive', true)
    .or(`StartDate.is.null,StartDate.lte.${today}`)
    .or(`EndDate.is.null,EndDate.gte.${today}`)
    .order('SortOrder', { ascending: true })

  if (!data) return
  heroBanners.value = data.filter(b => b.Position === 'home-hero')
  homeBanners.value = data.filter(b => b.Position === 'home-banner')
  restartHeroTimer()
  restartBannerTimer()
}

// ── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    loadBanners(),
    db
      .from('C_PRD_ProductList')
      .select(`
        ID, ProductName, Price, OriginPrice,
        C_PRD_ProductPictureList(StoragePath, AltText, IsMain, Type)
      `)
      .or('IsActive.is.null,IsActive.eq.true')
      .order('CreatedDate', { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) newArrivals.value = data }),
    db
      .from('S_PRD_CategoryList')
      .select('ID, Name')
      .order('ID', { ascending: true })
      .then(({ data }) => { homeCategories.value = data ?? [] }),
  ])
  isLoading.value = false
})

onUnmounted(() => {
  clearInterval(heroTimer)
  clearInterval(bannerTimer)
})
</script>

<template>
  <!-- ════════════════════════════════
       HERO
  ════════════════════════════════ -->
  <section class="hero">
    <div class="hero__left">
      <div class="hero__content">
        <p class="hero__eyebrow">2025 New Collection</p>
        <h1 class="hero__title">
          <span class="hero__title--light">Curated</span>
          <span class="hero__title--bold">Style</span>
        </h1>
        <div class="hero__divider"></div>
        <p class="hero__sub">精選日韓服飾，輕盈穿出你的獨特品味</p>
        <RouterLink to="/products" class="hero__cta">
          探索新品
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </RouterLink>
      </div>
    </div>

    <!-- Hero right: decorative frame always shown, banner fills inside -->
    <div class="hero__right">
      <div class="hero__deco">

        <!-- Frame: banner inside, or placeholder text -->
        <div class="hero__deco-frame" :class="{ 'hero__deco-frame--filled': heroBanners.length }">

          <!-- ▸ Banner image fills the frame -->
          <template v-if="heroBanners.length && currentHero">
            <transition name="hfade" mode="out-in">
              <component
                :is="currentHero.LinkURL ? 'a' : 'div'"
                :key="heroIdx"
                :href="resolveLink(currentHero.LinkURL)"
                :target="bannerTarget(currentHero.LinkURL)"
                class="hero-frame-img"
              >
                <img
                  :src="getBannerUrl(currentHero.ImagePath)"
                  :alt="currentHero.AltText || 'Banner'"
                />
              </component>
            </transition>
            <!-- Dots inside frame bottom -->
            <div v-if="heroBanners.length > 1" class="hero-dots">
              <button
                v-for="(_, i) in heroBanners"
                :key="i"
                class="hero-dot"
                :class="{ 'hero-dot--active': i === heroIdx }"
                @click="goHero(i)"
              ></button>
            </div>
          </template>

          <!-- ▸ Placeholder (no banners) -->
          <template v-else>
            <span class="hero__deco-label">New Arrivals</span>
            <div class="hero__deco-dots">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
          </template>

        </div>

        <!-- Gold tag always visible -->
        <div class="hero__deco-tag">
          <p>日韓選品</p>
          <p>品味生活</p>
        </div>

      </div>
    </div>
  </section>

  <!-- ════════════════════════════════
       TICKER
  ════════════════════════════════ -->
  <div class="ticker">
    <div class="ticker__track">
      <span v-for="n in 4" :key="n">
        NEW ARRIVALS &nbsp;·&nbsp; KOREAN STYLE &nbsp;·&nbsp; JAPANESE FASHION &nbsp;·&nbsp; FREE SHIPPING &nbsp;·&nbsp; ALEY'S WARDROBE &nbsp;·&nbsp;
      </span>
    </div>
  </div>

  <!-- ════════════════════════════════
       HOME BANNER STRIP
  ════════════════════════════════ -->
  <section v-if="homeBanners.length && currentBanner" class="hbanner">
    <div class="hbanner__wrap">
      <transition name="bfade" mode="out-in">
        <component
          :is="currentBanner.LinkURL ? 'a' : 'div'"
          :key="bannerIdx"
          :href="resolveLink(currentBanner.LinkURL)"
          :target="bannerTarget(currentBanner.LinkURL)"
          class="hbanner__item"
        >
          <img
            :src="getBannerUrl(currentBanner.ImagePath)"
            :alt="currentBanner.AltText || 'Banner'"
            class="hbanner__img"
          />
        </component>
      </transition>
      <!-- Dots -->
      <div v-if="homeBanners.length > 1" class="hbanner__dots">
        <button
          v-for="(_, i) in homeBanners"
          :key="i"
          class="hbanner__dot"
          :class="{ 'hbanner__dot--active': i === bannerIdx }"
          @click="goBanner(i)"
        ></button>
      </div>
    </div>
  </section>

  <!-- ════════════════════════════════
       NEW ARRIVALS
  ════════════════════════════════ -->
  <section class="section-products">
    <div class="section-header">
      <span class="section-header__eyebrow">New In</span>
      <h2 class="section-header__title">最新上架</h2>
      <div class="section-header__line"></div>
    </div>

    <div v-if="isLoading" class="products-grid">
      <div v-for="n in 4" :key="n" class="product-card product-card--skeleton">
        <div class="product-card__img-wrap skeleton-box"></div>
        <div class="product-card__info">
          <div class="skeleton-text skeleton-text--lg"></div>
          <div class="skeleton-text"></div>
        </div>
      </div>
    </div>

    <div v-else-if="newArrivals.length" class="products-grid">
      <RouterLink
        v-for="product in newArrivals"
        :key="product.ID"
        :to="`/products/${product.ID}`"
        class="product-card"
      >
        <div class="product-card__img-wrap">
          <template v-if="getMainImage(product)">
            <video
              v-if="getMainMedia(product)?.Type === 'video'"
              :src="getMainImage(product)"
              class="product-card__img"
              muted loop playsinline autoplay
            />
            <img
              v-else
              :src="getMainImage(product)"
              :alt="product.ProductName"
              class="product-card__img"
              loading="lazy"
            />
          </template>
          <div v-if="!getMainImage(product)" class="product-card__img-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          </div>
          <div class="product-card__overlay"><span>查看商品</span></div>
          <div v-if="product.OriginPrice && product.OriginPrice > product.Price" class="product-card__badge">SALE</div>
        </div>
        <div class="product-card__info">
          <p class="product-card__name">{{ product.ProductName }}</p>
          <div class="product-card__price-row">
            <s v-if="product.OriginPrice && product.OriginPrice > product.Price" class="product-card__origin">
              NT$ {{ product.OriginPrice.toLocaleString() }}
            </s>
            <span class="product-card__price">NT$ {{ product.Price.toLocaleString() }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <div v-else class="products-empty">
      <p>商品即將上架，敬請期待</p>
    </div>

    <div class="section-cta">
      <RouterLink to="/products" class="btn-outline">查看全部商品</RouterLink>
    </div>
  </section>

  <!-- ════════════════════════════════
       CATEGORIES
  ════════════════════════════════ -->
  <section v-if="homeCategories.length" class="section-categories">
    <div class="section-header">
      <span class="section-header__eyebrow">Shop By Category</span>
      <h2 class="section-header__title">探索分類</h2>
      <div class="section-header__line"></div>
    </div>

    <div class="categories-grid">
      <RouterLink
        v-for="(category, index) in homeCategories"
        :key="category.ID"
        :to="{ path: '/products', query: { category: category.Name } }"
        :class="['cat-card', `cat-card--${['a', 'b', 'c'][index % 3]}`]"
      >
        <div class="cat-card__content">
          <p class="cat-card__tag">Category {{ String(index + 1).padStart(2, '0') }}</p>
          <h3 class="cat-card__title">{{ category.Name }}</h3>
          <p class="cat-card__desc">瀏覽 {{ category.Name }} 精選商品</p>
          <span class="cat-card__link">Shop Now →</span>
        </div>
      </RouterLink>
    </div>
  </section>

  <!-- Admin shortcut -->
  <RouterLink
    v-if="auth.canEnterAdmin"
    to="/admin"
    class="admin-fab"
    title="管理後台"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </RouterLink>

  <!-- ════════════════════════════════
       BRAND STORY
  ════════════════════════════════ -->
  <section class="section-story">
    <div class="story-inner">
      <p class="story-eyebrow">Our Story</p>
      <h2 class="story-title">穿上你喜歡的自己</h2>
      <p class="story-text">
        Aley's Wardrobe 精選來自日本、韓國的當季服飾，<br class="d-none d-md-block">
        每一件都是風格的延伸，每一套都是生活的態度。<br class="d-none d-md-block">
        我們相信，好的穿著能讓你更靠近理想中的自己。
      </p>
      <RouterLink to="/products" class="hero__cta">開始購物</RouterLink>
    </div>
  </section>
</template>

<style scoped>
/* ── Hero ────────────────────────────────────────────────── */
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

.hero__left {
  background: var(--fe-cream);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120px 60px 80px;
}

.hero__right {
  background: var(--fe-linen);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120px 60px 80px;
}

.hero__content { max-width: 420px; }

.hero__eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 20px;
}

.hero__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  margin: 0 0 24px;
  line-height: 1.05;
}

.hero__title--light {
  display: block;
  font-size: clamp(52px, 8vw, 90px);
  font-weight: 400;
  font-style: italic;
  color: var(--fe-muted);
}

.hero__title--bold {
  display: block;
  font-size: clamp(72px, 11vw, 130px);
  font-weight: 600;
  color: var(--fe-text);
  line-height: 0.9;
}

.hero__divider {
  width: 40px;
  height: 1px;
  background: var(--fe-gold);
  margin: 0 0 24px;
}

.hero__sub {
  font-size: 14px;
  color: var(--fe-muted);
  line-height: 1.8;
  margin: 0 0 36px;
}

.hero__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  border-bottom: 1px solid var(--fe-text);
  padding-bottom: 4px;
  transition: gap 0.25s, color 0.2s, border-color 0.2s;
}

.hero__cta:hover {
  gap: 14px;
  color: var(--fe-gold-d);
  border-color: var(--fe-gold-d);
}

/* Decorative fallback */
.hero__deco {
  position: relative;
  width: 100%;
  max-width: 360px;
  aspect-ratio: 3/4;
}
.hero__deco-frame {
  width: 100%;
  height: 100%;
  border: 1px solid var(--fe-border);
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 24px;
}
.hero__deco-label {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 13px;
  font-style: italic;
  letter-spacing: 0.08em;
  color: var(--fe-muted);
}
.hero__deco-dots {
  position: absolute;
  top: 28px;
  right: 28px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.hero__deco-dots span {
  width: 4px;
  height: 4px;
  background: var(--fe-gold);
  border-radius: 50%;
  opacity: 0.6;
}
.hero__deco-tag {
  position: absolute;
  bottom: -20px;
  right: -20px;
  background: var(--fe-gold);
  color: #fff;
  padding: 18px 20px;
  font-size: 12px;
  letter-spacing: 0.08em;
  line-height: 1.7;
  font-weight: 500;
}

/* ── Hero frame: filled mode (banner inside) ─────────────── */
.hero__deco-frame {
  position: relative;
  overflow: visible;
}

.hero__deco-frame--filled {
  overflow: hidden;
  padding: 0;
  display: block;
}

.hero-frame-img {
  display: block;
  position: absolute;
  inset: 0;
  text-decoration: none;
}
.hero-frame-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Carousel dots inside frame */
.hero-dots {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 2;
}
.hero-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.8);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s, transform 0.2s;
}
.hero-dot--active {
  background: #fff;
  transform: scale(1.3);
}

/* Hero fade transition */
.hfade-enter-active,
.hfade-leave-active { transition: opacity 0.6s ease; }
.hfade-enter-from,
.hfade-leave-to { opacity: 0; }

/* Hero mobile */
@media (max-width: 767px) {
  .hero { grid-template-columns: 1fr; min-height: auto; }
  .hero__right { display: none; }
  .hero__left { padding: 120px 28px 72px; }
  .hero__title--light { font-size: 48px; }
  .hero__title--bold { font-size: 72px; }
}

/* ── Ticker ──────────────────────────────────────────────── */
.ticker {
  background: var(--fe-text);
  color: rgba(255,255,255,0.55);
  overflow: hidden;
  padding: 12px 0;
}
.ticker__track {
  display: inline-flex;
  white-space: nowrap;
  animation: ticker-scroll 30s linear infinite;
  font-size: 11px;
  letter-spacing: 0.12em;
}
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ── Home Banner strip ───────────────────────────────────── */
.hbanner {
  width: 100%;
  background: #f5ede2;
  position: relative;
}
.hbanner__wrap {
  position: relative;
  width: 100%;
  line-height: 0;
}
.hbanner__item {
  display: block;
  width: 100%;
  text-decoration: none;
}
.hbanner__img {
  width: 100%;
  height: auto;
  max-height: 420px;
  object-fit: cover;
  display: block;
}
.hbanner__dots {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 2;
}
.hbanner__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.8);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s, transform 0.2s;
}
.hbanner__dot--active {
  background: #fff;
  transform: scale(1.25);
}

/* Banner fade transition */
.bfade-enter-active,
.bfade-leave-active { transition: opacity 0.7s ease; }
.bfade-enter-from,
.bfade-leave-to { opacity: 0; }

/* ── Section shared ──────────────────────────────────────── */
.section-products,
.section-categories {
  padding: 96px 36px;
  max-width: 1400px;
  margin: 0 auto;
}

.section-header { text-align: center; margin-bottom: 56px; }

.section-header__eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 12px;
}

.section-header__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 500;
  margin: 0 0 16px;
}

.section-header__line {
  width: 36px;
  height: 1px;
  background: var(--fe-gold);
  margin: 0 auto;
}

/* ── Products grid ───────────────────────────────────────── */
.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 1199px) { .products-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 767px)  { .products-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }

.product-card {
  text-decoration: none;
  color: var(--fe-text);
  display: block;
}

.product-card__img-wrap {
  position: relative;
  aspect-ratio: 3/4;
  overflow: hidden;
  background: var(--fe-linen);
  margin-bottom: 14px;
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.product-card:hover .product-card__img { transform: scale(1.04); }

.product-card__img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fe-border);
}

.product-card__overlay {
  position: absolute;
  inset: 0;
  background: rgba(28,23,20,0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.product-card:hover .product-card__overlay { opacity: 1; }
.product-card__overlay span {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.7);
  padding: 10px 20px;
}

.product-card__badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: var(--fe-gold-d);
  color: #fff;
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 4px 9px;
}

.product-card__name {
  font-size: 13.5px;
  font-weight: 400;
  margin: 0 0 6px;
  line-height: 1.4;
}

.product-card__price-row { display: flex; align-items: center; gap: 8px; }
.product-card__origin { font-size: 12px; color: var(--fe-muted); text-decoration-color: var(--fe-muted); }
.product-card__price { font-size: 14px; font-weight: 500; color: var(--fe-text); }

/* Skeleton */
.skeleton-box {
  background: linear-gradient(90deg, var(--fe-linen) 25%, var(--fe-cream) 50%, var(--fe-linen) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skeleton-text {
  height: 12px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--fe-linen) 25%, var(--fe-cream) 50%, var(--fe-linen) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 8px;
  width: 80%;
}
.skeleton-text--lg { width: 60%; height: 14px; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.products-empty {
  text-align: center;
  padding: 80px 0;
  color: var(--fe-muted);
  font-size: 14px;
  letter-spacing: 0.06em;
}

.section-cta { text-align: center; margin-top: 56px; }
.btn-outline {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  border: 1px solid var(--fe-border);
  padding: 14px 40px;
  transition: border-color 0.25s, background 0.25s;
}
.btn-outline:hover { border-color: var(--fe-text); background: var(--fe-cream); }

/* ── Categories ──────────────────────────────────────────── */
.section-categories {
  background: var(--fe-cream);
  max-width: 100%;
  padding: 96px 36px;
}
.section-categories .section-header { max-width: 1400px; margin: 0 auto 56px; }

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 420px));
  justify-content: center;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
@media (max-width: 767px) { .categories-grid { grid-template-columns: 1fr; } }

.cat-card {
  aspect-ratio: 3/4;
  display: flex;
  align-items: flex-end;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s;
}
.cat-card:hover { transform: translateY(-4px); }
.cat-card--a { background: linear-gradient(145deg, #E8DDD0 0%, #C9B99E 100%); }
.cat-card--b { background: linear-gradient(145deg, #D6CBBC 0%, #B8A48A 100%); }
.cat-card--c { background: linear-gradient(145deg, #C8B8A4 0%, #9E8870 100%); }

.cat-card__content { padding: 28px; position: relative; z-index: 1; }
.cat-card__tag { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(28,23,20,0.5); margin: 0 0 8px; }
.cat-card__title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; font-weight: 500; color: var(--fe-text); margin: 0 0 6px; line-height: 1.2; }
.cat-card__desc { font-size: 12.5px; color: rgba(28,23,20,0.65); margin: 0 0 16px; line-height: 1.6; }
.cat-card__link { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fe-text); border-bottom: 1px solid rgba(28,23,20,0.4); padding-bottom: 2px; }

/* ── Brand Story ─────────────────────────────────────────── */
.section-story { padding: 120px 36px; text-align: center; }
.story-inner { max-width: 600px; margin: 0 auto; }
.story-eyebrow { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--fe-gold-d); margin: 0 0 16px; }
.story-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(36px, 5vw, 52px); font-weight: 500; font-style: italic; margin: 0 0 28px; line-height: 1.2; }
.story-text { font-size: 14px; color: var(--fe-muted); line-height: 2; margin: 0 0 44px; }

/* ── Admin FAB ───────────────────────────────────────────── */
.admin-fab {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 44px;
  height: 44px;
  background: rgba(28, 23, 20, 0.82);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  z-index: 200;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.admin-fab:hover {
  background: rgba(28, 23, 20, 1);
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.26);
}
</style>
