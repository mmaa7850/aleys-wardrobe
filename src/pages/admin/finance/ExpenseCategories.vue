<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

const rows   = ref([])
const loading = ref(false)
const errMsg  = ref('')

const modalEl = ref(null)
let modalInstance = null
const mode    = ref('create')
const saving  = ref(false)
const saveErr = ref('')
const form    = ref({ ID: null, Name: '', Description: '', SortOrder: 0, IsActive: true })

onMounted(async () => {
  await nextTick()
  if (modalEl.value) modalInstance = new Modal(modalEl.value, { backdrop: 'static' })
  await load()
})

async function load() {
  loading.value = true
  const { data, error } = await db
    .from('S_FIN_ExpenseCategoryList')
    .select('ID, "Name", "Description", "SortOrder", "IsActive"')
    .order('SortOrder')
  if (error) errMsg.value = error.message
  else rows.value = data ?? []
  loading.value = false
}

function openCreate() {
  mode.value = 'create'
  saveErr.value = ''
  form.value = { ID: null, Name: '', Description: '', SortOrder: 0, IsActive: true }
  modalInstance?.show()
}

function openEdit(row) {
  mode.value = 'edit'
  saveErr.value = ''
  form.value = { ID: row.ID, Name: row.Name, Description: row.Description ?? '', SortOrder: row.SortOrder ?? 0, IsActive: row.IsActive }
  modalInstance?.show()
}

async function submit() {
  if (!form.value.Name.trim()) { saveErr.value = '請填寫分類名稱'; return }
  saving.value = true
  const now = new Date().toISOString()
  const payload = {
    Name: form.value.Name.trim(),
    Description: form.value.Description?.trim() || null,
    SortOrder: Number(form.value.SortOrder) || 0,
    IsActive: form.value.IsActive,
    UpdatedDate: now,
  }
  let error
  if (mode.value === 'create') {
    ;({ error } = await db.from('S_FIN_ExpenseCategoryList').insert({ ...payload, CreatedDate: now }))
  } else {
    ;({ error } = await db.from('S_FIN_ExpenseCategoryList').update(payload).eq('ID', form.value.ID))
  }
  saving.value = false
  if (error) { saveErr.value = error.message; return }
  modalInstance?.hide()
  await load()
}
</script>

<template>
  <div class="container-fluid py-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-0 fw-semibold">費用分類設定</h4>
        <small class="text-muted">管理月度費用的分類（租金、水電、設備…）</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">＋ 新增分類</button>
    </div>

    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>載入中…</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:13px">
            <thead class="table-light">
              <tr>
                <th style="width:8%">排序</th>
                <th>分類名稱</th>
                <th>說明</th>
                <th>狀態</th>
                <th class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length"><td colspan="5" class="text-center text-muted py-5">尚無資料</td></tr>
              <tr v-for="r in rows" :key="r.ID">
                <td class="text-muted">{{ r.SortOrder }}</td>
                <td class="fw-medium">{{ r.Name }}</td>
                <td class="text-muted">{{ r.Description || '—' }}</td>
                <td><span class="badge" :class="r.IsActive ? 'bg-success' : 'bg-secondary'">{{ r.IsActive ? '啟用' : '停用' }}</span></td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-primary" @click="openEdit(r)">✎</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div ref="modalEl" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ mode === 'create' ? '新增分類' : '編輯分類' }}</h5>
            <button type="button" class="btn-close" @click="modalInstance?.hide()"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveErr" class="alert alert-danger py-2">{{ saveErr }}</div>
            <div class="mb-3">
              <label class="form-label">分類名稱 *</label>
              <input v-model="form.Name" type="text" class="form-control" placeholder="e.g. 租金" :disabled="saving" />
            </div>
            <div class="mb-3">
              <label class="form-label">說明</label>
              <input v-model="form.Description" type="text" class="form-control" placeholder="選填" :disabled="saving" />
            </div>
            <div class="mb-3">
              <label class="form-label">排序</label>
              <input v-model.number="form.SortOrder" type="number" min="0" class="form-control" :disabled="saving" />
            </div>
            <div class="form-check">
              <input id="eCatActive" v-model="form.IsActive" type="checkbox" class="form-check-input" :disabled="saving" />
              <label class="form-check-label" for="eCatActive">啟用</label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="submit" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>確認
            </button>
            <button class="btn btn-outline-secondary" @click="modalInstance?.hide()" :disabled="saving">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
