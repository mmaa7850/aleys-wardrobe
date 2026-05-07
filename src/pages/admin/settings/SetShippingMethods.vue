<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";

const { t } = useI18n();

const tableName = "S_SHP_ShippingMethodList";

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const modalEl = ref(null);
let modalInstance = null;

const mode = ref("create"); // "create" | "edit"
const saving = ref(false);
const saveError = ref("");

const form = ref({
  ID: null,
  Name: "",
  Description: "",
  Fee: 0,
  MethodCode: "",
  IsActive: true,
});

const titleText = computed(() =>
  mode.value === "create" ? "新增配送方式" : "編輯配送方式"
);

const resetForm = () => {
  form.value = { ID: null, Name: "", Description: "", Fee: 0, MethodCode: "", IsActive: true };
  saveError.value = "";
};

const ensureModal = async () => {
  await nextTick();
  if (!modalInstance && modalEl.value) {
    modalInstance = new Modal(modalEl.value, { backdrop: "static" });
  }
};

const openCreateModal = async () => {
  mode.value = "create";
  resetForm();
  await ensureModal();
  modalInstance.show();
};

const openEditModal = async (row) => {
  mode.value = "edit";
  saveError.value = "";
  form.value = {
    ID: row.ID,
    Name: row.Name ?? "",
    Description: row.Description ?? "",
    Fee: row.Fee ?? 0,
    MethodCode: row.MethodCode ?? "",
    IsActive: row.IsActive ?? true,
  };
  await ensureModal();
  modalInstance.show();
};

const closeModal = () => modalInstance?.hide();

const loadShippingMethods = async () => {
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data, error } = await db
      .from(tableName)
      .select('ID, "Name", "Description", "Fee", "MethodCode", "IsActive", "UpdatedDate"')
      .order("ID", { ascending: true });
    if (error) throw error;
    rows.value = data ?? [];
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const validateForm = () => {
  if (!form.value.Name?.trim()) return "請填寫名稱";
  if (!form.value.MethodCode?.trim()) return "請填寫代碼（例：cvscom / home）";
  if (form.value.Fee < 0 || isNaN(Number(form.value.Fee))) return "運費請輸入 0 以上的數字";
  return "";
};

const createShippingMethod = async () => {
  saveError.value = "";
  const msg = validateForm();
  if (msg) { saveError.value = msg; return; }
  saving.value = true;
  try {
    const { error } = await db.from(tableName).insert({
      Name: form.value.Name.trim(),
      Description: form.value.Description?.trim() || null,
      Fee: Number(form.value.Fee),
      MethodCode: form.value.MethodCode.trim(),
      IsActive: form.value.IsActive,
      UpdatedDate: new Date().toISOString(),
    });
    if (error) throw error;
    closeModal();
    await loadShippingMethods();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const updateShippingMethod = async () => {
  saveError.value = "";
  if (!form.value.ID) { saveError.value = "缺少 ID"; return; }
  const msg = validateForm();
  if (msg) { saveError.value = msg; return; }
  saving.value = true;
  try {
    const { error } = await db.from(tableName).update({
      Description: form.value.Description?.trim() || null,
      Fee: Number(form.value.Fee),
      IsActive: form.value.IsActive,
      UpdatedDate: new Date().toISOString(),
    }).eq("ID", form.value.ID);
    if (error) throw error;
    closeModal();
    await loadShippingMethods();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const submitModal = () =>
  mode.value === "create" ? createShippingMethod() : updateShippingMethod();

const toggleActive = async (row) => {
  try {
    await db.from(tableName).update({ IsActive: !row.IsActive, UpdatedDate: new Date().toISOString() }).eq("ID", row.ID);
    row.IsActive = !row.IsActive;
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

const deleteRow = async (row) => {
  if (!window.confirm(`確定刪除「${row.Name}」？`)) return;
  try {
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await loadShippingMethods();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await loadShippingMethods();
});
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">配送方式設定</h4>
        <div class="text-muted small">S_SHP_ShippingMethodList</div>
      </div>
      <button class="btn btn-primary d-inline-flex align-items-center gap-2" @click="openCreateModal">
        <span style="font-weight:700;line-height:1">＋</span>
        <span>新增</span>
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-3 text-muted">載入中...</div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th style="width:5%">ID</th>
                <th style="width:18%">名稱</th>
                <th style="width:12%">代碼</th>
                <th style="width:8%">運費</th>
                <th style="width:28%">說明</th>
                <th style="width:8%">啟用</th>
                <th style="width:14%">更新時間</th>
                <th class="text-end" style="width:7%">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="8" class="text-center text-muted py-4">尚無資料</td>
              </tr>
              <tr v-for="r in rows" :key="r.ID">
                <td class="text-muted">{{ r.ID }}</td>
                <td class="fw-semibold">{{ r.Name }}</td>
                <td><code class="text-muted">{{ r.MethodCode }}</code></td>
                <td class="fw-semibold">NT$ {{ r.Fee }}</td>
                <td class="text-muted small">{{ r.Description }}</td>
                <td>
                  <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" :checked="r.IsActive" @change="toggleActive(r)" />
                  </div>
                </td>
                <td class="text-muted small">{{ formatDate(r.UpdatedDate) }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-success" @click="openEditModal(r)" title="編輯">✎</button>
                    <button class="btn btn-sm btn-danger" @click="deleteRow(r)" title="刪除">🗑</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div ref="modalEl" class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ titleText }}</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveError" class="alert alert-danger py-2">{{ saveError }}</div>

            <div class="mb-3">
              <label class="form-label">名稱 <span class="text-danger">*</span></label>
              <input v-model="form.Name" type="text" class="form-control" placeholder="例：超商取貨不付款" :disabled="saving || mode === 'edit'" />
              <div v-if="mode === 'edit'" class="form-text">名稱建立後不可修改</div>
            </div>

            <div class="mb-3">
              <label class="form-label">代碼 <span class="text-danger">*</span></label>
              <input v-model="form.MethodCode" type="text" class="form-control" placeholder="例：cvscom / home" :disabled="saving || mode === 'edit'" />
              <div class="form-text">
                <code>cvscom</code> = 超商取貨（藍新 CVSCOM）&nbsp;｜&nbsp;
                <code>home</code> = 宅配到府<br>
                代碼建立後不可修改，系統根據此欄位決定結帳流程。
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">運費（NT$）<span class="text-danger">*</span></label>
              <input v-model.number="form.Fee" type="number" min="0" class="form-control" placeholder="例：80" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">說明</label>
              <input v-model="form.Description" type="text" class="form-control" placeholder="例：7-11、全家、萊爾富、OK mart" :disabled="saving" />
            </div>

            <div class="mb-1">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" v-model="form.IsActive" :disabled="saving" id="isActiveSwitch" />
                <label class="form-check-label" for="isActiveSwitch">啟用此配送方式</label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="submitModal" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              確認
            </button>
            <button class="btn btn-outline-secondary" @click="closeModal" :disabled="saving">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
