<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const cart = useCartStore()
const wishlist = useWishlistStore()
const router = useRouter()
const isScrolled = ref(false)
const mobileMenuOpen = ref(false)
const memberMenuOpen = ref(false)
const memberBtnRef = ref(null)

const userInitial = computed(() => {
  const email = auth.user?.email || ''
  return email.charAt(0).toUpperCase() || '?'
})

function onScroll() {
  isScrolled.value = window.scrollY > 60
}

function onDocClick(e) {
  if (memberBtnRef.value && !memberBtnRef.value.contains(e.target)) {
    memberMenuOpen.value = false
  }
}

async function onSignOut() {
  memberMenuOpen.value = false
  mobileMenuOpen.value = false
  cart.reset()
  wishlist.reset()
  await auth.signOut()
  router.push('/')
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', onDocClick)
  if (auth.isLoggedIn) {
    cart.fetchCart()
  }
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="fe-root">
    <!-- ── Navbar ── -->
    <nav :class="['fe-nav', { 'fe-nav--scrolled': isScrolled }]">
      <div class="fe-nav__inner">
        <!-- Hamburger (mobile) -->
        <button class="fe-nav__toggle d-lg-none" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="選單">
          <span class="t-bar" :class="{ open: mobileMenuOpen }"></span>
          <span class="t-bar t-bar--mid" :class="{ open: mobileMenuOpen }"></span>
          <span class="t-bar" :class="{ open: mobileMenuOpen }"></span>
        </button>

        <!-- Left links -->
        <ul class="fe-nav__links d-none d-lg-flex">
          <li><RouterLink to="/">首頁</RouterLink></li>
          <li><RouterLink to="/products">新品上市</RouterLink></li>
          <li><RouterLink to="/products?category=tops">上衣</RouterLink></li>
          <li><RouterLink to="/products?category=bottoms">下著</RouterLink></li>
          <li><RouterLink to="/products?category=dress">洋裝</RouterLink></li>
        </ul>

        <!-- Brand (centered) -->
        <RouterLink to="/" class="fe-nav__brand">Aley's Wardrobe</RouterLink>

        <!-- Right actions -->
        <div class="fe-nav__actions">
          <button class="fe-icon-btn" aria-label="搜尋">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>

          <!-- Member: 未登入 → 直接跳轉；已登入 → 下拉選單 -->
          <div class="fe-nav__member-wrap" ref="memberBtnRef">
            <RouterLink v-if="!auth.isLoggedIn" to="/login" class="fe-icon-btn" aria-label="登入">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </RouterLink>
            <button v-else class="fe-avatar-btn" @click="memberMenuOpen = !memberMenuOpen" aria-label="會員選單">
              {{ userInitial }}
            </button>
            <div v-if="memberMenuOpen" class="fe-member-menu">
              <div class="fe-member-menu__email">{{ auth.user?.email }}</div>
              <RouterLink to="/account" class="fe-member-menu__item" @click="memberMenuOpen = false">我的帳號</RouterLink>
              <RouterLink to="/wishlist" class="fe-member-menu__item" @click="memberMenuOpen = false">我的喜好清單</RouterLink>
              <RouterLink v-if="!auth.canEnterAdmin" to="/coupons" class="fe-member-menu__item" @click="memberMenuOpen = false">優惠券專區</RouterLink>
              <button class="fe-member-menu__item fe-member-menu__item--danger" @click="onSignOut">登出</button>
            </div>
          </div>

          <RouterLink to="/cart" class="fe-icon-btn fe-cart-btn-wrap" aria-label="購物車">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span v-if="cart.itemCount > 0" class="fe-cart-badge">{{ cart.itemCount > 99 ? '99+' : cart.itemCount }}</span>
          </RouterLink>
        </div>
      </div>

      <!-- Mobile drawer -->
      <div :class="['fe-nav__drawer', { 'fe-nav__drawer--open': mobileMenuOpen }]">
        <RouterLink to="/" @click="mobileMenuOpen = false">首頁</RouterLink>
        <RouterLink to="/products" @click="mobileMenuOpen = false">新品上市</RouterLink>
        <RouterLink to="/products?category=tops" @click="mobileMenuOpen = false">上衣</RouterLink>
        <RouterLink to="/products?category=bottoms" @click="mobileMenuOpen = false">下著</RouterLink>
        <RouterLink to="/products?category=dress" @click="mobileMenuOpen = false">洋裝</RouterLink>
        <template v-if="auth.isLoggedIn">
          <RouterLink to="/account" @click="mobileMenuOpen = false">我的帳號</RouterLink>
          <RouterLink v-if="!auth.canEnterAdmin" to="/coupons" @click="mobileMenuOpen = false">優惠券專區</RouterLink>
          <button class="fe-nav__drawer-signout" @click="onSignOut">登出</button>
        </template>
        <RouterLink v-else to="/login" @click="mobileMenuOpen = false">登入 / 註冊</RouterLink>
      </div>
    </nav>

    <main><RouterView /></main>

    <!-- ── Footer ── -->
    <footer class="fe-footer">
      <div class="fe-footer__grid">
        <div>
          <p class="fe-footer__logo">Aley's Wardrobe</p>
          <p class="fe-footer__tagline">探索日韓時尚，<br>找到屬於你的優雅</p>
          <div class="fe-footer__socials">
            <a href="#" aria-label="Instagram" class="fe-social-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="#" aria-label="Facebook" class="fe-social-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <h6>購物指南</h6>
          <RouterLink to="/size-guide">尺寸指南</RouterLink>
          <RouterLink to="/returns">退換貨政策</RouterLink>
          <RouterLink to="/shipping">運費說明</RouterLink>
          <RouterLink to="/faq">常見問題</RouterLink>
          <RouterLink to="/coupons">優惠券專區</RouterLink>
        </div>
        <div>
          <h6>關於我們</h6>
          <RouterLink to="/brand-story">品牌故事</RouterLink>
          <RouterLink to="/contact">聯絡我們</RouterLink>
        </div>
      </div>
      <div class="fe-footer__bottom">© 2025 Aley's Wardrobe. All rights reserved.</div>
    </footer>
  </div>
</template>

<!-- Global: fonts + CSS variables -->
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Sans+TC:wght@300;400;500&display=swap');

:root {
  --fe-white:  #FEFEFE;
  --fe-cream:  #F8F3EE;
  --fe-linen:  #EDE5DA;
  --fe-gold:   #C8A882;
  --fe-gold-d: #A6845A;
  --fe-text:   #1C1714;
  --fe-muted:  #8A7D72;
  --fe-border: #DDD3C6;
}

.fe-root {
  min-height: 100vh;
  background: var(--fe-white);
  font-family: 'Noto Sans TC', system-ui, sans-serif;
  color: var(--fe-text);
}
</style>

<style scoped>
/* ── Navbar ── */
.fe-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  transition: background 0.3s, box-shadow 0.3s;
}

