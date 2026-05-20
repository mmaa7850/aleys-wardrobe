<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

const status = ref('loading') // loading | success | error | no-token
const errMsg = ref('')

onMounted(async () => {
  const token = route.query.token

  if (!token) {
    status.value = 'no-token'
    return
  }

  // 未登入 → 跳到登入頁，登入後回來
  if (!auth.isLoggedIn) {
    await auth.init()
    if (!auth.isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent('/bind-line?token=' + token)}`)
      return
    }
  }

  // 呼叫 Edge Function 完成綁定
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-bind`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ token }),
      },
    )
    const data = await res.json()
    if (data.success) {
      status.value = 'success'
    } else {
      status.value = 'error'
      errMsg.value = data.error || '綁定失敗'
    }
  } catch (e) {
    status.value = 'error'
    errMsg.value = '網路錯誤，請稍後再試'
  }
})
</script>

<template>
  <div class="bl-page">
    <div class="bl-card">

      <!-- Loading -->
      <template v-if="status === 'loading'">
        <div class="bl-spinner"></div>
        <p class="bl-text">綁定中，請稍候...</p>
      </template>

      <!-- Success -->
      <template v-else-if="status === 'success'">
        <div class="bl-icon bl-icon--ok">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 class="bl-title">LINE 綁定成功！</h2>
        <p class="bl-text">您的帳號已成功綁定 LINE，<br>之後直播下單通知會自動發送給您。</p>
        <button class="bl-btn" @click="router.push('/')">回到首頁</button>
      </template>

      <!-- No token -->
      <template v-else-if="status === 'no-token'">
        <div class="bl-icon bl-icon--warn">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 class="bl-title">連結無效</h2>
        <p class="bl-text">請透過 LINE 官方帳號發送的訊息<br>點擊綁定連結。</p>
        <button class="bl-btn" @click="router.push('/')">回到首頁</button>
      </template>

      <!-- Error -->
      <template v-else>
        <div class="bl-icon bl-icon--err">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h2 class="bl-title">綁定失敗</h2>
        <p class="bl-text">{{ errMsg }}</p>
        <button class="bl-btn" @click="router.push('/')">回到首頁</button>
      </template>

    </div>
  </div>
</template>

<style scoped>
.bl-page {
  min-height: 100vh;
  background: var(--fe-cream);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.bl-card {
  background: var(--fe-white);
  border: 1px solid var(--fe-border);
  border-radius: 16px;
  padding: 48px 40px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.bl-spinner {
  width: 40px;
  height: 40px;
  border: 2px solid var(--fe-border);
  border-top-color: #06C755;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.bl-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bl-icon--ok  { background: rgba(6,199,85,0.12); color: #06C755; }
.bl-icon--err { background: rgba(220,38,38,0.1);  color: #DC2626; }
.bl-icon--warn { background: rgba(245,158,11,0.1); color: #D97706; }

.bl-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 22px;
  font-weight: 500;
  color: var(--fe-text);
  margin: 0;
}

.bl-text {
  font-size: 14px;
  color: var(--fe-muted);
  line-height: 1.7;
  margin: 0;
}

.bl-btn {
  margin-top: 8px;
  padding: 11px 32px;
  background: var(--fe-text);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: opacity 0.2s;
}
.bl-btn:hover { opacity: 0.82; }
</style>
