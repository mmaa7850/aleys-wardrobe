<script setup>
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  mobileOpen: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const logout = async () => {
  await auth.signOut();
  router.push("/login");
};

const allSections = [
  {
    key: "dashboard",
    labelKey: "admin.sidebar.dashboard",
    to: "/admin",
    icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  },
  {
    key: "products",
    labelKey: "admin.sidebar.products",
    permission: "CanManageProducts",
    icon: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
    children: [
      { labelKey: "admin.sidebar.productList", to: "/admin/products" },
      { labelKey: "admin.sidebar.categories", to: "/admin/products/setcategories" },
      { labelKey: "admin.sidebar.tags", to: "/admin/products/settags" },
      { labelKey: "admin.sidebar.colors", to: "/admin/products/setcolors" },
      { labelKey: "admin.sidebar.sizes", to: "/admin/products/setsizes" },
    ],
  },
  {
    key: "orders",
    labelKey: "admin.sidebar.orders",
    permission: "CanManageOrders",
    icon: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
    children: [
      { labelKey: "admin.sidebar.orderList",   to: "/admin/orders" },
      { labelKey: "admin.sidebar.pendingList", to: "/admin/orders/pending" },
      { labelKey: "admin.sidebar.status",      to: "/admin/orders/setstatus" },
    ],
  },
  {
    key: "live",
    labelKey: "admin.sidebar.live",
    permission: "CanManageOrders",
    icon: `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`,
    children: [
      { labelKey: "admin.sidebar.liveSessions", to: "/admin/live" },
    ],
  },
  {
    key: "inventory",
    labelKey: "admin.sidebar.inventory",
    permission: "CanManageProducts",
    icon: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
    children: [
      { labelKey: "admin.sidebar.stockOverview", to: "/admin/inventory/overview" },
      { labelKey: "admin.sidebar.stockLogs",     to: "/admin/inventory/logs" },
      { labelKey: "admin.sidebar.purchases",          to: "/admin/inventory/purchases" },
      { labelKey: "admin.sidebar.consumables",        to: "/admin/inventory/consumables" },
      { labelKey: "admin.sidebar.consumablePurchases",to: "/admin/inventory/consumable-purchases" },
      { labelKey: "admin.sidebar.suppliers",          to: "/admin/inventory/suppliers" },
      { labelKey: "admin.sidebar.costTypes",          to: "/admin/inventory/setcosttypes" },
    ],
  },
  {
    key: "finance",
    labelKey: "admin.sidebar.finance",
    permission: "CanManageSettings",
    icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
    children: [
      { labelKey: "admin.sidebar.monthlyExpenses",    to: "/admin/finance/monthly-expenses" },
      { labelKey: "admin.sidebar.expenseCategories",  to: "/admin/finance/expense-categories" },
    ],
  },
  {
    key: "reports",
    labelKey: "admin.sidebar.reports",
    icon: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
    children: [
      { labelKey: "admin.sidebar.reportSales",      to: "/admin/reports/sales" },
      { labelKey: "admin.sidebar.reportProducts",   to: "/admin/reports/products" },
      { labelKey: "admin.sidebar.reportCoupons",    to: "/admin/reports/coupons" },
      { labelKey: "admin.sidebar.reportOrders",     to: "/admin/reports/orders" },
      { labelKey: "admin.sidebar.reportMembers",    to: "/admin/reports/members" },
      { labelKey: "admin.sidebar.reportAnalytics",  to: "/admin/reports/analytics" },
      { labelKey: "admin.sidebar.reportProfit",     to: "/admin/reports/profit" },
      { labelKey: "admin.sidebar.reportStoreProfit",to: "/admin/reports/store-profit" },
    ],
  },
  {
    key: "marketing",
    labelKey: "admin.sidebar.marketing",
    permission: "CanManageMarketing",
    icon: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    children: [
      { labelKey: "admin.sidebar.coupons", to: "/admin/marketing/setcoupons" },
      { labelKey: "admin.sidebar.banners", to: "/admin/marketing/setbanners" },
    ],
  },
  {
    key: "members",
    labelKey: "admin.sidebar.members",
    permission: "CanManageMembers",
    icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    children: [
      { labelKey: "admin.sidebar.memberList", to: "/admin/members" },
      { labelKey: "admin.sidebar.memberLevels", to: "/admin/members/levels" },
      { labelKey: "admin.sidebar.wallet", to: "/admin/wallet" },
    ],
  },
  {
    key: "settings",
    labelKey: "admin.sidebar.settings",
    permission: "CanManageSettings",
    icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
    children: [
      { labelKey: "admin.sidebar.payMethods", to: "/admin/settings/setpaymethods" },
      { labelKey: "admin.sidebar.shippingMethods", to: "/admin/settings/setshippingmethods" },
      { labelKey: "admin.sidebar.configCategories", to: "/admin/settings/setconfigcategories" },
      { labelKey: "admin.sidebar.config", to: "/admin/settings/setconfig" },
    ],
  },
];

