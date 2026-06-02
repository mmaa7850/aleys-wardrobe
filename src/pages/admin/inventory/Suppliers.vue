<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

const TABLE = 'S_INV_SupplierList'

const rows    = ref([])
const loading = ref(false)
const errMsg  = ref('')

const modalEl = ref(null)
let   modalInst = null

const mode    = ref('create')
const saving  = ref(false)
const saveErr = ref('')

const form = ref({ ID: null, Name: '', ContactName: '', Phone: '', Email: '', Note: '', IsActive: true })

const resetForm = () => {
  form.value = { ID: null, Name: '', ContactName: '', Phone: '', Email: '', Note: '', IsActive: true }
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
    ContactName: row.ContactName ?? '',
    Phone:       row.Phone       ?? '',
    Email:       row.Email       ?? '',
    Note:        row.Note        ?? '',
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
      .select('ID, "Name", "ContactName", "Phone", "Email", "Note", "IsActive", "UpdatedDate"')
      .order('ID', { ascending: false })
    if (error) throw error
    rows.value = data ?? []
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

const validate = () => {
  if (!form.value.Name?.trim()) return '請輸入供應商名稱'
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
      ContactName: form.value.ContactName.trim() || null,
      Phone:       form.value.Phone.trim()       || null,
      Email:       form.value.Email.trim()       || null,
      Note:        form.value.Note.trim()        || null,
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

const formatDate = (val) => {
  if (!val) return ''
  const d = new Date(val)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(load)
</script>

<template>
  <div class="container-fluid py-4">

    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 class="mb-0 fw-semibold">供應商管理</h4>
        <small class="text-muted">管理進貨供應商資料</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>新增供應商
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
        <div v-else-if="!rows.length" class="text-center py-5 text-muted">尚無供應商資料</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>供應商名稱</th>
                <th>聯絡人</th>
                <th>電話</th>
                <th>Email</th>
                <th>狀態</th>
                <th>更新時間</th>
                <th style="width:100px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.ID">
                <td class="fw-medium">{{ row.Name }}</td>
                <td>{{ row.ContactName || '—' }}</td>
                <td>{{ row.Phone || '—' }}</td>
                <td>{{ row.Email || '—' }}</td>
                <td>
                  <span class="badge" :class="row.IsActive ? 'bg-success' : 'bg-secondary'">
                    {{ row.IsActive ? '啟用' : '停用' }}
                  </span>
                </td>
                <td class="text-muted small">{{ formatDate(row.UpdatedDate) }}</td>
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
          <h5 class="modal-title">{{ mode === 'create' ? '新增供應商' : '編輯供應商' }}</h5>
          <button type="button" class="btn-close" @click="closeModal"></button>
        </div>
        <div class="modal-body">
          <div v-if="saveErr" class="alert alert-danger py-2 mb-3">{{ saveErr }}</div>

          <div class="mb-3">
            <label class="form-label fw-medium">供應商名稱 <span class="text-danger">*</span></label>
            <input v-model="form.Name" type="text" class="form-control" placeholder="例：廣州美達服裝" />
          </div>
          <div class="mb-3">
            <label class="form-label">聯絡人</label>
            <input v-model="form.ContactName" type="text" class="form-control" placeholder="聯絡人姓名" />
          </div>
          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label">電話</label>
              <input v-model="form.Phone" type="text" class="form-control" placeholder="電話號碼" />
            </div>
            <div class="col-6">
              <label class="form-label">Email</label>
              <input v-model="form.Email" type="email" class="form-control" placeholder="Email" />
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">備註</label>
            <textarea v-model="form.Note" class="form-control" rows="2" placeholder="選填備註"></textarea>
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
