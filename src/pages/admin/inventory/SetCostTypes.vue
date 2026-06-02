<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

const TABLE = 'S_INV_CostTypeList'

const rows    = ref([])
const loading = ref(false)
const errMsg  = ref('')

const modalEl  = ref(null)
let   modalInst = null

const mode    = ref('create')
const saving  = ref(false)
const saveErr = ref('')

const form = ref({ ID: null, Name: '', Description: '', SortOrder: 0, IsActive: true })

const resetForm = () => {
  form.value = { ID: null, Name: '', Description: '', SortOrder: rows.value.length + 1, IsActive: true }
  saveErr.value = ''
}

const ensureModal = async () => {
  await nextTick()
  if (!modalInst && modalEl.value) {
    modalInst = new Modal(modalEl.value, { backdrop: 'static' })
  }
}

const openCreate = async () => {
  mode.value = 'create'
  resetForm()
  await ensureModal()
  modalInst.show()
}

const openEdit = async (row) => {
  mode.value = 'edit'
  saveErr.value = ''
  form.value = {
    ID:          row.ID,
    Name:        row.Name        ?? '',
    Description: row.Description ?? '',
    SortOrder:   row.SortOrder   ?? 0,
    IsActive:    row.IsActive    ?? true,
  }
  await ensureModal()
  modalInst.show()
}

const closeModal = () => modalInst?.hide()

async function load() {
  loading.value = true
  errMsg.value  = ''
  try {
    const { data, error } = await db.from(TABLE)
      .select('ID, "Name", "Description", "SortOrder", "IsActive", "UpdatedDate"')
      .order('SortOrder', { ascending: true })
    if (error) throw error
    rows.value = data ?? []
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

const validate = () => {
  if (!form.value.Name?.trim()) return '請輸入成本項目名稱'
  return ''
}

async function save() {
  const msg = validate()
  if (msg) { saveErr.value = msg; return }

  saving.value = true
  saveErr.value = ''
  try {
    const payload = {
      Name:        form.value.Name.trim(),
      Description: form.value.Description?.trim() || null,
      SortOrder:   Number(form.value.SortOrder) || 0,
      IsActive:    form.value.IsActive,
      UpdatedDate: new Date().toISOString(),
    }

    let error
    if (mode.value === 'create') {
      ;({ error } = await db.from(TABLE).insert(payload))
    } else {
      ;({ error } = await db.from(TABLE).update(payload).eq('ID', form.value.ID))
    }
    if (error) throw error
    closeModal()
    await load()
  } catch (e) {
    saveErr.value = e?.message ?? String(e)
  } finally {
    saving.value = false
  }
}

async function toggleActive(row) {
  const { error } = await db.from(TABLE)
    .update({ IsActive: !row.IsActive, UpdatedDate: new Date().toISOString() })
    .eq('ID', row.ID)
  if (!error) row.IsActive = !row.IsActive
}

onMounted(load)
</script>

<template>
  <div class="container-fluid py-4">

    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 class="mb-0 fw-semibold">成本項目設定</h4>
        <small class="text-muted">管理進貨附加成本類型（如：大陸段運費、關稅等）</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>新增項目
      </button>
    </div>

    <!-- Error -->
    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <!-- Table -->
    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm me-2"></div>載入中…
        </div>
        <div v-else-if="!rows.length" class="text-center py-5 text-muted">尚無成本項目</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:60px">排序</th>
                <th>項目名稱</th>
                <th>說明</th>
                <th>狀態</th>
                <th style="width:100px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.ID">
                <td class="text-center text-muted">{{ row.SortOrder }}</td>
                <td class="fw-medium">{{ row.Name }}</td>
                <td class="text-muted small">{{ row.Description || '—' }}</td>
                <td>
                  <span class="badge" :class="row.IsActive ? 'bg-success' : 'bg-secondary'">
                    {{ row.IsActive ? '啟用' : '停用' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm btn-outline-secondary me-1" @click="openEdit(row)">編輯</button>
                  <button
                    class="btn btn-sm"
                    :class="row.IsActive ? 'btn-outline-warning' : 'btn-outline-success'"
                    @click="toggleActive(row)"
                  >{{ row.IsActive ? '停用' : '啟用' }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>

  <!-- Modal -->
  <div ref="modalEl" class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ mode === 'create' ? '新增成本項目' : '編輯成本項目' }}</h5>
          <button type="button" class="btn-close" @click="closeModal"></button>
        </div>
        <div class="modal-body">
          <div v-if="saveErr" class="alert alert-danger py-2 mb-3">{{ saveErr }}</div>

          <div class="mb-3">
            <label class="form-label fw-medium">項目名稱 <span class="text-danger">*</span></label>
            <input v-model="form.Name" type="text" class="form-control" placeholder="例：大陸段物流費" />
          </div>
          <div class="mb-3">
            <label class="form-label">說明</label>
            <input v-model="form.Description" type="text" class="form-control" placeholder="選填說明" />
          </div>
          <div class="mb-3">
            <label class="form-label">排序</label>
            <input v-model.number="form.SortOrder" type="number" class="form-control" min="0" style="width:120px" />
          </div>
          <div class="form-check">
            <input v-model="form.IsActive" class="form-check-input" type="checkbox" id="chkActive" />
            <label class="form-check-label" for="chkActive">啟用</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal" :disabled="saving">取消</button>
          <button class="btn btn-primary" @click="save" :disabled="saving">
            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
            儲存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
