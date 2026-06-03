import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { setUserId } from "@/lib/gtag";

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
    lineUserId: null,   // 前台消費者 LINE 綁定狀態
    memberId: null,     // C_MBR_MemberList.ID
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
        this.lineUserId = null;
        this.memberId = null;
        return;
      }

      this.user = data.user;
      await Promise.all([this.loadAdminProfile(), this.loadMemberProfile()]);
    },

    // 載入前台會員資料（LineUserID、會員 ID）
    async loadMemberProfile() {
      if (!this.user?.id) { this.lineUserId = null; this.memberId = null; return; }
      try {
        const { data } = await db
          .from('C_MBR_MemberList')
          .select('ID, "LineUserID"')
          .eq('UserID', this.user.id)
          .maybeSingle()
        this.lineUserId = data?.LineUserID ?? null
        this.memberId   = data?.ID ?? null
        // GA4 User-ID：以會員 ID 識別訪客（比 cookie 更準確）
        if (this.memberId) setUserId(String(this.memberId))
      } catch {
        this.lineUserId = null
        this.memberId   = null
      }
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
      await Promise.all([this.loadAdminProfile(), this.loadMemberProfile()]);
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
          scopes: 'email',
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
      this.lineUserId = null;
      this.memberId   = null;
    },
  },
});
