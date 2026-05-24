<script setup>
import { onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const cart = useCartStore()
const auth = useAuthStore()

onMounted(async () => {
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }
  if (cart.isEmpty && !cart.cartId) {
    await cart.fetchCart()
  }
  cart.initSelection()
})
</script>

<template>
  <div class="cart-root">
    <div class="cart-header">
      <p class="cart-header__eyebrow">Shopping Cart</p>
      <h1 class="cart-header__title">購物車</h1>
    </div>

    <!-- Loading -->
    <div v-if="cart.isLoading" class="cart-loading">
      <div class="cart-spinner"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="cart.isEmpty" class="cart-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      <p class="cart-empty__text">購物車是空的</p>
      <RouterLink to="/products" class="cart-empty__link">探索商品 →</RouterLink>
    </div>

    <!-- Cart content -->
    <div v-else class="cart-layout">

      <!-- Items list -->
      <div class="cart-items">
        <div class="cart-items__header">
          <span></span>
          <span></span>
          <span>商品</span>
          <span class="d-hide-sm">單價</span>
          <span>數量</span>
          <span class="d-hide-sm">小計</span>
          <span></span>
        </div>

        <div
          v-for="item in cart.items"
          :key="item.id"
          class="cart-item"
          :class="{ 'cart-item--unchecked': item.isPreOrder && !cart.selectedItemIds.includes(item.id) }"
        >
          <!-- 現貨：鎖頭（不可取消）；預購：勾選框（可選擇本次是否結帳） -->
          <div class="cart-item__check">
            <svg
              v-if="!item.isPreOrder"
              class="cart-item__lock"
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              title="現貨商品已鎖定，無法取消"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              v-else
              type="checkbox"
              class="cart-item__checkbox"
              :checked="cart.selectedItemIds.includes(item.id)"
              @change="cart.toggleSelection(item.id)"
            />
          </div>

          <!-- Image -->
          <div class="cart-item__img-wrap">
            <RouterLink :to="`/products/${item.productId}`">
              <video
                v-if="item.imgType === 'video' && item.imgUrl"
                :src="item.imgUrl"
                class="cart-item__img"
                muted
                preload="metadata"
              />
              <img
                v-else-if="item.imgUrl"
                :src="item.imgUrl"
                :alt="item.productName"
                class="cart-item__img"
              />
              <div v-else class="cart-item__no-img">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
              </div>
            </RouterLink>
          </div>

          <!-- Product info -->
          <div class="cart-item__info">
            <RouterLink :to="`/products/${item.productId}`" class="cart-item__name">
              {{ item.productName }}
            </RouterLink>
            <p class="cart-item__variant">
              <span v-if="item.colorName">{{ item.colorName }}</span>
              <span v-if="item.colorName && item.sizeName"> / </span>
              <span v-if="item.sizeName">{{ item.sizeName }}</span>
            </p>
            <p v-if="item.isPreOrder" class="cart-item__preorder">
              預購
              <span v-if="item.preOrderShipDate">· 預計 {{ item.preOrderShipDate }} 出貨</span>
            </p>
            <!-- Mobile price -->
            <p class="cart-item__price-mobile">NT$ {{ item.unitPrice.toLocaleString() }}</p>
          </div>

          <!-- Unit price (desktop) -->
          <div class="cart-item__price d-hide-sm">
            NT$ {{ item.unitPrice.toLocaleString() }}
          </div>

          <!-- Qty controls（只有預購商品可以改數量） -->
          <div class="cart-item__qty">
            <button
              class="qty-btn"
              :disabled="!item.isPreOrder || item.qty <= 1"
              @click="cart.updateQty(item.id, item.qty - 1)"
            >−</button>
            <span class="qty-num">{{ item.qty }}</span>
            <button
              class="qty-btn"
              :disabled="!item.isPreOrder || item.qty >= 99"
              @click="cart.updateQty(item.id, item.qty + 1)"
            >+</button>
          </div>

          <!-- Subtotal (desktop) -->
          <div class="cart-item__subtotal d-hide-sm">
            NT$ {{ (item.unitPrice * item.qty).toLocaleString() }}
          </div>

          <!-- Remove（只有預購商品才能刪除） -->
          <button v-if="item.isPreOrder" class="cart-item__remove" @click="cart.removeItem(item.id)" aria-label="移除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Order summary -->
      <div class="cart-summary">
        <h2 class="cart-summary__title">訂單摘要</h2>

        <div class="cart-summary__row">
          <span>已選商品</span>
          <span>NT$ {{ cart.selectedTotal.toLocaleString() }}</span>
        </div>
        <div class="cart-summary__row">
          <span>運費</span>
          <span class="cart-summary__shipping-tbd">結帳時選擇</span>
        </div>

        <div class="cart-summary__divider"></div>

        <div class="cart-summary__row cart-summary__row--total">
          <span>小計</span>
          <span>NT$ {{ cart.selectedTotal.toLocaleString() }}</span>
        </div>

        <button
          class="cart-summary__checkout-btn"
          :disabled="cart.selectedItemIds.length === 0"
          @click="router.push('/checkout')"
        >
          前往結帳
        </button>

        <RouterLink to="/products" class="cart-summary__continue">
          ← 繼續購物
        </RouterLink>
      </div>

    </div>
  </div>
</template>

<style scoped>
.cart-root {
  padding-top: 68px;
  min-height: 80vh;
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 36px;
  padding-right: 36px;
  padding-bottom: 96px;
}

/* Header */
.cart-header {
  padding: 48px 0 40px;
  text-align: center;
}

