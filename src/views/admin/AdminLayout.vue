<script setup>
import AdminSidebar from "@/components/admin/AdminSidebar.vue";
import { useAuthStore } from "@/stores/auth";
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";

const auth = useAuthStore();
const { locale } = useI18n();

/* ===== Sidebar RWD ===== */
const isSidebarOpen = ref(false);
const isDesktop = ref(window.innerWidth >= 992);

const onResize = () => {
  isDesktop.value = window.innerWidth >= 992;
  if (isDesktop.value) isSidebarOpen.value = false;
};

/* ===== Language Dropdown (Vue 控制) ===== */
const langOpen = ref(false);
const dropdownRoot = ref(null);

const currentLangLabel = computed(() =>
  locale.value === "en-US" ? "English" : "繁體中文"
);

const setLocale = (val) => {
  locale.value = val;
  localStorage.setItem("locale", val);
  langOpen.value = false; // 選完關閉
};

const toggleLang = () => {
  langOpen.value = !langOpen.value;
};

const closeLang = () => {
  langOpen.value = false;
};

// 點外面關閉 dropdown
const onDocClick = (e) => {
  if (!dropdownRoot.value) return;
  const hit = dropdownRoot.value.contains(e.target);
  if (!hit) closeLang();
};

onMounted(() => {
  window.addEventListener("resize", onResize);
  document.addEventListener("click", onDocClick);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  document.removeEventListener("click", onDocClick);
});
</script>

<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <AdminSidebar
      :mobile-open="isSidebarOpen"
      @close="isSidebarOpen = false"
    />

    <!-- Overlay（手機/平板才出現） -->
    <div
      v-if="!isDesktop && isSidebarOpen"
      class="sidebar-overlay"
      @click="isSidebarOpen = false"
    />

    <!-- Main -->
    <main class="content">
      <header class="topbar">
        <div class="topbar-left">
          <!-- Hamburger（<992 顯示） -->
          <button
            class="btn btn-outline-secondary btn-sm d-lg-none"
            type="button"
            @click="isSidebarOpen = true"
            aria-label="Open menu"
          >
            ☰
          </button>

          <RouterLink to="/" class="topbar-home" title="前往前台">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="d-none d-sm-inline">前台首頁</span>
          </RouterLink>

          <h1 class="title ms-2 mb-0">Admin</h1>
        </div>

        <div class="topbar-right">
          <!-- ✅ Vue 控制的 Bootstrap 樣式 Dropdown -->
          <div class="dropdown" ref="dropdownRoot">
            <button
              class="btn btn-outline-secondary btn-sm dropdown-toggle"
              type="button"
              :aria-expanded="langOpen ? 'true' : 'false'"
              @click.stop="toggleLang"
            >
              {{ currentLangLabel }}
            </button>

            <ul
              class="dropdown-menu dropdown-menu-end"
              :class="{ show: langOpen }"
            >
              <li>
                <button class="dropdown-item" @click="setLocale('zh-TW')">
                  繁體中文
                </button>
              </li>
              <li>
                <button class="dropdown-item" @click="setLocale('en-US')">
                  English
                </button>
              </li>
            </ul>
          </div>

          <span class="user">{{ auth.user?.email }}</span>
        </div>
      </header>

      <section class="page" @click="!isDesktop && (isSidebarOpen = false)">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<style>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f6f8;
}

/* Overlay */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1090;
}

/* Content */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Topbar */
.topbar {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0 16px;

  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
}

/* Page */
.page {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

/* ✅ 讓 dropdown-menu 在 Vue show 時真的顯示 */
.dropdown-menu {
  display: none;
}
.dropdown-menu.show {
  display: block;
}

.topbar-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #6b7280;
  text-decoration: none;
  padding: 5px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  white-space: nowrap;
}
.topbar-home:hover {
  color: #374151;
  border-color: #9ca3af;
  background: #f9fafb;
}
</style>
