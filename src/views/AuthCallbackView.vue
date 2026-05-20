<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { db } from "@/lib/db";

const router = useRouter();
const auth = useAuthStore();

onMounted(async () => {
  await auth.init();

  if (auth.canEnterAdmin) {
    router.replace("/admin");
    return;
  }

  if (!auth.isLoggedIn) {
    router.replace("/login");
    return;
  }

  // FB 登入：擷取 FB 顯示名稱存入會員資料（供直播訂單比對用）
  const user = auth.user;
  const fbIdentity = user?.identities?.find((i) => i.provider === "facebook");
  if (fbIdentity) {
    const fbName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      null;
    if (fbName) {
      // 只更新 FbName，不影響其他欄位
      await db
        .from("C_MBR_MemberList")
        .update({ FbName: fbName })
        .eq("UserID", user.id);
    }
  }

  // 新用戶（尚未建立 MemberList 記錄）→ 導到帳號頁填資料
  const { data } = await db
    .from("C_MBR_MemberList")
    .select("ID")
    .eq("UserID", auth.user.id)
    .maybeSingle();

  if (!data) {
    router.replace("/account");
  } else {
    // 優先從 sessionStorage 取（FB OAuth 會丟失 query param）
    const redirect =
      sessionStorage.getItem("oauth_redirect") ||
      new URLSearchParams(window.location.search).get("redirect") ||
      "/";
    sessionStorage.removeItem("oauth_redirect");
    router.replace(redirect);
  }
});
</script>

<template>
  <div class="callback-page">
    <div class="spinner"></div>
    <p>登入中，請稍候...</p>
  </div>
</template>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: linear-gradient(180deg, #fbf7f2, #f7efe6);
  color: rgba(31, 41, 55, 0.6);
  font-size: 14px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(31, 41, 55, 0.12);
  border-top-color: rgba(244, 114, 182, 0.7);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