.cart-header__eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fe-gold-d);
  margin: 0 0 10px;
}

.cart-header__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 500;
  margin: 0;
  color: var(--fe-text);
}

/* Loading */
.cart-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40vh;
}

.cart-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fe-border);
  border-top-color: var(--fe-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Empty */
.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  gap: 16px;
  color: var(--fe-muted);
}

.cart-empty__text {
  font-size: 14px;
  letter-spacing: 0.06em;
  margin: 0;
}

.cart-empty__link {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  border-bottom: 1px solid var(--fe-border);
  padding-bottom: 2px;
  transition: border-color 0.2s;
}

.cart-empty__link:hover { border-color: var(--fe-text); }

/* Layout */
.cart-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 48px;
  align-items: start;
}

/* Items section */
.cart-items__header {
  display: grid;
  grid-template-columns: 24px 88px 1fr 120px 100px 80px 36px;
  gap: 16px;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--fe-border);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-muted);
  align-items: center;
}

.cart-item {
  display: grid;
  grid-template-columns: 24px 88px 1fr 120px 100px 80px 36px;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid var(--fe-linen);
  align-items: center;
  transition: opacity 0.2s;
}

.cart-item--unchecked { opacity: 0.4; }

.cart-item__check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-item__checkbox {
  width: 15px;
  height: 15px;
  accent-color: var(--fe-text);
  cursor: pointer;
}

.cart-item__lock {
  color: var(--fe-muted);
  opacity: 0.45;
}

/* Item image */
.cart-item__img-wrap {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  background: var(--fe-linen);
  overflow: hidden;
}

.cart-item__img-wrap a {
  display: block;
  width: 100%;
  height: 100%;
}

.cart-item__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cart-item__no-img {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Item info */
.cart-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fe-text);
  text-decoration: none;
  display: block;
  margin-bottom: 5px;
  line-height: 1.4;
  transition: color 0.15s;
}

.cart-item__name:hover { color: var(--fe-gold-d); }

.cart-item__variant {
  font-size: 11.5px;
  color: var(--fe-muted);
  margin: 0;
  letter-spacing: 0.04em;
}

.cart-item__preorder {
  font-size: 11px;
  color: var(--fe-gold-d);
  margin: 4px 0 0;
  letter-spacing: 0.04em;
}

.cart-item__price-mobile {
  display: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 6px 0 0;
}

/* Unit price */
.cart-item__price {
  font-size: 13px;
  color: var(--fe-muted);
}

/* Qty controls */
.cart-item__qty {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--fe-border);
  width: fit-content;
}

.qty-btn {
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fe-text);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}

.qty-btn:hover:not(:disabled) { background: var(--fe-linen); }
.qty-btn:disabled { color: var(--fe-border); cursor: not-allowed; }

.qty-num {
  min-width: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--fe-text);
  border-left: 1px solid var(--fe-border);
  border-right: 1px solid var(--fe-border);
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Subtotal */
.cart-item__subtotal {
  font-size: 13px;
  font-weight: 500;
  color: var(--fe-text);
}

/* Remove button */
.cart-item__remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fe-muted);
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.cart-item__remove:hover { color: #DC2626; }

/* Order summary */
.cart-summary {
  position: sticky;
  top: 88px;
  background: var(--fe-cream);
  padding: 28px 24px;
  border: 1px solid var(--fe-border);
}

.cart-summary__title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 24px;
  color: var(--fe-text);
}

.cart-summary__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--fe-muted);
  margin-bottom: 12px;
}

.cart-summary__shipping-tbd {
  font-size: 12px;
  color: var(--fe-muted);
  font-style: italic;
}

.cart-summary__divider {
  height: 1px;
  background: var(--fe-border);
  margin: 16px 0;
}

.cart-summary__row--total {
  font-size: 15px;
  font-weight: 600;
  color: var(--fe-text);
  margin-bottom: 24px;
}

.cart-summary__checkout-btn {
  display: block;
  width: 100%;
  padding: 14px;
  background: var(--fe-text);
  color: #fff;
  text-align: center;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border: 1px solid var(--fe-text);
  transition: background 0.2s, color 0.2s;
  margin-bottom: 14px;
}

.cart-summary__checkout-btn:hover:not(:disabled) {
  background: transparent;
  color: var(--fe-text);
}

.cart-summary__checkout-btn:disabled {
  background: var(--fe-linen);
  border-color: var(--fe-border);
  color: var(--fe-muted);
  cursor: not-allowed;
}

.cart-summary__continue {
  display: block;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--fe-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.cart-summary__continue:hover { color: var(--fe-text); }

/* Responsive helpers */
.d-hide-sm { display: block; }

@media (max-width: 767px) {
  .cart-root {
    padding-left: 16px;
    padding-right: 16px;
  }

  .cart-layout {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .cart-summary {
    position: static;
  }

  .cart-items__header {
    display: none;
  }

  .cart-item {
    grid-template-columns: 24px 88px 1fr 36px;
    grid-template-rows: auto auto;
  }

  .cart-item__check {
    grid-row: 1 / 3;
  }

  .cart-item__img-wrap {
    grid-row: 1 / 3;
  }

  .cart-item__info {
    grid-column: 3;
    grid-row: 1;
  }

  .cart-item__qty {
    grid-column: 3;
    grid-row: 2;
  }

  .cart-item__remove {
    grid-column: 4;
    grid-row: 1;
    align-self: start;
  }

  .d-hide-sm { display: none; }

  .cart-item__price-mobile { display: block; }
}
</style>