const sections = computed(() => {
  const hasAccess = (perm) =>
    auth.isActive && (auth.isAdmin || auth.permissions[perm] === true);

  return allSections
    .filter((s) => !s.permission || hasAccess(s.permission))
    .map((s) => {
      if (s.key !== "settings") return s;
      const adminItem = { labelKey: "admin.sidebar.adminUsers", to: "/admin/settings/admin-users" };
      const base = s.children.filter((c) => c.to !== adminItem.to);
      return { ...s, children: auth.isAdmin ? [...base, adminItem] : base };
    });
});

const openKey = ref(null);

const isPathInSection = (section) =>
  section.children?.some((c) => route.path.startsWith(c.to));

watch(
  () => route.path,
  () => {
    const hit = sections.value.find(isPathInSection);
    if (hit) openKey.value = hit.key;
  },
  { immediate: true }
);

const toggle = (key) => {
  openKey.value = openKey.value === key ? null : key;
};

const isOpen = (key) => openKey.value === key;

const activeSectionKey = computed(() => {
  const hit = sections.value.find((s) => s.to === route.path || isPathInSection(s));
  return hit?.key;
});

const onNavClick = () => {
  emit("close");
};
</script>

<template>
  <aside class="asb-sidebar" :class="{ open: mobileOpen }">

    <!-- Brand -->
    <div class="asb-brand">
      <RouterLink to="/" class="asb-brand__link" title="前往前台">
        <span class="asb-brand__name">Aley's Wardrobe</span>
        <span class="asb-brand__sub">Admin Panel</span>
      </RouterLink>
      <button class="asb-close d-lg-none" @click="emit('close')" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Nav -->
    <nav class="asb-nav">
      <div v-for="s in sections" :key="s.key" class="asb-nav__group">

        <!-- Section with children -->
        <button
          v-if="s.children"
          class="asb-nav__btn"
          :class="{ 'asb-nav__btn--active': activeSectionKey === s.key }"
          @click="toggle(s.key)"
        >
          <svg v-if="s.icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" v-html="s.icon" class="asb-nav__icon" />
          <span>{{ t(s.labelKey) }}</span>
          <svg class="asb-nav__chevron" :class="{ 'asb-nav__chevron--open': isOpen(s.key) }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <!-- Single link -->
        <RouterLink
          v-else
          :to="s.to"
          class="asb-nav__btn"
          :class="{ 'asb-nav__btn--active': route.path === s.to }"
          @click="onNavClick"
        >
          <svg v-if="s.icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" v-html="s.icon" class="asb-nav__icon" />
          <span>{{ t(s.labelKey) }}</span>
        </RouterLink>

        <!-- Children -->
        <Transition name="asb-collapse">
          <div v-if="s.children && isOpen(s.key)" class="asb-nav__children">
            <RouterLink
              v-for="c in s.children"
              :key="c.to"
              :to="c.to"
              class="asb-nav__child"
              :class="{ 'asb-nav__child--active': route.path.startsWith(c.to) }"
              @click="onNavClick"
            >
              {{ t(c.labelKey) }}
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>

    <!-- Bottom -->
    <div class="asb-bottom">
      <div class="asb-bottom__email">{{ auth.user?.email }}</div>
      <button class="asb-logout" @click="logout">登出</button>
    </div>

  </aside>
