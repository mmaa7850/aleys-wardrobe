<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '@/lib/db'
import { gaEnabled } from '@/lib/gtag'

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || ''
const lookerUrl = ref('')
const configLoading = ref(true)

onMounted(async () => {
  try {
    const { data } = await db
      .from('S_SYS_Config')
      .select('Name, Value')
      .eq('Name', 'ga_looker_studio_url')
      .maybeSingle()
    lookerUrl.value = data?.Value ?? ''
  } catch {
    // ignore
  } finally {
    configLoading.value = false
  }
})

const trackedEvents = [
  { event: 'view_item',       label: '瀏覽商品',  where: '商品詳情頁 ProductDetailView' },
  { event: 'add_to_cart',     label: '加入購物車', where: '商品詳情頁 ProductDetailView' },
  { event: 'begin_checkout',  label: '開始結帳',   where: '結帳頁 CheckoutView' },
  { event: 'purchase',        label: '完成購買',   where: '訂單成功頁 OrderSuccessView' },
]

const ga4ConsoleUrl = computed(() =>
  measurementId
    ? `https://analytics.google.com/analytics/web/`
    : 'https://analytics.google.com/'
)
</script>

<template>
  <div class="admin-layout">
    <div class="container-fluid py-4">

      <!-- Header -->
      <div class="d-flex align-items-center gap-3 mb-4">
        <div class="ga-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div>
          <h4 class="mb-0 fw-semibold" style="font-family: 'Cormorant Garamond', serif; font-size: 1.5rem;">Google Analytics</h4>
          <p class="text-muted mb-0" style="font-size: 0.8rem;">GA4 事件追蹤與報表整合</p>
        </div>
      </div>

      <div class="row g-4">

        <!-- Left column -->
        <div class="col-lg-5">

          <!-- Status Card -->
          <div class="card mb-4">
            <div class="card-header d-flex align-items-center gap-2">
              <span class="fw-semibold" style="font-size: 0.85rem;">追蹤狀態</span>
            </div>
            <div class="card-body">
              <div class="d-flex align-items-center gap-3 mb-3 p-3 rounded" :class="gaEnabled ? 'ga-status-ok' : 'ga-status-warn'">
                <div class="ga-dot" :class="gaEnabled ? 'ga-dot--green' : 'ga-dot--red'"></div>
                <div>
                  <div style="font-size: 0.82rem; font-weight: 600;">
                    {{ gaEnabled ? 'GA4 追蹤已啟用' : 'GA4 尚未設定' }}
                  </div>
                  <div style="font-size: 0.75rem; color: #888;">
                    {{ gaEnabled ? `Measurement ID：${measurementId}` : '請在 .env 填入 VITE_GA_MEASUREMENT_ID' }}
                  </div>
                </div>
              </div>

              <!-- Events list -->
              <div class="mb-1" style="font-size: 0.75rem; font-weight: 600; color: #888; letter-spacing: 0.06em; text-transform: uppercase;">
                已追蹤事件
              </div>
              <div class="ga-event-list">
                <div v-for="ev in trackedEvents" :key="ev.event" class="ga-event-row">
                  <div class="d-flex align-items-center gap-2">
                    <span class="ga-badge">{{ ev.event }}</span>
                    <span style="font-size: 0.82rem;">{{ ev.label }}</span>
                  </div>
                  <span style="font-size: 0.72rem; color: #aaa;">{{ ev.where }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Setup Guide Card -->
          <div class="card">
            <div class="card-header">
              <span class="fw-semibold" style="font-size: 0.85rem;">設定教學</span>
            </div>
            <div class="card-body">
              <ol class="ga-guide-list">
                <li>
                  前往
                  <a :href="ga4ConsoleUrl" target="_blank" rel="noopener" class="ga-link">Google Analytics</a>
                  建立 GA4 屬性，取得 Measurement ID（格式 <code>G-XXXXXXXXXX</code>）
                </li>
                <li>
                  在專案根目錄的 <code>.env</code> 中填入：<br>
                  <code class="ga-code-block">VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX</code>
                </li>
                <li>重新部署或重啟開發伺服器讓設定生效</li>
                <li>
                  （選用）建立
                  <a href="https://lookerstudio.google.com/" target="_blank" rel="noopener" class="ga-link">Looker Studio</a>
                  報表並取得嵌入連結，貼到下方設定欄
                </li>
              </ol>

              <!-- Looker Studio URL config -->
              <hr class="my-3" style="border-color: #f0ece6;">
              <div style="font-size: 0.8rem; font-weight: 600; margin-bottom: 8px;">Looker Studio 嵌入網址</div>
              <p style="font-size: 0.75rem; color: #999; margin-bottom: 10px;">
                請至<strong>「設定 → 設定相關」</strong>新增一筆設定，Name 填 <code>ga_looker_studio_url</code>，Value 貼上 Looker Studio 分享嵌入連結。
              </p>
              <div v-if="configLoading" class="text-muted" style="font-size: 0.8rem;">載入中...</div>
              <div v-else-if="lookerUrl" class="d-flex align-items-center gap-2">
                <span class="ga-dot ga-dot--green" style="flex-shrink:0;"></span>
                <span style="font-size: 0.78rem; color: #666; word-break: break-all;">已設定</span>
              </div>
              <div v-else class="d-flex align-items-center gap-2">
                <span class="ga-dot ga-dot--red" style="flex-shrink:0;"></span>
                <span style="font-size: 0.78rem; color: #aaa;">尚未設定 ga_looker_studio_url</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Right column — Looker Studio embed or placeholder -->
        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-header d-flex align-items-center justify-content-between">
              <span class="fw-semibold" style="font-size: 0.85rem;">Looker Studio 報表</span>
              <a v-if="lookerUrl" :href="lookerUrl" target="_blank" rel="noopener" class="ga-link" style="font-size: 0.75rem;">
                在新視窗開啟 ↗
              </a>
              <a v-else href="https://lookerstudio.google.com/" target="_blank" rel="noopener" class="ga-link" style="font-size: 0.75rem;">
                前往 Looker Studio ↗
              </a>
            </div>
            <div class="card-body p-0">

              <!-- Embed iframe -->
              <iframe
                v-if="lookerUrl"
                :src="lookerUrl"
                class="ga-embed"
                frameborder="0"
                allowfullscreen
                sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />

              <!-- Placeholder -->
              <div v-else class="ga-placeholder">
                <div class="ga-placeholder__inner">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C8A882" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                  <p class="mb-1" style="font-size: 0.9rem; font-weight: 600; color: #4a4440;">尚未設定 Looker Studio</p>
                  <p style="font-size: 0.78rem; color: #999; max-width: 320px; line-height: 1.6;">
                    請依左側教學建立 Looker Studio 報表，並在系統設定中加入
                    <code>ga_looker_studio_url</code> 設定值，報表將嵌入顯示在此。
                  </p>
                  <div class="mt-3 d-flex gap-2 justify-content-center flex-wrap">
                    <a href="https://lookerstudio.google.com/" target="_blank" rel="noopener"
                       class="btn btn-primary btn-sm" style="font-size: 0.75rem; letter-spacing: 0.06em;">
                      建立 Looker Studio 報表
                    </a>
                    <a href="https://analytics.google.com/" target="_blank" rel="noopener"
                       class="btn btn-outline-secondary btn-sm" style="font-size: 0.75rem; letter-spacing: 0.06em;">
                      開啟 GA4 主控台
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.ga-icon-wrap {
  width: 44px;
  height: 44px;
  background: rgba(200, 168, 130, 0.12);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #C8A882;
  flex-shrink: 0;
}

.ga-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ga-dot--green { background: #4caf7d; }
.ga-dot--red   { background: #e57373; }

.ga-status-ok   { background: rgba(76,175,125,0.06); border: 1px solid rgba(76,175,125,0.2); }
.ga-status-warn { background: rgba(229,115,115,0.06); border: 1px solid rgba(229,115,115,0.2); }

.ga-event-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.ga-event-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #faf7f4;
  border-radius: 4px;
}

.ga-badge {
  display: inline-block;
  padding: 1px 7px;
  background: rgba(200,168,130,0.15);
  color: #9a6e3a;
  border-radius: 3px;
  font-size: 0.7rem;
  font-family: monospace;
  letter-spacing: 0.02em;
  font-weight: 600;
}

.ga-guide-list {
  font-size: 0.82rem;
  color: #555;
  line-height: 1.8;
  padding-left: 18px;
  margin: 0;
}

.ga-guide-list li { margin-bottom: 10px; }

.ga-link {
  color: #C8A882;
  text-decoration: none;
  border-bottom: 1px solid rgba(200,168,130,0.3);
}
.ga-link:hover {
  color: #a0805a;
  border-bottom-color: #a0805a;
}

.ga-code-block {
  display: block;
  margin-top: 4px;
  padding: 6px 10px;
  background: #f5f0eb;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #333;
  word-break: break-all;
}

code {
  background: #f5f0eb;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.78rem;
  color: #7a5c3a;
}

.ga-embed {
  width: 100%;
  height: 600px;
  display: block;
  border: none;
}

.ga-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 48px 24px;
  background: #faf7f4;
}

.ga-placeholder__inner {
  text-align: center;
}
</style>
