<script setup>
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const logout = async () => {
  await auth.signOut();
  router.push("/login");
};

/* ===== Sidebar 結構（只放 i18n key） ===== */
const sections = [
  { key: "dashboard", labelKey: "admin.sidebar.dashboard", to: "/admin" },
  {
    key: "products",
    labelKey: "admin.sidebar.products",
    children: [
      // { labelKey: "admin.sidebar.productList", to: "/admin/products" },
      { labelKey: "admin.sidebar.categories", to: "/admin/products/setcategories" },
      { labelKey: "admin.sidebar.tags", to: "/admin/products/settags" },
      { labelKey: "admin.sidebar.colors", to: "/admin/products/setcolors" },
      { labelKey: "admin.sidebar.sizes", to: "/admin/products/setsizes" },
    ],
  },
  {
    key: "orders",
    labelKey: "admin.sidebar.orders",
    children: [
      // { labelKey: "admin.sidebar.orderList", to: "/admin/orders" },
      { labelKey: "admin.sidebar.status", to: "/admin/orders/setstatus" },
    ],
  },
  {
    key: "inventory",
    labelKey: "admin.sidebar.inventory",
    children: [
      { labelKey: "admin.sidebar.stockOverview", to: "/admin/wms" },
      { labelKey: "admin.sidebar.stockLogs", to: "/admin/wms/logs" },
    ],
  },
  {
    key: "marketing",
    labelKey: "admin.sidebar.marketing",
    children: [
      { labelKey: "admin.sidebar.coupons", to: "/admin/marketing/coupons" },
      { labelKey: "admin.sidebar.banners", to: "/admin/marketing/banners" },
    ],
  },
  {
    key: "settings",
    labelKey: "admin.sidebar.settings",
    children: [
      { labelKey: "admin.sidebar.payMethods", to: "/admin/settings/pay-methods" },
      { labelKey: "admin.sidebar.shippingMethods", to: "/admin/settings/shipping-methods" },
      { labelKey: "admin.sidebar.configCategories", to: "/admin/settings/config-categories" },
      { labelKey: "admin.sidebar.systemConfig", to: "/admin/settings/config" },
      { labelKey: "admin.sidebar.adminUsers", to: "/admin/settings/admin-users" },
    ],
  },
];

/* ===== 展開狀態：一次只開一個（Accordion） ===== */
const openKey = ref(null); // 目前展開的主選單 key（例如 'products'）

const isPathInSection = (section) =>
  section.children?.some((c) => route.path.startsWith(c.to));

watch(
  () => route.path,
  () => {
    const hit = sections.find(isPathInSection);
    if (hit) openKey.value = hit.key; // 路由在哪一區，就自動展開那一區
  },
  { immediate: true }
);

const toggle = (key) => {
  openKey.value = openKey.value === key ? null : key; // 點同一個就收起來，點別的就切換（自動關掉上一個）
};

const isOpen = (key) => openKey.value === key;
</script>

<template>
  <aside class="sidebar d-flex flex-column border-end">
    <!-- Brand -->
    <div class="p-3 border-bottom d-flex align-items-center gap-2">
      <div class="logo">A</div>
      <div>
        <div class="fw-bold">Aley’s</div>
        <small class="text-muted">Admin</small>
      </div>
    </div>

    <!-- Menu -->
    <nav class="flex-fill p-2">
      <div v-for="s in sections" :key="s.key" class="mb-2">
        <!-- 主選單 -->
        <button
          v-if="s.children"
          class="btn w-100 text-start d-flex justify-content-between align-items-center"
          :class="{
            'btn-light fw-semibold': activeSectionKey === s.key,
            'btn-link text-decoration-none text-dark': activeSectionKey !== s.key
          }"
          @click="toggle(s.key)"
        >
          {{ t(s.labelKey) }}
          <span class="transition" :class="{ rotate: isOpen(s.key) }">▾</span>
        </button>

        <RouterLink
          v-else
          :to="s.to"
          class="btn w-100 text-start"
          :class="route.path === s.to ? 'btn-light fw-semibold' : 'btn-link text-dark'"
        >
          {{ t(s.labelKey) }}
        </RouterLink>

        <!-- 子選單 -->
        <Transition name="collapse">
          <div v-if="s.children && isOpen(s.key)" class="ps-3 mt-1">
            <RouterLink
              v-for="c in s.children"
              :key="c.to"
              :to="c.to"
              class="d-block py-1 px-2 rounded text-decoration-none text-secondary"
              :class="{ 'bg-light fw-semibold text-dark': route.path.startsWith(c.to) }"
            >
              {{ t(c.labelKey) }}
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>

    <!-- Bottom -->
    <div class="border-top p-3">
      <div class="small text-muted mb-2">{{ auth.user?.email }}</div>
      <button class="btn btn-outline-secondary w-100" @click="logout">
        {{ t("common.logout") }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  min-height: 100vh;
  background: #fff;
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  background: linear-gradient(135deg, #fbbf24, #f472b6);
  color: #7c2d12;
}

.collapse-enter-active {
  transition: max-height 0.35s ease, opacity 0.2s ease;
}

.collapse-leave-active {
  transition: max-height 0.2s ease, opacity 0.1s ease;
}

.collapse-enter-from {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to {
  max-height: 300px;
  opacity: 1;
}

.collapse-leave-from {
  max-height: 300px;
  opacity: 1;
}

.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
