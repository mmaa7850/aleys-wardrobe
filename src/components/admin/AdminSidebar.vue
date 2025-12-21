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

/* ===== Sidebar 結構（你原本那份照用） ===== */
const sections = [
  // Dashboard
  {
    key: "dashboard",
    labelKey: "admin.sidebar.dashboard",
    to: "/admin",
  },

  // Products
  {
    key: "products",
    labelKey: "admin.sidebar.products",
    children: [
      { labelKey: "admin.sidebar.productList", to: "/admin/products"},
      { labelKey: "admin.sidebar.categories", to: "/admin/products/setcategories" },
      { labelKey: "admin.sidebar.tags", to: "/admin/products/settags" },
      { labelKey: "admin.sidebar.colors", to: "/admin/products/setcolors" },
      { labelKey: "admin.sidebar.sizes", to: "/admin/products/setsizes" },
    ],
  },

  // Orders
  {
    key: "orders",
    labelKey: "admin.sidebar.orders",
    children: [
      { labelKey: "admin.sidebar.orderList", to: "/admin/orders" },
      { labelKey: "admin.sidebar.status", to: "/admin/orders/setstatus" },
    ],
  },

  // Inventory（庫存）
  {
    key: "inventory",
    labelKey: "admin.sidebar.inventory",
    children: [
      { labelKey: "admin.sidebar.stockOverview", to: "/admin/inventory/overview" },
      { labelKey: "admin.sidebar.stockLogs", to: "/admin/inventory/logs" },
    ],
  },

  // Marketing（行銷）
  {
    key: "marketing",
    labelKey: "admin.sidebar.marketing",
    children: [
      { labelKey: "admin.sidebar.coupons", to: "/admin/marketing/setcoupons" },
      { labelKey: "admin.sidebar.banners", to: "/admin/marketing/setbanners" },
    ],
  },

  // Settings（系統設定）
  {
    key: "settings",
    labelKey: "admin.sidebar.settings",
    children: [
      { labelKey: "admin.sidebar.payMethods", to: "/admin/settings/setpaymethods" },
      { labelKey: "admin.sidebar.shippingMethods", to: "/admin/settings/setshippingmethods" },
      { labelKey: "admin.sidebar.configCategories", to: "/admin/settings/setconfigcategories" },
      { labelKey: "admin.sidebar.config", to: "/admin/settings/setconfig" },
      { labelKey: "admin.sidebar.adminUsers", to: "/admin/settings/admin-users" },
    ],
  },
];


/* ===== 展開狀態：一次只開一個（你之前要的） ===== */
const openKey = ref(null);

const isPathInSection = (section) =>
  section.children?.some((c) => route.path.startsWith(c.to));

watch(
  () => route.path,
  () => {
    const hit = sections.find(isPathInSection);
    if (hit) openKey.value = hit.key;
  },
  { immediate: true }
);

const toggle = (key) => {
  openKey.value = openKey.value === key ? null : key;
};

const isOpen = (key) => openKey.value === key;

const activeSectionKey = computed(() => {
  const hit = sections.find((s) => s.to === route.path || isPathInSection(s));
  return hit?.key;
});

/* ✅ 手機點子選單自動關 sidebar */
const onNavClick = () => {
  emit("close");
};
</script>

<template>
  <aside class="sidebar" :class="{ open: mobileOpen }">
    <!-- Brand -->
    <div class="brand">
      <div class="logo">A</div>
      <div class="brand-text">
        <strong>Aley’s</strong>
        <span>Admin</span>
      </div>

      <!-- 手機上顯示關閉按鈕 -->
      <button class="btn btn-sm btn-outline-secondary d-lg-none" @click="emit('close')">
        ✕
      </button>
    </div>

    <!-- Menu（吃掉中間空間） -->
    <nav class="menu">
      <div v-for="s in sections" :key="s.key" class="mb-2">
        <button v-if="s.children" class="btn w-100 text-start d-flex justify-content-between align-items-center" :class="{
          'btn-light fw-semibold': activeSectionKey === s.key,
          'btn-link text-decoration-none text-dark': activeSectionKey !== s.key
        }" @click="toggle(s.key)">
          {{ t(s.labelKey) }}
          <span class="transition" :class="{ rotate: isOpen(s.key) }">▾</span>
        </button>

        <RouterLink v-else :to="s.to" class="btn w-100 text-start"
          :class="route.path === s.to ? 'btn-light fw-semibold' : 'btn-link text-dark'" @click="onNavClick">
          {{ t(s.labelKey) }}
        </RouterLink>

        <Transition name="collapse">
          <div v-if="s.children && isOpen(s.key)" class="ps-3 mt-1">
            <RouterLink v-for="c in s.children" :key="c.to" :to="c.to"
              class="d-block py-1 px-2 rounded text-decoration-none text-secondary"
              :class="{ 'bg-light fw-semibold text-dark': route.path.startsWith(c.to) }" @click="onNavClick">
              {{ t(c.labelKey) }}
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>

    <!-- Bottom（固定在最下面） -->
    <div class="bottom">
      <div class="email">{{ auth.user?.email }}</div>
      <button class="btn btn-outline-secondary w-100" @click="logout">
        {{ t("common.logout") }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  min-height: 100vh;

  display: flex;
  flex-direction: column;

  transition: transform 0.3s ease;
}

/* 手機 / 平板：側欄抽屜 */
@media (max-width: 991.98px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1100;
    transform: translateX(-100%);
  }

  .sidebar.open {
    transform: translateX(0);
  }
}

/* 桌機：固定顯示 */
@media (min-width: 992px) {
  .sidebar {
    position: static;
    transform: none !important;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  justify-content: space-between;
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #7c2d12;
  background: linear-gradient(135deg, #fbbf24, #f472b6);
}

.brand-text {
  flex: 1;
}

.brand-text strong {
  display: block;
  font-size: 14px;
}

.brand-text span {
  font-size: 12px;
  color: #6b7280;
}

.menu {
  flex: 1;
  padding: 12px 8px;
  overflow: auto;
}

.bottom {
  padding: 14px 16px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.email {
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
  margin-bottom: 10px;
}

.transition {
  transition: transform 0.35s ease;
}

.rotate {
  transform: rotate(180deg);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.35s ease, opacity 0.35s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 300px;
  opacity: 1;
}
</style>
