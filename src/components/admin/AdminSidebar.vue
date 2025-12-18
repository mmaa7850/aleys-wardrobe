<script setup>
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { ref, computed, watch } from "vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const logout = async () => {
  await auth.signOut();
  router.push("/login");
};

/* ===== Sidebar 結構 ===== */
const sections = [
  { key: "dashboard", label: "Dashboard", to: "/admin" },
  {
    key: "products",
    label: "Products",
    children: [
      { label: "Product List", to: "/admin/products" },
      { label: "Categories", to: "/admin/products/categories" },
      { label: "Tags", to: "/admin/products/tags" },
      { label: "Colors", to: "/admin/products/colors" },
      { label: "Sizes", to: "/admin/products/sizes" },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    children: [
      { label: "Order List", to: "/admin/orders" },
      { label: "Order Status", to: "/admin/orders/status" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    children: [
      { label: "Stock Overview", to: "/admin/wms" },
      { label: "Stock Logs", to: "/admin/wms/logs" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    children: [
      { label: "Coupons", to: "/admin/marketing/coupons" },
      { label: "Banners", to: "/admin/marketing/banners" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    children: [
      { label: "Pay Methods", to: "/admin/settings/pay-methods" },
      { label: "Shipping Methods", to: "/admin/settings/shipping-methods" },
      { label: "Config Categories", to: "/admin/settings/config-categories" },
      { label: "System Config", to: "/admin/settings/config" },
      { label: "Admin Users", to: "/admin/settings/admin-users" },
    ],
  },
];

/* ===== 展開狀態 ===== */
const openKeys = ref(new Set());

const isPathInSection = (section) =>
  section.children?.some((c) => route.path.startsWith(c.to));

watch(
  () => route.path,
  () => {
    const hit = sections.find(isPathInSection);
    if (hit) openKeys.value.add(hit.key);
  },
  { immediate: true }
);

const toggle = (key) => {
  const next = new Set(openKeys.value);
  next.has(key) ? next.delete(key) : next.add(key);
  openKeys.value = next;
};

const isOpen = (key) => openKeys.value.has(key);

const activeSectionKey = computed(() => {
  const hit = sections.find(
    (s) => s.to === route.path || isPathInSection(s)
  );
  return hit?.key;
});
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
          {{ s.label }}
          <span
            class="transition"
            :class="{ rotate: isOpen(s.key) }"
          >▾</span>
        </button>

        <RouterLink
          v-else
          :to="s.to"
          class="btn w-100 text-start"
          :class="route.path === s.to ? 'btn-light fw-semibold' : 'btn-link text-dark'"
        >
          {{ s.label }}
        </RouterLink>

        <!-- 子選單（Bootstrap風格動畫） -->
        <Transition name="collapse">
          <div v-if="s.children && isOpen(s.key)" class="ps-3 mt-1">
            <RouterLink
              v-for="c in s.children"
              :key="c.to"
              :to="c.to"
              class="d-block py-1 px-2 rounded text-decoration-none text-secondary"
              :class="{ 'bg-light fw-semibold text-dark': route.path.startsWith(c.to) }"
            >
              {{ c.label }}
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>

    <!-- Bottom -->
    <div class="border-top p-3">
      <div class="small text-muted mb-2">{{ auth.user?.email }}</div>
      <button class="btn btn-outline-secondary w-100" @click="logout">
        Logout
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

.transition {
  transition: transform 0.5s ease;
}
.rotate {
  transform: rotate(180deg);
}

/* Bootstrap collapse-like animation */
.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.5s ease, opacity 0.5s ease;
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
