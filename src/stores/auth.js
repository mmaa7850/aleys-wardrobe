import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    isAdmin: false,
    isActive: false,
  }),

  getters: {
    isLoggedIn: (state) => !!state.user,
    canEnterAdmin: (state) => !!state.user && state.isAdmin && state.isActive,
  },

  actions: {
    async init() {
      // 1) 讀目前登入者（刷新頁面也能拿到）
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        this.user = null;
        this.isAdmin = false;
        this.isActive = false;
        return;
      }

      this.user = data.user;

      // 2) 查管理員表：用 user.id 對應 UserId
      await this.loadAdminProfile();
    },

    async loadAdminProfile() {
  // 1️⃣ 沒有登入使用者，直接重置狀態
  if (!this.user?.id) {
    this.isAdmin = false;
    this.isActive = false;
    return;
  }

  // 2️⃣ 查詢該使用者在 Admin 表的那一筆
  const { data, error } = await supabase
    .from("S_SYS_AdminUserList")
    .select("IsAdmin, IsActive")
    .eq("UserId", this.user.id)
    .single(); // 我們確定 UserId 是 PK，所以一定只會有一筆

  // 3️⃣ 查不到 / 出錯，一律當作「不是管理員」
  if (error) {
    console.error("[loadAdminProfile] query failed:", error.message);
    this.isAdmin = false;
    this.isActive = false;
    return;
  }

  // 4️⃣ 正確寫回 Pinia state（關鍵）
  this.isAdmin = data.IsAdmin === true;
  this.isActive = data.IsActive === true;
  },

    async signInWithPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      this.user = data.user;

      // 登入後馬上查管理員狀態
      await this.loadAdminProfile();
    },

    async signOut() {
      await supabase.auth.signOut();
      this.user = null;
      this.isAdmin = false;
      this.isActive = false;
    },
  },
});
