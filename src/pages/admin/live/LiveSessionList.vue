<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

const router = useRouter()

const rows    = ref([])
const loading = ref(false)
const errMsg  = ref('')

// ── 新增 Modal ────────────────────────────────────────────
let _modal = null
const saving   = ref(false)
const saveErr  = ref('')
const form = ref({ Title: '', LiveDate: '', Status: 'planned', Notes: '' })

const STATUS_LABEL = { planned: '籌備中', active: '直播中', closed: '已結束' }
const STATUS_CLASS  = { planned: 'bg-secondary', active: 'bg-success', closed: 'bg-dark' }

// ── 載入場次列表 ──────────────────────────────────────────
async function loadSessions() {
  loading.value = true
  errMsg.value  = ''
  const { data, error } = await db
    .from('C_LIV_SessionList')
    .select('ID, Title, LiveDate, Status, CreatedDate')
    .order('CreatedDate', { ascending: false })
  loading.value = false
  if (error) { errMsg.value = error.message; return }
  rows.value = data || []
}

// ── 開啟新增 Modal ────────────────────────────────────────
function openCreate() {
  form.value  = { Title: '', LiveDate: '', Status: 'planned', Notes: '' }
  saveErr.value = ''
  _modal = _modal || new Modal(document.getElementById('createModal'))
  _modal.show()
}

// ── 建立場次 ──────────────────────────────────────────────
async function doCreate() {
  if (!form.value.Title.trim()) { saveErr.value = '請填寫場次名稱'; return }
  saving.value = true
  saveErr.value = ''
  const { error } = await db.from('C_LIV_SessionList').insert({
    Title:    form.value.Title.trim(),
    LiveDate: form.value.LiveDate || null,
    Status:   form.value.Status,
    Notes:    form.value.Notes.trim() || null,
  })
  saving.value = false
  if (error) { saveErr.value = error.message; return }
  _modal.hide()
  await loadSessions()
}

// ── 進入場次詳情 ──────────────────────────────────────────
function goDetail(id) {
  router.push(`/admin/live/${id}`)
}

onMounted(loadSessions)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="mb-0" style="color:#3d2e1e; font-weight:600;">直播場次管理</h5>
      <button class="btn btn-primary btn-sm" @click="openCreate">＋ 新增場次</button>
    </div>

    <p v-if="errMsg" class="alert alert-danger">{{ errMsg }}</p>

    <!-- Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead>
            <tr>
              <th>場次名稱</th>
              <th>直播日期</th>
              <th>狀態</th>
              <th>建立時間</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="text-center py-4" style="color:#a08060;">載入中...</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="5" class="text-center py-4" style="color:#a08060;">尚無直播場次</td>
            </tr>
            <tr
              v-for="r in rows"
              :key="r.ID"
              style="cursor:pointer"
              @click="goDetail(r.ID)"
            >
              <td class="fw-semibold" style="color:#3d2e1e;">{{ r.Title }}</td>
              <td>{{ r.LiveDate || '–' }}</td>
              <td>
                <span class="badge" :class="STATUS_CLASS[r.Status]">
                  {{ STATUS_LABEL[r.Status] || r.Status }}
                </span>
              </td>
              <td style="font-size:12px; color:#a08060;">
                {{ new Date(r.CreatedDate).toLocaleDateString('zh-TW') }}
              </td>
              <td @click.stop>
                <button class="btn btn-outline-primary btn-sm" @click="goDetail(r.ID)">
                  管理 →
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增場次 Modal -->
    <div class="modal fade" id="createModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">新增直播場次</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">場次名稱 <span class="text-danger">*</span></label>
              <input v-model="form.Title" class="form-control" placeholder="例：2026/5 春夏新品直播" />
            </div>
            <div class="mb-3">
              <label class="form-label">直播日期</label>
              <input v-model="form.LiveDate" type="date" class="form-control" />
            </div>
            <div class="mb-3">
              <label class="form-label">狀態</label>
              <select v-model="form.Status" class="form-select">
                <option value="planned">籌備中</option>
                <option value="active">直播中</option>
                <option value="closed">已結束</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">備注</label>
              <textarea v-model="form.Notes" class="form-control" rows="2" placeholder="選填"></textarea>
            </div>
            <p v-if="saveErr" class="text-danger mb-0" style="font-size:13px;">{{ saveErr }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">取消</button>
            <button class="btn btn-primary btn-sm" :disabled="saving" @click="doCreate">
              {{ saving ? '建立中...' : '建立場次' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
