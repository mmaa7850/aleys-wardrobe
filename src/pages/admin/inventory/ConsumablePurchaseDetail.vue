<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { db } from '@/lib/db'

const props  = defineProps({ id: String })
const router = useRouter()

const order       = ref(null)
const items       = ref([])
const consumables = ref([])   // 所有啟用的耗材
const loading     = ref(false)
const errMsg      = ref('')
const confirming  = ref(false)

// ── 新增 / 編輯 modal ──────────────────────────────────────────
const modalEl = ref(null)
let modalInstance = null

const mode    = ref('create')
const saving  = ref(false)
const saveErr = ref('')
const form    = ref({ ID: null, ConsumableID: '', Qty: 1, UnitCost: 0 })

const isDraft = computed(() => order.value?.Status === 'draft')
const total   = computed(() => items.value.reduce((s, i) => s + Number(i.SubTotal ?? 0), 0))

onMounted(async () => {
  await nextTick()
  if (modalEl.value) modalInstance = new Modal(modalEl.value, { backdrop: 'static' })
  await load()
})

async function load() {
  loading.value = true
  errMsg.value  = ''
  const [{ data: o, error: oe }, { data: its, error: ie }, { data: cs }] = await Promise.all([
    db.from('C_INV_ConsumablePurchaseList').select('*').eq('ID', props.id).single(),
    db.from('C_INV_ConsumablePurchaseItemList')
      .select('ID, "ConsumableID", "ConsumableName", "Qty", "UnitCost", "SubTotal"')
      .eq('PurchaseID', props.id).order('ID'),
    db.from('C_INV_ConsumableList')
      .select('ID, "Name", "Unit", "CostPrice", "StockQty"')
      .eq('IsActive', true).order('Category').order('Name'),
  ])
  if (oe) { errMsg.value = oe.message; loading.value = false; return }
  if (ie) { errMsg.value = ie.message; loading.value = false; return }
  order.value       = o
  items.value       = its ?? []
  consumables.value = cs ?? []
  loading.value = false
}

// ── 新增品項 ──────────────────────────────────────────────────
function openAddItem() {
  mode.value  = 'create'
  saveErr.value = ''
  form.value  = { ID: null, ConsumableID: '', Qty: 1, UnitCost: 0 }
  modalInstance?.show()
}

function openEditItem(item) {
  mode.value  = 'edit'
  saveErr.value = ''
  form.value  = { ID: item.ID, ConsumableID: item.ConsumableID, Qty: item.Qty, UnitCost: item.UnitCost }
  modalInstance?.show()
}

function onConsumableChange() {
  const c = consumables.value.find(c => c.ID === Number(form.value.ConsumableID))
  if (c) form.value.UnitCost = Number(c.CostPrice) || 0
}

async function submitItem() {
  if (!form.value.ConsumableID) { saveErr.value = '請選擇耗材'; return }
  if (form.value.Qty < 1) { saveErr.value = '數量至少 1'; return }
  saving.value = true
  saveErr.value = ''

  const c = consumables.value.find(c => c.ID === Number(form.value.ConsumableID))
  const subTotal = parseFloat((Number(form.value.Qty) * Number(form.value.UnitCost)).toFixed(2))

  const payload = {
    ConsumableID:   Number(form.value.ConsumableID),
    ConsumableName: c?.Name ?? '',
    Qty:            Number(form.value.Qty),
    UnitCost:       parseFloat(Number(form.value.UnitCost).toFixed(4)),
    SubTotal:       subTotal,
  }

  let error
  if (mode.value === 'create') {
    ;({ error } = await db.from('C_INV_ConsumablePurchaseItemList')
      .insert({ ...payload, PurchaseID: Number(props.id) }))
  } else {
    ;({ error } = await db.from('C_INV_ConsumablePurchaseItemList')
      .update(payload).eq('ID', form.value.ID))
  }

  saving.value = false
  if (error) { saveErr.value = error.message; return }
  modalInstance?.hide()
  await load()
}

async function deleteItem(id) {
  if (!confirm('確定刪除此品項？')) return
  const { error } = await db.from('C_INV_ConsumablePurchaseItemList').delete().eq('ID', id)
  if (error) { errMsg.value = error.message; return }
  await load()
}

// ── 確認進貨 ──────────────────────────────────────────────────
async function confirmPurchase() {
  if (!items.value.length) { errMsg.value = '請先新增進貨品項'; return }
  if (!confirm('確認進貨後無法修改，系統將更新各耗材的庫存與單位成本，確定嗎？')) return

  confirming.value = true
  errMsg.value = ''
  try {
    // 取得目前各耗材的 StockQty 和 CostPrice
    const consumableIds = [...new Set(items.value.map(i => i.ConsumableID))]
    const { data: currentData, error: ce } = await db
      .from('C_INV_ConsumableList')
      .select('ID, "CostPrice", "StockQty"')
      .in('ID', consumableIds)
    if (ce) throw ce

    const currentMap = Object.fromEntries(currentData.map(c => [c.ID, c]))

    // 計算並更新每個耗材（加權平均成本 + 增加庫存）
    for (const item of items.value) {
      const cur     = currentMap[item.ConsumableID] ?? {}
      const oldQty  = Number(cur.StockQty  ?? 0)
      const oldCost = Number(cur.CostPrice ?? 0)
      const newQty  = oldQty + Number(item.Qty)
      const newCost = newQty > 0
        ? (oldQty * oldCost + Number(item.Qty) * Number(item.UnitCost)) / newQty
        : 0

      const { error: ue } = await db
        .from('C_INV_ConsumableList')
        .update({
          CostPrice:   parseFloat(newCost.toFixed(4)),
          StockQty:    newQty,
          UpdatedDate: new Date().toISOString(),
        })
        .eq('ID', item.ConsumableID)
      if (ue) throw ue
    }

    // 更新進貨單狀態
    const { error: se } = await db
      .from('C_INV_ConsumablePurchaseList')
      .update({ Status: 'confirmed', UpdatedDate: new Date().toISOString() })
      .eq('ID', props.id)
    if (se) throw se

    await load()
  } catch (e) {
    errMsg.value = e?.message ?? String(e)
  } finally {
    confirming.value = false
  }
}

