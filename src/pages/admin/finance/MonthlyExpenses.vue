<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

// ── filters ───────────────────────────────────────────────────
const now      = new Date()
const selYear  = ref(now.getFullYear())
const selMonth = ref(now.getMonth() + 1)

const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)

// ── data ──────────────────────────────────────────────────────
const rows       = ref([])
const categories = ref([])
const loading    = ref(false)
const errMsg     = ref('')

const total = computed(() => rows.value.reduce((s, r) => s + Number(r.Amount ?? 0), 0))

// ── modal ─────────────────────────────────────────────────────
const modalEl = ref(null)
let modalInstance = null
const mode    = ref('create')
const saving  = ref(false)
const saveErr = ref('')
const form    = ref({ ID: null, CategoryID: '', Name: '', Amount: 0, Note: '' })

onMounted(async () => {
  await nextTick()
  if (modalEl.value) modalInstance = new Modal(modalEl.value, { backdrop: 'static' })
  await Promise.all([loadCategories(), load()])
})

async function loadCategories() {
  const { data } = await db
    .from('S_FIN_ExpenseCategoryList')
    .select('ID, "Name"')
    .eq('IsActive', true)
    .order('SortOrder')
  categories.value = data ?? []
}

async function load() {
  loading.value = true
  errMsg.value  = ''
  const { data, error } = await db
    .from('C_FIN_MonthlyExpenseList')
    .select('ID, "CategoryID", "Name", "Amount", "Note", S_FIN_ExpenseCategoryList("Name")')
    .eq('Year',  selYear.value)
    .eq('Month', selMonth.value)
    .order('ID')
  if (error) errMsg.value = error.message
  else rows.value = data ?? []
  loading.value = false
}

function openCreate() {
  mode.value    = 'create'
  saveErr.value = ''
  form.value    = { ID: null, CategoryID: categories.value[0]?.ID ?? '', Name: '', Amount: 0, Note: '' }
  modalInstance?.show()
}

function openEdit(row) {
  mode.value    = 'edit'
  saveErr.value = ''
  form.value    = { ID: row.ID, CategoryID: row.CategoryID, Name: row.Name ?? '', Amount: Number(row.Amount ?? 0), Note: row.Note ?? '' }
  modalInstance?.show()
}

async function submit() {
  if (!form.value.CategoryID) { saveErr.value = '請選擇費用分類'; return }
  if (!form.value.Name?.trim()) { saveErr.value = '請填寫費用說明'; return }
  if (Number(form.value.Amount) <= 0) { saveErr.value = '金額必須大於 0'; return }
  saving.value  = true
  const now2 = new Date().toISOString()
  const payload = {
    CategoryID: Number(form.value.CategoryID),
    Name:       form.value.Name.trim(),
    Amount:     parseFloat(Number(form.value.Amount).toFixed(2)),
    Note:       form.value.Note?.trim() || null,
    Year:       selYear.value,
    Month:      selMonth.value,
    UpdatedDate: now2,
  }
  let error
  if (mode.value === 'create') {
    ;({ error } = await db.from('C_FIN_MonthlyExpenseList').insert({ ...payload, CreatedDate: now2 }))
  } else {
    ;({ error } = await db.from('C_FIN_MonthlyExpenseList').update(payload).eq('ID', form.value.ID))
  }
  saving.value = false
  if (error) { saveErr.value = error.message; return }
  modalInstance?.hide()
  await load()
}

async function deleteRow(id) {
  if (!confirm('確定刪除此費用記錄？')) return
  const { error } = await db.from('C_FIN_MonthlyExpenseList').delete().eq('ID', id)
  if (error) { errMsg.value = error.message; return }
  await load()
}

const fmt = (n) => Number(n ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDec = (n) => Number(n ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function catName(row) {
  return row.S_FIN_ExpenseCategoryList?.Name ?? '—'
}
</script>

<template>
  <div class="container-fluid py-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-0 fw-semibold">月度費用</h4>
        <small class="text-muted">記錄每月固定與非固定的營運費用（租金、水電、設備…）</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">＋ 新增費用</button>
    </div>

    <!-- 月份篩選 -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-2">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 fw-medium">年份</label>
            <select v-model.number="selYear" class="form-select form-select-sm" style="width:auto" @change="load">
              <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 fw-medium">月份</label>
            <select v-model.number="selMonth" class="form-select form-select-sm" style="width:auto" @change="load">
              <option v-for="m in months" :key="m" :value="m">{{ m }} 月</option>
            </select>
          </div>
          <div class="ms-auto fw-semibold text-primary">
            本月合計：NT$ {{ fmtDec(total) }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div v-if="loading" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm me-2"></div>載入中…
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:13px">
            <thead class="table-light">
              <tr>
                <th>分類</th>
                <th>費用說明</th>
                <th class="text-end">金額（NT$）</th>
                <th>備註</th>
                <th class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td colspan="5" class="text-center text-muted py-5">
                  {{ selYear }}年{{ selMonth }}月 尚無費用記錄
                </td>
              </tr>
              <tr v-for="r in rows" :key="r.ID">
                <td><span class="badge bg-info text-dark">{{ catName(r) }}</span></td>
                <td class="fw-medium">{{ r.Name }}</td>
                <td class="text-end font-monospace">{{ fmtDec(r.Amount) }}</td>
                <td class="text-muted small">{{ r.Note || '—' }}</td>
                <td class="text-end">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" @click="openEdit(r)">✎</button>
                    <button class="btn btn-outline-danger" @click="deleteRow(r.ID)">✕</button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="rows.length" class="table-light">
              <tr>
                <td colspan="2" class="fw-semibold text-end">合計</td>
                <td class="text-end fw-bold font-monospace">{{ fmtDec(total) }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div ref="modalEl" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ mode === 'create' ? '新增費用' : '編輯費用' }}</h5>
            <button type="button" class="btn-close" @click="modalInstance?.hide()"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveErr" class="alert alert-danger py-2">{{ saveErr }}</div>

            <div class="row g-2 mb-3">
              <div class="col-12">
                <div class="text-muted small mb-1">紀錄月份：{{ selYear }}年{{ selMonth }}月</div>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">費用分類 *</label>
              <select v-model.number="form.CategoryID" class="form-select" :disabled="saving">
                <option value="">請選擇…</option>
                <option v-for="c in categories" :key="c.ID" :value="c.ID">{{ c.Name }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">費用說明 *</label>
              <input v-model="form.Name" type="text" class="form-control" placeholder="e.g. 6月房租、電費" :disabled="saving" />
            </div>
            <div class="mb-3">
              <label class="form-label">金額（NT$）*</label>
              <input v-model.number="form.Amount" type="number" min="0" step="1" class="form-control" :disabled="saving" />
            </div>
            <div class="mb-3">
              <label class="form-label">備註</label>
              <input v-model="form.Note" type="text" class="form-control" placeholder="選填" :disabled="saving" />
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
