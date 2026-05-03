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
const lineLoading  = ref(false);

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

const onLineLogin = async () => {
  errorMsg.value = "";
  lineLoading.value = true;
  try {
    await auth.signInWithLine();
  } catch (e) {
    errorMsg.value = e?.message || "LINE 登入失敗";
    lineLoading.value = false;
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

        <button class="btn" type="submit" :disabled="isSubmitting || lineLoading">
          {{ isSubmitting ? '登入中...' : '登入' }}
        </button>

        <button class="link-btn" type="button" @click="onForgotPassword" :disabled="isSubmitting || lineLoading">
          忘記密碼？
        </button>

        <div class="divider"><span>或</span></div>

        <button class="btn-line" type="button" @click="onLineLogin" :disabled="isSubmitting || lineLoading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          <span>{{ lineLoading ? '連線中...' : '使用 LINE 登入' }}</span>
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

        <button class="btn-line" type="button" @click="onLineLogin" :disabled="isSubmitting || lineLoading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          <span>{{ lineLoading ? '連線中...' : '使用 LINE 快速註冊' }}</span>
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

/* LINE 按鈕 */
.btn-line {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  background: #06C755;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.15s, transform 0.06s, opacity 0.15s;
}

.btn-line:hover { background: #05b34c; }
.btn-line:active { transform: translateY(1px); }
.btn-line:disabled { opacity: 0.65; cursor: not-allowed; }

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
