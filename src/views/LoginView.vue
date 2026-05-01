<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabase";

const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const errorMsg = ref("");
const isSubmitting = ref(false);

const onLogin = async () => {
  console.log("[Login] clicked");
  errorMsg.value = "";
  isSubmitting.value = true;

  if (!email.value || !password.value) {
    errorMsg.value = "請輸入 Email / Password";
    isSubmitting.value = false;
    return;
  }

  try {
    await auth.signInWithPassword(email.value, password.value);

    const redirect = router.currentRoute.value.query.redirect || "/admin";
    await router.push(redirect);
  } catch (e) {
    console.error("[Login error]", e);
    errorMsg.value = e?.message || "登入失敗，請確認帳號密碼或 Supabase 設定";
  } finally {
    isSubmitting.value = false;
  }
};

const onForgotPassword = async () => {
  errorMsg.value = "";

  if (!email.value) {
    errorMsg.value = "請先輸入 Email";
    return;
  }

  isSubmitting.value = true;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    alert("重設密碼信已寄出，請去信箱查看");
  } catch (e) {
    console.error("[Forgot password error]", e);
    errorMsg.value = e?.message || "寄送重設密碼信失敗";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="page">
    <div class="card">
      <header class="head">
        <div class="mark">A</div>
        <div class="title">
          <h1>Aley’s Wardrobe</h1>
          <p>Admin Login</p>
        </div>
      </header>

      <form class="form" @submit.prevent="onLogin">
        <div class="field">
          <label>Email</label>
          <input v-model.trim="email" type="email" placeholder="you@example.com" autocomplete="username" />
        </div>

        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button class="btn" type="submit" :disabled="isSubmitting">
          <span v-if="!isSubmitting">Login</span>
          <span v-else>Logging in...</span>
        </button>

        <button class="link-btn" type="button" @click="onForgotPassword" :disabled="isSubmitting">
          忘記密碼？
        </button>

        <div class="footer">
          <span>© {{ new Date().getFullYear() }} Aley’s Wardrobe</span>
          <span class="dot">•</span>
          <span class="hint">僅限管理員</span>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* 背景：服飾品牌感（奶油白 + 微粉） */
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(1200px 700px at 20% 10%, rgba(244, 114, 182, 0.18), transparent 55%),
    radial-gradient(900px 520px at 85% 25%, rgba(251, 191, 36, 0.14), transparent 60%),
    linear-gradient(180deg, #fbf7f2, #f7efe6);
  color: #1f2937;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
    "Segoe UI Emoji";
}

/* 卡片：桌機優先，寬一點更像品牌入口 */
.card {
  width: 100%;
  max-width: 420px;
  border-radius: 22px;
  padding: 26px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 41, 55, 0.08);
  box-shadow: 0 26px 70px rgba(31, 41, 55, 0.12);
  backdrop-filter: blur(10px);
}

/* Header */
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.mark {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-weight: 850;
  color: #7c2d12;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.7), rgba(244, 114, 182, 0.55));
  border: 1px solid rgba(124, 45, 18, 0.08);
}

.title h1 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.2px;
}

.title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: rgba(31, 41, 55, 0.62);
}

/* Form */
.form {
  display: grid;
  gap: 14px;
  margin-top: 10px;
}

.field label {
  display: block;
  font-size: 13px;
  margin: 0 0 6px;
  color: rgba(31, 41, 55, 0.8);
}

.field input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid rgba(31, 41, 55, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: #111827;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input::placeholder {
  color: rgba(31, 41, 55, 0.35);
}

.field input:focus {
  border-color: rgba(244, 114, 182, 0.7);
  box-shadow: 0 0 0 4px rgba(244, 114, 182, 0.14);
}

/* Error */
.error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: rgba(127, 29, 29, 0.95);
  font-size: 13px;
}

/* Button */
.btn {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 0;
  cursor: pointer;
  font-weight: 780;
  letter-spacing: 0.2px;
  color: #111827;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.78), rgba(244, 114, 182, 0.58));
  box-shadow: 0 12px 28px rgba(244, 114, 182, 0.18);
  transition: transform 0.06s ease, opacity 0.15s ease;
}

.btn:active {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Footer */
.footer {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(31, 41, 55, 0.55);
}

.dot {
  opacity: 0.5;
}

.hint {
  opacity: 0.85;
}

.link-btn {
  border: 0;
  background: transparent;
  color: #9d174d;
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>