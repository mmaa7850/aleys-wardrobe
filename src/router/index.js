import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

import LoginView from "@/views/LoginView.vue";
import AdminLayout from "@/views/admin/AdminLayout.vue";
import AdminHome from "@/views/admin/AdminHome.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/login" },
    { path: "/login", name: "login", component: LoginView },
    {
      path: "/reset-password",
      name: "reset-password",
      component: () => import("@/views/ResetPasswordView.vue"),
    },

    {
      path: "/admin",
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        // Dashboard
        { path: "", name: "admin-home", component: AdminHome },

        // Products - Colors ✅（你的檔案在 pages/admin/products）
        {
          path: "/admin/products",
          name: "AdminProducts",
          component: () => import("@/pages/admin/products/ProductList.vue"),
        },
        {
          path: "/product/products/new",
          name: "ProductNew",
          component: () => import("@/pages/admin/products/ProductEdit.vue"),
        },
        {
          path: "/product/products/:id",
          name: "ProductEdit",
          component: () => import("@/pages/admin/products/ProductEdit.vue"),
          props: true,
        },
        {
          path: "products/setcolors",
          name: "admin-products-setcolors",
          component: () => import("@/pages/admin/products/SetColors.vue"),
        },
        {
          path: "products/setsizes",
          name: "admin-products-setsizes",
          component: () => import("@/pages/admin/products/SetSizes.vue"),
        },
        {
          path: "products/setcategories",
          name: "admin-products-setcategories",
          component: () => import("@/pages/admin/products/SetCategories.vue"),
        },
        {
          path: "products/settags",
          name: "admin-products-settags",
          component: () => import("@/pages/admin/products/SetTags.vue"),
        },

        // Orders
        {
          path: "orders/setstatus",
          name: "admin-orders-setstatus",
          component: () => import("@/pages/admin/orders/SetStatus.vue"),
        },

        // Marketing
        {
          path: "marketing/setcoupons",
          name: "admin-market-setcoupons",
          component: () => import("@/pages/admin/marketing/SetCoupons.vue"),
        },
        {
          path: "marketing/setbanners",
          name: "admin-market-setbanners",
          component: () => import("@/pages/admin/marketing/SetBanners.vue"),
        },

        // Settings
        {
          path: "settings/setpaymethods",
          name: "admin-settings-setpaymethods",
          component: () => import("@/pages/admin/settings/SetPayMethods.vue"),
        },
        {
          path: "settings/setshippingmethods",
          name: "admin-settings-setshippingmethods",
          component: () => import("@/pages/admin/settings/SetShippingMethods.vue"),
        },
        {
          path: "settings/setconfigcategories",
          name: "admin-settings-setconfigcategories",
          component: () => import("@/pages/admin/settings/SetConfigCategories.vue"),
        },
        {
          path: "settings/setconfig",
          name: "admin-settings-setconfig",
          component: () => import("@/pages/admin/settings/SetConfig.vue"),
        },

        // 之後要加其他頁面就照這樣加：
        // { path: "products/categories", name: "admin-products-categories", component: () => import("@/pages/admin/products/Categories.vue") },
        // { path: "products/tags", name: "admin-products-tags", component: () => import("@/pages/admin/products/Tags.vue") },
        // { path: "products/sizes", name: "admin-products-sizes", component: () => import("@/pages/admin/products/Sizes.vue") },

        // { path: "orders", name: "admin-orders", component: () => import("@/pages/admin/orders/Orders.vue") },
        // { path: "orders/status", name: "admin-orders-status", component: () => import("@/pages/admin/orders/OrderStatus.vue") },

        // { path: "wms", name: "admin-wms", component: () => import("@/pages/admin/wms/StockOverview.vue") },
        // { path: "wms/logs", name: "admin-wms-logs", component: () => import("@/pages/admin/wms/StockLogs.vue") },

        // { path: "marketing/coupons", name: "admin-marketing-coupons", component: () => import("@/pages/admin/marketing/Coupons.vue") },
        // { path: "marketing/banners", name: "admin-marketing-banners", component: () => import("@/pages/admin/marketing/Banners.vue") },

        // { path: "settings/pay-methods", name: "admin-settings-pay-methods", component: () => import("@/pages/admin/settings/PayMethods.vue") },
        // { path: "settings/shipping-methods", name: "admin-settings-shipping-methods", component: () => import("@/pages/admin/settings/ShippingMethods.vue") },
        // { path: "settings/config-categories", name: "admin-settings-config-categories", component: () => import("@/pages/admin/settings/ConfigCategories.vue") },
        // { path: "settings/config", name: "admin-settings-config", component: () => import("@/pages/admin/settings/Config.vue") },
        // { path: "settings/admin-users", name: "admin-settings-admin-users", component: () => import("@/pages/admin/settings/AdminUsers.vue") },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // ✅ 放行 reset-password（超重要）
  if (to.path === "/reset-password") {
    return true;
  }

  // ✅ 一定要初始化（你沒有 loading，就直接判斷 user）
  if (!auth.user) {
    await auth.init();
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin && !auth.canEnterAdmin) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  return true;
});

export default router;
