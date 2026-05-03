<script setup>
import { ref, onMounted } from 'vue'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

const newArrivals = ref([])
const isLoading = ref(true)

function getImageUrl(storagePath) {
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
  return main ? getImageUrl(main.StoragePath) : null
}

onMounted(async () => {
  const { data } = await db
    .from('C_PRD_ProductList')
    .select(`
      ID, ProductName, Price, OriginPrice,
      C_PRD_ProductPictureList(StoragePath, AltText, IsMain, Type)
    `)
    .or('IsActive.is.null,IsActive.eq.true')
    .order('CreatedDate', { ascending: false })
    .limit(8)

  if (data) newArrivals.value = data
  isLoading.value = false
})
</script>

<template>
  <!-- ══════════════════════════════
       HERO
  ══════════════════════════════ -->
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
    <div class="hero__right">
      <div class="hero__deco">
        <div class="hero__deco-frame">
          <span class="hero__deco-label">New Arrivals</span>
          <div class="hero__deco-dots">
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="hero__deco-tag">
          <p>日韓選品</p>
          <p>品味生活</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════
       TICKER
  ══════════════════════════════ -->
  <div class="ticker">
    <div class="ticker__track">
      <span v-for="n in 4" :key="n">
        NEW ARRIVALS &nbsp;·&nbsp; KOREAN STYLE &nbsp;·&nbsp; JAPANESE FASHION &nbsp;·&nbsp; FREE SHIPPING &nbsp;·&nbsp; ALEY'S WARDROBE &nbsp;·&nbsp;
      </span>
    </div>
  </div>

  <!-- ══════════════════════════════
       NEW ARRIVALS
  ══════════════════════════════ -->
  <section class="section-products">
    <div class="section-header">
      <span class="section-header__eyebrow">New In</span>
      <h2 class="section-header__title">最新上架</h2>
      <div class="section-header__line"></div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="products-grid">
      <div v-for="n in 4" :key="n" class="product-card product-card--skeleton">
        <div class="product-card__img-wrap skeleton-box"></div>
        <div class="product-card__info">
          <div class="skeleton-text skeleton-text--lg"></div>
          <div class="skeleton-text"></div>
        </div>
      </div>
    </div>

    <!-- Product grid -->
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
          <div class="product-card__overlay">
            <span>查看商品</span>
          </div>
          <div v-if="product.OriginPrice && product.OriginPrice > product.Price" class="product-card__badge">
            SALE
          </div>
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

    <!-- Empty state -->
    <div v-else class="products-empty">
      <p>商品即將上架，敬請期待</p>
    </div>

    <div class="section-cta">
      <RouterLink to="/products" class="btn-outline">查看全部商品</RouterLink>
    </div>
  </section>

  <!-- ══════════════════════════════
       CATEGORIES
  ══════════════════════════════ -->
  <section class="section-categories">
    <div class="section-header">
      <span class="section-header__eyebrow">Shop By Style</span>
      <h2 class="section-header__title">探索風格</h2>
      <div class="section-header__line"></div>
    </div>

    <div class="categories-grid">
      <RouterLink to="/products?style=japanese" class="cat-card cat-card--a">
        <div class="cat-card__content">
          <p class="cat-card__tag">Style 01</p>
          <h3 class="cat-card__title">日系穿搭</h3>
          <p class="cat-card__desc">簡約俐落，質感生活</p>
          <span class="cat-card__link">Shop Now →</span>
        </div>
      </RouterLink>

      <RouterLink to="/products?style=korean" class="cat-card cat-card--b">
        <div class="cat-card__content">
          <p class="cat-card__tag">Style 02</p>
          <h3 class="cat-card__title">韓系穿搭</h3>
          <p class="cat-card__desc">時髦有型，引領潮流</p>
          <span class="cat-card__link">Shop Now →</span>
        </div>
      </RouterLink>

      <RouterLink to="/products?category=accessories" class="cat-card cat-card--c">
        <div class="cat-card__content">
          <p class="cat-card__tag">Style 03</p>
          <h3 class="cat-card__title">配件精品</h3>
          <p class="cat-card__desc">點綴造型，完美收尾</p>
          <span class="cat-card__link">Shop Now →</span>
        </div>
      </RouterLink>
    </div>
  </section>

  <!-- ══════════════════════════════
       BRAND STORY
  ══════════════════════════════ -->
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
/* ── Hero ── */
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

/* Decorative right panel */
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

/* Hero mobile */
@media (max-width: 767px) {
  .hero { grid-template-columns: 1fr; min-height: auto; }
  .hero__right { display: none; }
  .hero__left { padding: 120px 28px 72px; }
  .hero__title--light { font-size: 48px; }
  .hero__title--bold { font-size: 72px; }
}

/* ── Ticker ── */
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

/* ── Section shared ── */
.section-products,
.section-categories {
  padding: 96px 36px;
  max-width: 1400px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 56px;
}

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

/* ── Products grid ── */
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

.product-card:hover .product-card__img {
  transform: scale(1.04);
}

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

.product-card__price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.product-card__origin {
  font-size: 12px;
  color: var(--fe-muted);
  text-decoration-color: var(--fe-muted);
}

.product-card__price {
  font-size: 14px;
  font-weight: 500;
  color: var(--fe-text);
}

/* Skeleton */
.product-card--skeleton .product-card__img-wrap {
  animation: shimmer 1.5s infinite;
}

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

.section-cta {
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
  padding: 14px 40px;
  transition: border-color 0.25s, background 0.25s;
}

.btn-outline:hover {
  border-color: var(--fe-text);
  background: var(--fe-cream);
}

/* ── Categories ── */
.section-categories {
  background: var(--fe-cream);
  max-width: 100%;
  padding: 96px 36px;
}

.section-categories .section-header { max-width: 1400px; margin: 0 auto 56px; }

.categories-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .categories-grid { grid-template-columns: 1fr; }
}

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

.cat-card__content {
  padding: 28px;
  position: relative;
  z-index: 1;
}

.cat-card__tag {
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(28,23,20,0.5);
  margin: 0 0 8px;
}

.cat-card__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 30px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0 0 6px;
  line-height: 1.2;
}

.cat-card__desc {
  font-size: 12.5px;
  color: rgba(28,23,20,0.65);
  margin: 0 0 16px;
  line-height: 1.6;
}

.cat-card__link {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-text);
  border-bottom: 1px solid rgba(28,23,20,0.4);
  padding-bottom: 2px;
}

/* ── Brand Story ── */
.section-story {
  padding: 120px 36px;
  text-align: center;
}

.story-inner { max-width: 600px; margin: 0 auto; }

.story-eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 16px;
}

.story-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(36px, 5vw, 52px);
  font-weight: 500;
  font-style: italic;
  margin: 0 0 28px;
  line-height: 1.2;
}

.story-text {
  font-size: 14px;
  color: var(--fe-muted);
  line-height: 2;
  margin: 0 0 44px;
}
</style>
