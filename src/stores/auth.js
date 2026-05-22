import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";

const defaultPermissions = () => ({
  CanManageProducts: false,
  CanManageOrders: false,
  CanManageMarketing: false,
  CanManageSettings: false,
  CanManageMembers: false,
});

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    isAdmin: false,
    isActive: false,
    permissions: defaultPermissions(),
  }),

  getters: {
    isLoggedIn: (state) => !!state.user,
    canEnterAdmin: (state) => !!state.user && state.isActive,
    canAccess: (state) => (perm) => {
      if (!state.isActive) return false;
      if (state.isAdmin) return true;
      return state.permissions[perm] === true;
    },
  },

  actions: {
    async init() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        this.user = null;
        this.isAdmin = false;
        this.isActive = false;
        this.permissions = defaultPermissions();
        return;
      }

      this.user = data.user;
      await this.loadAdminProfile();
    },

    async loadAdminProfile() {
      if (!this.user?.id) {
        this.isAdmin = false;
        this.isActive = false;
        this.permissions = defaultPermissions();
        return;
      }

      const { data, error } = await db
        .from("S_SYS_AdminUserList")
        .select("IsAdmin, IsActive, CanManageProducts, CanManageOrders, CanManageMarketing, CanManageSettings, CanManageMembers")
        .eq("UserId", this.user.id)
        .single();

      if (error) {
        console.error("[loadAdminProfile] query failed:", error.message);
        this.isAdmin = false;
        this.isActive = false;
        this.permissions = defaultPermissions();
        return;
      }

      this.isAdmin = data.IsAdmin === true;
      this.isActive = data.IsActive === true;
      this.permissions = {
        CanManageProducts: data.CanManageProducts === true,
        CanManageOrders:   data.CanManageOrders === true,
        CanManageMarketing: data.CanManageMarketing === true,
        CanManageSettings:  data.CanManageSettings === true,
        CanManageMembers:   data.CanManageMembers === true,
      };
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

    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      return data
    },

    async signInWithFacebook() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          // pages_read_engagement：讀取粉專直播留言
          // pages_manage_engagement：代發結標線/結標公告到 FB
          scopes: 'pages_read_engagement,pages_manage_engagement',
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    },

    async signOut() {
      await supabase.auth.signOut();
      this.user = null;
      this.isAdmin = false;
      this.isActive = false;
      this.permissions = defaultPermissions();
    },
  },
});
