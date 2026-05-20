<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabase";

const router = useRouter();
const auth = useAuthStore();

// 'login' | 'register'
const mode = ref("login");

const email       = ref("");
const password    = ref("");
const confirmPw   = ref("");
const errorMsg    = ref("");
const successMsg  = ref("");
const isSubmitting = ref(false);
const fbLoading    = ref(false);

function switchMode(m) {
  mode.value = m;
  errorMsg.value = "";
  successMsg.value = "";
  password.value = "";
  confirmPw.value = "";
}

function resolveRedirect() {
  if (auth.canEnterAdmin) return "/admin";
  const query = router.currentRoute.value.query.redirect;
  return (typeof query === "string" && query) ? query : "/";
}

const onLogin = async () => {
  errorMsg.value = "";
  isSubmitting.value = true;

  if (!email.value || !password.value) {
    errorMsg.value = "請輸入 Email 與密碼";
    isSubmitting.value = false;
    return;
  }

  try {
    await auth.signInWithPassword(email.value, password.value);
    await router.push(resolveRedirect());
  } catch (e) {
    errorMsg.value = e?.message || "登入失敗，請確認帳號密碼";
  } finally {
    isSubmitting.value = false;
  }
};

const onRegister = async () => {
  errorMsg.value = "";
  successMsg.value = "";
  isSubmitting.value = true;

  if (!email.value || !password.value) {
    errorMsg.value = "請輸入 Email 與密碼";
    isSubmitting.value = false;
    return;
  }
  if (password.value.length < 6) {
    errorMsg.value = "密碼至少需要 6 個字元";
    isSubmitting.value = false;
    return;
  }
  if (password.value !== confirmPw.value) {
    errorMsg.value = "兩次輸入的密碼不一致";
    isSubmitting.value = false;
    return;
  }

  try {
    const result = await auth.signUp(email.value, password.value);
    if (result?.session) {
      // 免驗信，直接導到帳號頁填資料
      await auth.init();
      router.push("/account");
    } else {
      // 需要驗信
      successMsg.value = "註冊成功！請至信箱收取驗證信，驗證後登入即可完善您的會員資料。";
      email.value = "";
      password.value = "";
      confirmPw.value = "";
    }
  } catch (e) {
    errorMsg.value = e?.message || "註冊失敗，請稍後再試";
  } finally {
    isSubmitting.value = false;
  }
};

const onFbLogin = async () => {
  errorMsg.value = "";
  fbLoading.value = true;
  // 把 redirect 目標直接帶進 OAuth redirectTo URL，不依賴 sessionStorage
  // （LINE in-app browser 在 OAuth 跳轉時會清掉 sessionStorage）
  const redirectTarget = router.currentRoute.value.query.redirect;
  const finalRedirect = (typeof redirectTarget === "string" && redirectTarget) ? redirectTarget : null;
  try {
    await auth.signInWithFacebook(finalRedirect);
  } catch (e) {
    errorMsg.value = e?.message || "Facebook 登入失敗";
    fbLoading.value = false;
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
          <h1>Aley's Wardrobe</h1>
          <p>{{ mode === 'login' ? '會員登入' : '建立帳號' }}</p>
        </div>
      </header>

      <!-- Tab switch -->
      <div class="tabs">
        <button :class="['tab', { 'tab--active': mode === 'login' }]" @click="switchMode('login')">登入</button>
        <button :class="['tab', { 'tab--active': mode === 'register' }]" @click="switchMode('register')">註冊</button>
      </div>

      <!-- ── Login form ── -->
      <form v-if="mode === 'login'" class="form" @submit.prevent="onLogin">
        <div class="field">
          <label>Email</label>
          <input v-model.trim="email" type="email" placeholder="you@example.com" autocomplete="username" />
        </div>
        <div class="field">
          <label>密碼</label>
          <input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <p v-if="errorMsg" class="msg msg--error">{{ errorMsg }}</p>

        <button class="btn" type="submit" :disabled="isSubmitting || fbLoading">
          {{ isSubmitting ? '登入中...' : '登入' }}
        </button>

        <button class="link-btn" type="button" @click="onForgotPassword" :disabled="isSubmitting || fbLoading">
          忘記密碼？
        </button>

        <div class="divider"><span>或</span></div>

        <button class="btn-fb" type="button" @click="onFbLogin" :disabled="isSubmitting || fbLoading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
          <span>{{ fbLoading ? '連線中...' : '使用 Facebook 登入' }}</span>
        </button>
      </form>

      <!-- ── Register form ── -->
      <form v-else class="form" @submit.prevent="onRegister">
        <div class="field">
          <label>Email</label>
          <input v-model.trim="email" type="email" placeholder="you@example.com" autocomplete="email" />
        </div>
        <div class="field">
          <label>密碼 <span class="hint">（至少 6 個字元）</span></label>
          <input v-model="password" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>確認密碼</label>
          <input v-model="confirmPw" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>

        <p v-if="errorMsg"  class="msg msg--error">{{ errorMsg }}</p>
        <p v-if="successMsg" class="msg msg--success">{{ successMsg }}</p>

        <button class="btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? '註冊中...' : '建立帳號' }}
        </button>

        <div class="divider"><span>或</span></div>

        <button class="btn-fb" type="button" @click="onFbLogin" :disabled="isSubmitting || fbLoading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
          <span>{{ fbLoading ? '連線中...' : '使用 Facebook 快速註冊' }}</span>
        </button>
      </form>

      <div class="footer">
        <span>© {{ new Date().getFullYear() }} Aley's Wardrobe</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(1200px 700px at 20% 10%, rgba(244, 114, 182, 0.18), transparent 55%),
    radial-gradient(900px 520px at 85% 25%, rgba(251, 191, 36, 0.14), transparent 60%),
    linear-gradient(180deg, #fbf7f2, #f7efe6);
  color: #1f2937;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}

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
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field input::placeholder { color: rgba(31, 41, 55, 0.35); }

.field input:focus {
  border-color: rgba(244, 114, 182, 0.7);
  box-shadow: 0 0 0 4px rgba(244, 114, 182, 0.14);
}

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
  transition: transform 0.06s, opacity 0.15s;
}

.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: 0.65; cursor: not-allowed; }

/* Facebook 按鈕 */
.btn-fb {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  background: #1877F2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.15s, transform 0.06s, opacity 0.15s;
}

.btn-fb:hover { background: #166FE5; }
.btn-fb:active { transform: translateY(1px); }
.btn-fb:disabled { opacity: 0.65; cursor: not-allowed; }

/* 分隔線 */
.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(31, 41, 55, 0.35);
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(31, 41, 55, 0.1);
}

.link-btn {
  border: 0;
  background: transparent;
  color: #9d174d;
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
}

.link-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Tabs */
.tabs {
  display: flex;
  gap: 0;
  border-radius: 12px;
  background: rgba(31, 41, 55, 0.06);
  padding: 4px;
  margin-bottom: 18px;
}

.tab {
  flex: 1;
  padding: 9px;
  border: 0;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: rgba(31, 41, 55, 0.5);
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}

.tab--active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 6px rgba(31, 41, 55, 0.12);
}

/* Messages */
.msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
}

.msg--error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: rgba(127, 29, 29, 0.95);
}

.msg--success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.28);
  color: rgba(20, 83, 45, 0.95);
}

/* Password hint */
.hint {
  font-size: 11px;
  color: rgba(31, 41, 55, 0.45);
  font-weight: 400;
}

.footer {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  color: rgba(31, 41, 55, 0.45);
}
</style>