</template>

<style scoped>
.asb-sidebar {
  width: 240px;
  min-height: 100vh;
  background: #1a1714;
  display: flex;
  flex-direction: column;
  transition: transform 0.28s ease;
  flex-shrink: 0;
}

@media (max-width: 991.98px) {
  .asb-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1100;
    transform: translateX(-100%);
  }
  .asb-sidebar.open {
    transform: translateX(0);
  }
}

@media (min-width: 992px) {
  .asb-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    transform: none !important;
  }
}

/* Brand */
.asb-brand {
  padding: 24px 20px 20px;
  border-bottom: 1px solid rgba(200,168,130,0.12);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.asb-brand__link {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-decoration: none;
}

.asb-brand__name {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 17px;
  font-weight: 600;
  color: #e8ddd0;
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.asb-brand__sub {
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #C8A882;
}

.asb-close {
  background: none;
  border: none;
  color: rgba(232,221,208,0.5);
  cursor: pointer;
  padding: 2px;
  margin-top: 2px;
  line-height: 1;
}

.asb-close:hover { color: #e8ddd0; }

/* Nav */
.asb-nav {
  flex: 1;
  padding: 16px 10px;
  overflow-y: auto;
  overflow-x: hidden;
}

.asb-nav__group {
  margin-bottom: 2px;
}

.asb-nav__btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: none;
  color: rgba(232,221,208,0.65);
  font-size: 12.5px;
  font-family: inherit;
  letter-spacing: 0.02em;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.18s, background 0.18s;
  text-align: left;
}

.asb-nav__btn:hover {
  color: #e8ddd0;
  background: rgba(200,168,130,0.08);
}

.asb-nav__btn--active {
  color: #C8A882;
  background: rgba(200,168,130,0.1);
}

.asb-nav__icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.asb-nav__btn--active .asb-nav__icon {
  opacity: 1;
}

.asb-nav__chevron {
  margin-left: auto;
  flex-shrink: 0;
  transition: transform 0.25s ease;
  opacity: 0.5;
}

.asb-nav__chevron--open {
  transform: rotate(180deg);
}

/* Children */
.asb-nav__children {
  padding: 4px 0 6px 34px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.asb-nav__child {
  display: block;
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(232,221,208,0.5);
  text-decoration: none;
  border-radius: 3px;
  border-left: 1.5px solid transparent;
  transition: color 0.18s, border-color 0.18s, background 0.18s;
  letter-spacing: 0.01em;
}

.asb-nav__child:hover {
  color: rgba(232,221,208,0.85);
  background: rgba(200,168,130,0.06);
}

.asb-nav__child--active {
  color: #C8A882;
  border-left-color: #C8A882;
  background: rgba(200,168,130,0.08);
}

/* Collapse animation */
.asb-collapse-enter-active,
.asb-collapse-leave-active {
  transition: max-height 0.28s ease, opacity 0.28s ease;
  overflow: hidden;
}
.asb-collapse-enter-from,
.asb-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
.asb-collapse-enter-to,
.asb-collapse-leave-from {
  max-height: 320px;
  opacity: 1;
}

/* Bottom */
.asb-bottom {
  padding: 16px 20px;
  border-top: 1px solid rgba(200,168,130,0.12);
}

.asb-bottom__email {
  font-size: 11px;
  color: rgba(232,221,208,0.35);
  margin-bottom: 10px;
  word-break: break-all;
  letter-spacing: 0.02em;
}

.asb-logout {
  width: 100%;
  padding: 8px 0;
  background: none;
  border: 1px solid rgba(200,168,130,0.25);
  border-radius: 3px;
  color: rgba(232,221,208,0.5);
  font-size: 11.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.18s;
  font-family: inherit;
}

.asb-logout:hover {
  border-color: #C8A882;
  color: #C8A882;
}
</style>
