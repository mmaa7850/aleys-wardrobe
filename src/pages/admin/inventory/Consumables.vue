<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

const rows    = ref([])
const loading = ref(false)
const errMsg  = ref('')

const modalEl = ref(null)
let modalInstance = null

const mode     = ref('create')
const saving   = ref(false)
const saveErr  = ref('')

const CATEGORIES = ['包材', '贈品', '其他']
const UNITS      = ['個', '捲', '張', '片', '條', '包', '件']

const emptyForm = () => ({
  ID: null, Name: '', Category: '包材', Unit: '個',
  Description: '', IsActive: true,
})
const form = ref(emptyForm())

onMounted(async () => {
  await nextTick()
  if (modalEl.value) modalInstance = new Modal(modalEl.value, { backdrop: 'static' })
  await load()
})

async function load() {
  loading.value = true
  errMsg.value  = ''
  const { data, error } = await db
    .from('C_INV_ConsumableList')
    .select('ID, "Name", "Category", "Unit", "CostPrice", "StockQty", "Description", "IsActive"')
    .order('Category').order('Name')
  if (error) errMsg.value = error.message
  else rows.value = data ?? []
  loading.value = false
}

function openCreate() {
  mode.value = 'create'
  form.value = emptyForm()
  saveErr.value = ''
  modalInstance?.show()
}

function openEdit(row) {
  mode.value = 'edit'
  saveErr.value = ''
  form.value = {
    ID: row.ID, Name: row.Name ?? '', Category: row.Category ?? '包材',
    Unit: row.Unit ?? '個', Description: row.Description ?? '', IsActive: row.IsActive ?? true,
  }
  modalInstance?.show()
}

async function submit() {
  if (!form.value.Name.trim()) { saveErr.value = '請填寫耗材名稱'; return }
  saving.value = true
  saveErr.value = ''
  const now = new Date().toISOString()
  const payload = {
    Name: form.value.Name.trim(),
    Category: form.value.Category,
    Unit: form.value.Unit,
    Description: form.value.Description?.trim() || null,
    IsActive: form.value.IsActive,
    UpdatedDate: now,
  }
  let error
  if (mode.value === 'create') {
    ;({ error } = await db.from('C_INV_ConsumableList').insert({ ...payload, CreatedDate: now }))
  } else {
    ;({ error } = await db.from('C_INV_ConsumableList').update(payload).eq('ID', form.value.ID))
  }
  saving.value = false
  if (error) { saveErr.value = error.message; return }
  modalInstance?.hide()
  await load()
}

async function toggleActive(row) {
  const { error } = await db
    .from('C_INV_ConsumableList')
    .update({ IsActive: !row.IsActive, UpdatedDate: new Date().toISOString() })
    .eq('ID', row.ID)
  if (error) { errMsg.value = error.message; return }
  row.IsActive = !row.IsActive
}

const CATEGORY_COLOR = { '包材': 'bg-primary', '贈品': 'bg-success', '其他': 'bg-secondary' }
const fmt = (n) => Number(n ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
</script>

<template>
  <div class="container-fluid py-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-0 fw-semibold">耗材品項</h4>
        <small class="text-muted">管理可分配到訂單的耗材（包材、贈品）</small>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">＋ 新增耗材</button>
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
                <th>名稱</th>
                <th>分類</th>
                <th>單位</th>
                <th class="text-end">目前單位成本</th>
                <th class="text-end">庫存</th>
                <th>說明</th>
                <th>狀態</th>
                <th class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td colspan="8" class="text-center text-muted py-5">尚無耗材品項</td>
              </tr>
              <tr v-for="r in rows" :key="r.ID">
                <td class="fw-medium">{{ r.Name }}</td>
                <td><span class="badge" :class="CATEGORY_COLOR[r.Category] ?? 'bg-secondary'">{{ r.Category }}</span></td>
                <td class="text-muted">{{ r.Unit }}</td>
                <td class="text-end font-monospace">NT$ {{ fmt(r.CostPrice) }}</td>
                <td class="text-end">
                  <span :class="r.StockQty <= 0 ? 'text-danger fw-bold' : ''">{{ r.StockQty }}</span>
                </td>
                <td class="text-muted small">{{ r.Description || '—' }}</td>
                <td>
                  <span class="badge" :class="r.IsActive ? 'bg-success' : 'bg-secondary'">
                    {{ r.IsActive ? '啟用' : '停用' }}
                  </span>
                </td>
                <td class="text-end">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" @click="openEdit(r)">✎</button>
                    <button class="btn" :class="r.IsActive ? 'btn-outline-secondary' : 'btn-outline-success'" @click="toggleActive(r)">
                      {{ r.IsActive ? '停用' : '啟用' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div ref="modalEl" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ mode === 'create' ? '新增耗材' : '編輯耗材' }}</h5>
            <button type="button" class="btn-close" @click="modalInstance?.hide()"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveErr" class="alert alert-danger py-2">{{ saveErr }}</div>
            <div class="mb-3">
              <label class="form-label">名稱 *</label>
              <input v-model="form.Name" type="text" class="form-control" placeholder="e.g. 黑色破壞袋（小）" :disabled="saving" />
            </div>
            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label">分類</label>
                <select v-model="form.Category" class="form-select" :disabled="saving">
                  <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">單位</label>
                <select v-model="form.Unit" class="form-select" :disabled="saving">
                  <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">說明</label>
              <input v-model="form.Description" type="text" class="form-control" placeholder="選填" :disabled="saving" />
            </div>
            <div class="form-check">
              <input id="cIsActive" v-model="form.IsActive" type="checkbox" class="form-check-input" :disabled="saving" />
              <label class="form-check-label" for="cIsActive">啟用</label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="submit" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              確認
            </button>
            <button class="btn btn-outline-secondary" @click="modalInstance?.hide()" :disabled="saving">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
