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

/* ===== Language Dropdown ===== */
const langOpen = ref(false);
const dropdownRoot = ref(null);

const currentLangLabel = computed(() =>
  locale.value === "en-US" ? "EN" : "繁中"
);

const setLocale = (val) => {
  locale.value = val;
  localStorage.setItem("locale", val);
  langOpen.value = false;
};

const toggleLang = () => { langOpen.value = !langOpen.value; };
const closeLang = () => { langOpen.value = false; };

const onDocClick = (e) => {
  if (!dropdownRoot.value) return;
  if (!dropdownRoot.value.contains(e.target)) closeLang();
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

    <!-- Overlay（手機/平板） -->
    <div
      v-if="!isDesktop && isSidebarOpen"
      class="al-overlay"
      @click="isSidebarOpen = false"
    />

    <!-- Main -->
    <main class="al-main">
      <header class="al-topbar">
        <div class="al-topbar__left">
          <!-- Hamburger -->
          <button
            class="al-hamburger d-lg-none"
            type="button"
            @click="isSidebarOpen = true"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <RouterLink to="/" class="al-home-link" title="前往前台">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="d-none d-sm-inline">前台</span>
          </RouterLink>
        </div>

        <div class="al-topbar__right">
          <!-- Language -->
          <div class="al-lang" ref="dropdownRoot">
            <button
              class="al-lang__btn"
              type="button"
              :aria-expanded="langOpen"
              @click.stop="toggleLang"
            >
              {{ currentLangLabel }}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <ul class="al-lang__menu" :class="{ show: langOpen }">
              <li><button class="al-lang__item" @click="setLocale('zh-TW')">繁體中文</button></li>
              <li><button class="al-lang__item" @click="setLocale('en-US')">English</button></li>
            </ul>
          </div>

          <span class="al-user">{{ auth.user?.email }}</span>
        </div>
      </header>

      <section class="al-page" @click="!isDesktop && (isSidebarOpen = false)">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<style>
/* ─── Layout shell ─────────────────────────────────────────── */
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #faf7f4;
}

.al-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 23, 20, 0.45);
  z-index: 1090;
}

.al-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ─── Topbar ───────────────────────────────────────────────── */
.al-topbar {
  height: 54px;
  background: #fdf9f5;
  border-bottom: 1px solid #e8ddd0;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.al-topbar__left,
.al-topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.al-hamburger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: none;
  border: 1px solid #e0d5c8;
  border-radius: 5px;
  color: #6b5a48;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.al-hamburger:hover {
  border-color: #C8A882;
  color: #C8A882;
}

.al-home-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #8c7260;
  text-decoration: none;
  padding: 5px 11px;
  border: 1px solid #e0d5c8;
  border-radius: 5px;
  letter-spacing: 0.02em;
  transition: all 0.18s;
}
.al-home-link:hover {
  color: #C8A882;
  border-color: #C8A882;
  background: rgba(200,168,130,0.06);
}

/* Language dropdown */
.al-lang {
  position: relative;
}
.al-lang__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: none;
  border: 1px solid #e0d5c8;
  border-radius: 5px;
  font-size: 12px;
  color: #8c7260;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: all 0.18s;
}
.al-lang__btn:hover {
  border-color: #C8A882;
  color: #C8A882;
}
.al-lang__menu {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: #fff;
  border: 1px solid #e8ddd0;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(100,70,40,0.12);
  padding: 4px;
  list-style: none;
  margin: 0;
  min-width: 110px;
  z-index: 200;
}
.al-lang__menu.show { display: block; }
.al-lang__item {
  display: block;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: none;
  font-size: 12.5px;
  color: #5c4a38;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.al-lang__item:hover {
  background: rgba(200,168,130,0.12);
  color: #C8A882;
}

