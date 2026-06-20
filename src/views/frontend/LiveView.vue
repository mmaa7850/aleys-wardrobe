<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// ── 直播場次 ─────────────────────────────────────────
const loading     = ref(true)
const session     = ref(null)   // { ID, Title, YtVideoId, Status }
const memberName  = ref('')

async function loadSession() {
  loading.value = true
  const { data } = await db
    .from('C_LIV_SessionList')
    .select('ID, Title, YtVideoId, Status')
    .eq('Status', 'active')
    .order('ID', { ascending: false })
    .limit(1)
    .maybeSingle()
  session.value = data ?? null
  loading.value = false
}

// ── 聊天室 ───────────────────────────────────────────
const messages   = ref([])
const newMsg     = ref('')
const sending    = ref(false)
const chatBottom = ref(null)
let realtimeChannel = null

async function loadMemberName() {
  if (!auth.isLoggedIn) return
  const { data } = await db
    .from('C_MBR_MemberList')
    .select('Name')
    .eq('UserID', auth.user.id)
    .maybeSingle()
  memberName.value = data?.Name || auth.user.email?.split('@')[0] || '訪客'
}

async function loadMessages() {
  if (!session.value) return
  const { data } = await db
    .from('C_LIV_ChatMessageList')
    .select('ID, SenderName, Message, CreatedDate')
    .eq('SessionID', session.value.ID)
    .order('CreatedDate', { ascending: true })
    .limit(200)
  messages.value = data ?? []
  await scrollBottom()
}

async function scrollBottom() {
  await nextTick()
  chatBottom.value?.scrollIntoView({ behavior: 'smooth' })
}

async function sendMessage() {
  const text = newMsg.value.trim()
  if (!text || !session.value || !auth.isLoggedIn) return
  if (text.length > 200) return
  sending.value = true
  await db.from('C_LIV_ChatMessageList').insert({
    SessionID:   session.value.ID,
    UserID:      auth.user.id,
    SenderName:  memberName.value,
    Message:     text,
    CreatedDate: new Date().toISOString(),
  })
  newMsg.value  = ''
  sending.value = false
}

function subscribeChat() {
  if (!session.value) return
  realtimeChannel = supabase
    .channel(`live-chat-${session.value.ID}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'staging',
      table:  'C_LIV_ChatMessageList',
      filter: `SessionID=eq.${session.value.ID}`,
    }, payload => {
      messages.value.push(payload.new)
      scrollBottom()
    })
    .subscribe()
}

const fmt = ts => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(async () => {
  await Promise.all([loadSession(), loadMemberName()])
  if (session.value) {
    await loadMessages()
    subscribeChat()
  }
})

onUnmounted(() => {
  realtimeChannel?.unsubscribe()
})

const ytSrc = computed(() =>
  session.value?.YtVideoId
    ? `https://www.youtube.com/embed/${session.value.YtVideoId}?autoplay=1&rel=0`
    : null
)
</script>

<template>
  <div class="live-page">

    <!-- Loading -->
    <div v-if="loading" class="live-loading">載入中…</div>

    <!-- 無直播 -->
    <div v-else-if="!session" class="live-empty">
      <div class="live-empty__icon">📺</div>
      <h2>目前沒有直播</h2>
      <p>直播開始時會在這裡播放，請稍後再回來</p>
    </div>

    <!-- 直播中 -->
    <div v-else class="live-layout">

      <!-- 影片區 -->
      <div class="live-video-wrap">
        <div v-if="ytSrc" class="live-video-frame">
          <iframe
            :src="ytSrc"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            frameborder="0"
          ></iframe>
        </div>
        <div v-else class="live-video-placeholder">
          <p>直播影片準備中，請稍候…</p>
        </div>
        <div class="live-title">
          <span class="live-badge">LIVE</span>
          {{ session.Title }}
        </div>
      </div>

      <!-- 聊天室 -->
      <div class="live-chat">
        <div class="live-chat__header">聊天室</div>

        <!-- 訊息列表 -->
        <div class="live-chat__messages">
          <div
            v-for="m in messages"
            :key="m.ID"
            class="live-chat__msg"
          >
            <span class="live-chat__name">{{ m.SenderName }}</span>
            <span class="live-chat__text">{{ m.Message }}</span>
            <span class="live-chat__time">{{ fmt(m.CreatedDate) }}</span>
          </div>
          <div v-if="!messages.length" class="live-chat__empty">還沒有留言，快來互動吧！</div>
          <div ref="chatBottom"></div>
        </div>

        <!-- 輸入區 -->
        <div class="live-chat__input-wrap">
          <template v-if="auth.isLoggedIn">
            <input
              v-model="newMsg"
              class="live-chat__input"
              placeholder="說點什麼…"
              maxlength="200"
              @keydown.enter.prevent="sendMessage"
            />
            <button
              class="live-chat__send"
              :disabled="sending || !newMsg.trim()"
              @click="sendMessage"
            >送出</button>
          </template>
          <div v-else class="live-chat__login-hint">
            <RouterLink to="/login">登入</RouterLink> 後才能留言
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.live-page {
  min-height: 60vh;
  padding: 24px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.live-loading,
.live-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 12px;
  color: #888;
}

.live-empty__icon { font-size: 56px; }
.live-empty h2 { font-size: 22px; font-weight: 600; color: #333; margin: 0; }
.live-empty p  { font-size: 14px; margin: 0; }

/* 直播佈局：左影片 右聊天室 */
.live-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.live-video-wrap {
  flex: 1 1 0;
  min-width: 0;
}

.live-video-frame {
  position: relative;
  padding-top: 56.25%; /* 16:9 */
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}
.live-video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.live-video-placeholder {
  aspect-ratio: 16/9;
  background: #1a1a1a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.live-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #222;
}

.live-badge {
  background: #e53e3e;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 1px;
}

/* 聊天室 */
.live-chat {
  width: 300px;
  flex-shrink: 0;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 520px;
  background: #fff;
}

.live-chat__header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
  color: #333;
}

.live-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.live-chat__msg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: baseline;
  font-size: 13px;
}

.live-chat__name {
  font-weight: 600;
  color: #6366f1;
  white-space: nowrap;
}

.live-chat__text {
  color: #333;
  word-break: break-word;
  flex: 1;
}

.live-chat__time {
  font-size: 11px;
  color: #aaa;
  margin-left: auto;
  white-space: nowrap;
}

.live-chat__empty {
  font-size: 13px;
  color: #bbb;
  text-align: center;
  margin-top: 20px;
}

.live-chat__input-wrap {
  padding: 10px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 8px;
}

.live-chat__input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
}
.live-chat__input:focus { border-color: #6366f1; }

.live-chat__send {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
}
.live-chat__send:disabled { opacity: 0.5; cursor: not-allowed; }

.live-chat__login-hint {
  font-size: 13px;
  color: #888;
  width: 100%;
  text-align: center;
}
.live-chat__login-hint a { color: #6366f1; }

/* 手機：改成上下排列 */
@media (max-width: 768px) {
  .live-layout { flex-direction: column; }
  .live-chat { width: 100%; height: 400px; }
}
</style>
