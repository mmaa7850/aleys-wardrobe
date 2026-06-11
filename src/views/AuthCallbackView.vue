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

    // 判斷是否已有會員記錄
    const { data: existingMbr } = await db
      .from("C_MBR_MemberList")
      .select("ID")
      .eq("UserID", user.id)
      .maybeSingle();

    if (existingMbr) {
      // 已存在：只更新 FbName（不覆蓋 RegisterSource / MemberLevelID）
      if (fbName) {
        await db
          .from("C_MBR_MemberList")
          .update({ FbName: fbName, UpdatedDate: new Date().toISOString() })
          .eq("UserID", user.id);
      }
    } else {
      // 新 FB 用戶：建立記錄，帶入 RegisterSource 與預設會員等級
      const { data: defaultLevel } = await db
        .from("S_MBR_MemberLevelList")
        .select("ID")
        .order("SortOrder")
        .limit(1)
        .maybeSingle();

      await db.from("C_MBR_MemberList").insert({
        UserID:        user.id,
        Email:         user.email ?? "",
        FbName:        fbName ?? null,
        RegisterSource: "facebook",
        MemberLevelID: defaultLevel?.ID ?? null,
        IsActive:      true,
      });
    }
  }

  // 新用戶（尚未建立 MemberList 記錄）→ 導到帳號頁填資料
  const { data } = await db
    .from("C_MBR_MemberList")
    .select("ID")
    .eq("UserID", auth.user.id)
    .maybeSingle();

  // localStorage 跨 OAuth 跳轉仍保留，比 sessionStorage / URL param 都穩
  const rawRedirect = localStorage.getItem("oauth_redirect") || null;
  localStorage.removeItem("oauth_redirect");
  // 驗證只允許站內相對路徑，防止 open redirect
  const isSafeRedirect = (url) => typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
  const redirect = isSafeRedirect(rawRedirect) ? rawRedirect : null;

  if (!data) {
    // 新用戶尚無 MemberList 記錄
    // 若是 bind-line 流程，仍跳回綁定頁（不需要 MemberList）
    if (redirect && redirect.startsWith("/bind-line")) {
      router.replace(redirect);
    } else {
      router.replace("/account");
    }
  } else {
    router.replace(redirect || "/");
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