.al-user {
  font-size: 12px;
  color: #a0907e;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Page area ────────────────────────────────────────────── */
.al-page {
  flex: 1;
  padding: 20px;
  overflow: auto;
}

@media (max-width: 767.98px) {
  .al-page { padding: 12px; }
  .al-topbar { padding: 0 12px; }
}

/* ══════════════════════════════════════════════════════════════
   Bootstrap overrides — scoped inside .admin-layout
   ══════════════════════════════════════════════════════════════ */

/* ─── Buttons ──────────────────────────────────────────────── */
.admin-layout .btn-primary {
  background-color: #C8A882;
  border-color: #C8A882;
  color: #fff;
}
.admin-layout .btn-primary:hover,
.admin-layout .btn-primary:focus {
  background-color: #b08d5b;
  border-color: #b08d5b;
  color: #fff;
}
.admin-layout .btn-primary:focus {
  box-shadow: 0 0 0 0.2rem rgba(200,168,130,0.35);
}
.admin-layout .btn-outline-primary {
  color: #C8A882;
  border-color: #C8A882;
}
.admin-layout .btn-outline-primary:hover {
  background-color: #C8A882;
  border-color: #C8A882;
  color: #fff;
}

/* ─── Cards ────────────────────────────────────────────────── */
.admin-layout .card {
  border-color: #e8ddd0;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(100,70,40,0.06);
}
.admin-layout .card-header {
  background: #fdf9f5;
  border-bottom-color: #e8ddd0;
  font-size: 13.5px;
  font-weight: 600;
  color: #5c4a38;
}

/* ─── Tables ───────────────────────────────────────────────── */
.admin-layout .table {
  --bs-table-border-color: #ede5d8;
}
.admin-layout .table thead th {
  background: #f5ede2;
  color: #6b5040;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-bottom-color: #ddd0bf;
  white-space: nowrap;
}
.admin-layout .table-hover tbody tr:hover {
  background-color: rgba(200,168,130,0.06);
}
.admin-layout .table-striped tbody tr:nth-of-type(odd) {
  background-color: rgba(200,168,130,0.04);
}

/* ─── Forms ────────────────────────────────────────────────── */
.admin-layout .form-control:focus,
.admin-layout .form-select:focus {
  border-color: #C8A882;
  box-shadow: 0 0 0 0.2rem rgba(200,168,130,0.25);
}
.admin-layout .form-control,
.admin-layout .form-select {
  border-color: #ddd0bf;
  color: #3d2e1e;
  font-size: 13.5px;
}
.admin-layout .form-label {
  font-size: 12.5px;
  font-weight: 500;
  color: #6b5040;
  margin-bottom: 4px;
}
.admin-layout .form-check-input:checked {
  background-color: #C8A882;
  border-color: #C8A882;
}
.admin-layout .form-check-input:focus {
  box-shadow: 0 0 0 0.2rem rgba(200,168,130,0.3);
}

/* ─── Nav tabs ─────────────────────────────────────────────── */
.admin-layout .nav-tabs {
  border-bottom-color: #e8ddd0;
}
.admin-layout .nav-tabs .nav-link {
  color: #8c7260;
  font-size: 13px;
  border-color: transparent;
}
.admin-layout .nav-tabs .nav-link:hover {
  border-color: transparent transparent #C8A882;
  color: #C8A882;
}
.admin-layout .nav-tabs .nav-link.active {
  color: #C8A882;
  border-color: #e8ddd0 #e8ddd0 #faf7f4;
  background: #faf7f4;
  font-weight: 600;
}

/* ─── Badges ───────────────────────────────────────────────── */
.admin-layout .badge.bg-secondary {
  background-color: #d4c4b0 !important;
  color: #5c4a38;
}

/* ─── Modals ───────────────────────────────────────────────── */
.admin-layout .modal-content {
  border: 1px solid #e8ddd0;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(60,40,20,0.14);
}
.admin-layout .modal-header {
  background: #fdf9f5;
  border-bottom-color: #e8ddd0;
  padding: 16px 20px;
}
.admin-layout .modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #3d2e1e;
}
.admin-layout .modal-footer {
  border-top-color: #e8ddd0;
  background: #fdf9f5;
}

/* ─── Pagination ───────────────────────────────────────────── */
.admin-layout .page-link {
  color: #C8A882;
  border-color: #e8ddd0;
}
.admin-layout .page-link:hover {
  color: #b08d5b;
  background: rgba(200,168,130,0.1);
  border-color: #C8A882;
}
.admin-layout .page-item.active .page-link {
  background-color: #C8A882;
  border-color: #C8A882;
  color: #fff;
}

/* ─── Alerts ───────────────────────────────────────────────── */
.admin-layout .alert-warning {
  background: #fdf3e3;
  border-color: #e8c98a;
  color: #7a5c20;
}
</style>
