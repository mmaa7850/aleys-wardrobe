<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "@/lib/supabase";

const router = useRouter();

const password = ref("");
const confirmPassword = ref("");
const errorMsg = ref("");
const successMsg = ref("");
const isSubmitting = ref(false);

const onResetPassword = async () => {
  errorMsg.value = "";
  successMsg.value = "";

  if (!password.value || !confirmPassword.value) {
    errorMsg.value = "請輸入新密碼";
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = "兩次輸入的密碼不一致";
    return;
  }

  if (password.value.length < 6) {
    errorMsg.value = "密碼至少需要 6 個字元";
    return;
  }

  isSubmitting.value = true;

  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    });

    if (error) throw error;

    successMsg.value = "密碼已更新，請重新登入";

    setTimeout(async () => {
      await supabase.auth.signOut();
      router.push("/login");
    }, 1200);
  } catch (e) {
    if (import.meta.env.DEV) console.error("[Reset password error]", e);
    errorMsg.value = e?.message || "密碼更新失敗";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="page">
    <div class="card">
      <h1>重設密碼</h1>
      <p class="sub">請輸入新的登入密碼</p>

      <form class="form" @submit.prevent="onResetPassword">
        <div class="field">
          <label>新密碼</label>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            placeholder="請輸入新密碼"
          />
        </div>

        <div class="field">
          <label>確認新密碼</label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="再次輸入新密碼"
          />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success">{{ successMsg }}</p>

        <button class="btn" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? "更新中..." : "更新密碼" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #fbf7f2, #f7efe6);
  color: #1f2937;
}

.card {
  width: 100%;
  max-width: 420px;
  border-radius: 22px;
  padding: 26px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 26px 70px rgba(31, 41, 55, 0.12);
}

h1 {
  margin: 0;
  font-size: 22px;
}

.sub {
  margin: 8px 0 20px;
  color: rgba(31, 41, 55, 0.6);
  font-size: 13px;
}

.form {
  display: grid;
  gap: 14px;
}

.field label {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
}

.field input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid rgba(31, 41, 55, 0.12);
}

.error,
.success {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
}

.error {
  background: rgba(239, 68, 68, 0.1);
  color: #7f1d1d;
}

.success {
  background: rgba(34, 197, 94, 0.12);
  color: #14532d;
}

.btn {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 0;
  cursor: pointer;
  font-weight: 700;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.78), rgba(244, 114, 182, 0.58));
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>