.fe-nav--scrolled {
  background: rgba(254,254,254,0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 var(--fe-border);
}

.fe-nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 36px;
  height: 68px;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
}

.fe-nav__brand {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

.fe-nav__links {
  list-style: none;
  margin: 0; padding: 0;
  gap: 28px;
}

.fe-nav__links a {
  font-size: 11.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.fe-nav__links a:hover { opacity: 1; }

.fe-nav__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fe-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fe-text);
  padding: 9px;
  display: flex;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.fe-icon-btn:hover { opacity: 1; }

/* Cart button with badge */
.fe-cart-btn-wrap {
  position: relative;
  text-decoration: none;
}

.fe-cart-badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--fe-gold-d);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
  pointer-events: none;
}

/* Member avatar + dropdown */
.fe-nav__member-wrap {
  position: relative;
}

.fe-avatar-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid var(--fe-gold);
  background: var(--fe-linen);
  color: var(--fe-gold-d);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
  margin: 0 4px;
}

.fe-avatar-btn:hover {
  background: var(--fe-gold);
  color: #fff;
}

.fe-member-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 180px;
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(28,23,20,0.12);
  overflow: hidden;
  z-index: 200;
}

.fe-member-menu__email {
  padding: 12px 16px 8px;
  font-size: 11.5px;
  color: var(--fe-muted);
  border-bottom: 1px solid var(--fe-linen);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.fe-member-menu__item {
  display: block;
  width: 100%;
  padding: 11px 16px;
  text-align: left;
  font-size: 13px;
  color: var(--fe-text);
  text-decoration: none;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.15s;
  letter-spacing: 0.02em;
}

.fe-member-menu__item:hover { background: var(--fe-cream); }

.fe-member-menu__item--danger { color: #b91c1c; }
.fe-member-menu__item--danger:hover { background: rgba(185,28,28,0.06); }

/* Mobile drawer signout button */
.fe-nav__drawer-signout {
  display: block;
  width: 100%;
  padding: 15px 36px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #b91c1c;
  background: none;
  border: none;
  border-bottom: 1px solid var(--fe-linen);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.fe-nav__drawer-signout:hover { background: var(--fe-cream); }

/* Hamburger */
.fe-nav__toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 1;
}

.t-bar {
  display: block;
  width: 22px;
  height: 1.5px;
  background: var(--fe-text);
  transition: transform 0.25s, opacity 0.25s;
}

.t-bar.open:first-child { transform: translateY(6.5px) rotate(45deg); }
.t-bar--mid.open        { opacity: 0; }
.t-bar.open:last-child  { transform: translateY(-6.5px) rotate(-45deg); }

/* Mobile drawer */
.fe-nav__drawer {
  background: var(--fe-white);
  border-bottom: 1px solid var(--fe-border);
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.35s ease;
}

.fe-nav__drawer--open { max-height: 320px; }

.fe-nav__drawer a {
  display: block;
  padding: 15px 36px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fe-text);
  text-decoration: none;
  border-bottom: 1px solid var(--fe-linen);
  transition: background 0.15s;
}

.fe-nav__drawer a:hover { background: var(--fe-cream); }

/* ── Footer ── */
.fe-footer {
  background: var(--fe-text);
  color: rgba(255,255,255,0.65);
  padding-top: 64px;
}

.fe-footer__grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 48px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 36px 56px;
}

@media (max-width: 767px) {
  .fe-footer__grid { grid-template-columns: 1fr; gap: 36px; }
  .fe-nav__brand { font-size: 16px; }
}

.fe-footer__logo {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fff;
  margin: 0 0 12px;
}

.fe-footer__tagline {
  font-size: 13px;
  line-height: 1.9;
  margin: 0 0 24px;
}

.fe-footer__socials { display: flex; gap: 10px; }

.fe-social-btn {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.65);
  text-decoration: none;
  transition: border-color 0.2s, color 0.2s;
}

.fe-social-btn:hover {
  border-color: var(--fe-gold);
  color: var(--fe-gold);
}

.fe-footer__grid > div h6 {
  font-size: 10.5px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #fff;
  margin: 0 0 18px;
  font-weight: 500;
}

.fe-footer__grid > div a {
  display: block;
  font-size: 13px;
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  margin-bottom: 11px;
  transition: color 0.2s;
}

.fe-footer__grid > div a:hover { color: rgba(255,255,255,0.9); }

.fe-footer__bottom {
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 18px 36px;
  text-align: center;
  font-size: 11.5px;
  color: rgba(255,255,255,0.3);
}
</style>