const fmt = (n) => Number(n ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const STATUS_LABEL = { draft: '草稿', confirmed: '已確認' }
const STATUS_CLASS = { draft: 'badge bg-warning text-dark', confirmed: 'badge bg-success' }
</script>

<template>
  <div class="container-fluid py-4">
    <!-- Header -->
    <div class="d-flex align-items-center gap-3 mb-4">
      <button class="btn btn-sm btn-outline-secondary" @click="router.push('/admin/inventory/consumable-purchases')">← 返回</button>
      <div>
        <h4 class="mb-0 fw-semibold">耗材進貨單</h4>
        <span v-if="order" class="font-monospace text-muted small">{{ order.PurchaseNo }}</span>
      </div>
      <span v-if="order" :class="STATUS_CLASS[order.Status] ?? 'badge bg-secondary'">
        {{ STATUS_LABEL[order.Status] ?? order.Status }}
      </span>
    </div>

    <div v-if="errMsg" class="alert alert-danger py-2">{{ errMsg }}</div>
    <div v-if="loading" class="text-center py-5 text-muted">
      <div class="spinner-border spinner-border-sm me-2"></div>載入中…
    </div>

    <template v-else-if="order">
      <!-- 進貨明細 -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white d-flex align-items-center justify-content-between">
          <span class="fw-medium">進貨品項</span>
          <button v-if="isDraft" class="btn btn-sm btn-outline-primary" @click="openAddItem">＋ 新增品項</button>
        </div>
        <div class="card-body p-0">
          <div v-if="!items.length" class="text-center py-4 text-muted">尚無品項</div>
          <div v-else class="table-responsive">
            <table class="table align-middle mb-0" style="font-size:13px">
              <thead class="table-light">
                <tr>
                  <th>耗材名稱</th>
                  <th class="text-end">數量</th>
                  <th class="text-end">單位成本</th>
                  <th class="text-end">小計</th>
                  <th v-if="isDraft" style="width:80px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.ID">
                  <td class="fw-medium">{{ item.ConsumableName }}</td>
                  <td class="text-end">{{ item.Qty }}</td>
                  <td class="text-end text-muted">NT$ {{ fmt(item.UnitCost) }}</td>
                  <td class="text-end fw-medium">NT$ {{ fmt(item.SubTotal) }}</td>
                  <td v-if="isDraft" class="text-end">
                    <button class="btn btn-xs btn-outline-secondary me-1" @click="openEditItem(item)">✎</button>
                    <button class="btn btn-xs btn-outline-danger" @click="deleteItem(item.ID)">✕</button>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-light">
                <tr>
                  <td colspan="3" class="text-end fw-semibold">合計</td>
                  <td class="text-end fw-bold">NT$ {{ fmt(total) }}</td>
                  <td v-if="isDraft"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- 確認進貨按鈕 -->
      <div v-if="isDraft" class="d-flex justify-content-end">
        <button class="btn btn-success px-4" @click="confirmPurchase" :disabled="confirming || !items.length">
          <span v-if="confirming" class="spinner-border spinner-border-sm me-2"></span>
          ✔ 確認進貨（更新庫存與成本）
        </button>
      </div>
      <div v-else class="alert alert-success py-2 mb-0">
        ✅ 已確認進貨，庫存與單位成本已更新。
      </div>
    </template>

    <!-- 新增/編輯品項 Modal -->
    <div ref="modalEl" class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ mode === 'create' ? '新增品項' : '編輯品項' }}</h5>
            <button type="button" class="btn-close" @click="modalInstance?.hide()"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveErr" class="alert alert-danger py-2">{{ saveErr }}</div>
            <div class="mb-3">
              <label class="form-label">耗材 *</label>
              <select v-model="form.ConsumableID" class="form-select" @change="onConsumableChange" :disabled="saving">
                <option value="">請選擇耗材…</option>
                <option v-for="c in consumables" :key="c.ID" :value="c.ID">
                  {{ c.Name }}（目前庫存 {{ c.StockQty }} {{ c.Unit }}，成本 NT$ {{ fmt(c.CostPrice) }}）
                </option>
              </select>
            </div>
            <div class="row g-3">
              <div class="col-6">
                <label class="form-label">進貨數量 *</label>
                <input v-model.number="form.Qty" type="number" min="1" class="form-control" :disabled="saving" />
              </div>
              <div class="col-6">
                <label class="form-label">本次單位成本（NT$）*</label>
                <input v-model.number="form.UnitCost" type="number" min="0" step="0.01" class="form-control" :disabled="saving" />
              </div>
            </div>
            <div class="mt-2 text-muted small">
              小計：NT$ {{ fmt(form.Qty * form.UnitCost) }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="submitItem" :disabled="saving">
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

<style scoped>
.btn-xs { padding: 2px 6px; font-size: 11px; }
</style>
