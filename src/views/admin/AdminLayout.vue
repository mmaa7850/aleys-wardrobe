<script setup>
import AdminSidebar from "@/components/admin/AdminSidebar.vue";
import { useAuthStore } from "@/stores/auth";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

const auth = useAuthStore();
const { locale } = useI18n();

const isLangOpen = ref(false);

const currentLangLabel = computed(() =>
  locale.value === "en-US" ? "English" : "繁體中文"
);

const setLocale = (val) => {
  locale.value = val;
  localStorage.setItem("locale", val);
  isLangOpen.value = false; // 切完語言關閉
};

// 點擊外部關閉（可選但專業）
const closeLang = () => {
  isLangOpen.value = false;
};
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar />

    <main class="content" @click="closeLang">
      <header class="topbar" @click.stop>
        <h1 class="title">Admin</h1>

        <div class="topbar-right">
          <!-- ✅ Vue 控制的 Dropdown（Bootstrap 樣式） -->
          <div class="dropdown">
            <button
              class="btn btn-outline-secondary btn-sm dropdown-toggle"
              type="button"
              @click.stop="isLangOpen = !isLangOpen"
            >
              {{ currentLangLabel }}
            </button>

            <ul
              class="dropdown-menu dropdown-menu-end"
              :class="{ show: isLangOpen }"
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

      <section class="page">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f6f8;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Topbar */
.topbar {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0 20px;

  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dropdown-menu {
  position: absolute;
  z-index: 1050;
}

.user {
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
}

.page {
  flex: 1;
  padding: 16px;
  overflow: auto;
}
</style>
