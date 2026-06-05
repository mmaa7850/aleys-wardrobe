<script setup>
import { ref, onMounted, nextTick } from "vue";
import { Modal } from "bootstrap";
import { db } from "@/lib/db";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const levels = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const modalEl = ref(null);
let modalInstance = null;

const mode = ref("create");
const saving = ref(false);
const saveError = ref("");

const emptyForm = () => ({ ID: null, Name: "", Description: "", SortOrder: 0, MinSpendingAmount: 0, IsActive: true });
const form = ref(emptyForm());

onMounted(load);

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data, error } = await db
      .from("S_MBR_MemberLevelList")
      .select("ID, Name, Description, SortOrder, IsActive, CreatedDate, UpdatedDate")
      .order("SortOrder");
    if (error) throw error;
    levels.value = data ?? [];
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
}

const ensureModal = async () => {
  await nextTick();
  if (!modalInstance && modalEl.value) {
    modalInstance = new Modal(modalEl.value, { backdrop: "static" });
  }
};

const openCreate = async () => {
  mode.value = "create";
  form.value = emptyForm();
  saveError.value = "";
  await ensureModal();
  modalInstance.show();
};

const openEdit = async (row) => {
  mode.value = "edit";
  saveError.value = "";
  form.value = {
    ID: row.ID,
    Name: row.Name ?? "",
    Description: row.Description ?? "",
    SortOrder: row.SortOrder ?? 0,
    MinSpendingAmount: row.MinSpendingAmount ?? 0,
    IsActive: row.IsActive ?? true,
  };
  await ensureModal();
  modalInstance.show();
};

const closeModal = () => modalInstance?.hide();

const submit = async () => {
  saveError.value = "";
  if (!form.value.Name?.trim()) { saveError.value = "名稱不能空白"; return; }

  saving.value = true;
  try {
    const now = new Date().toISOString();
    if (mode.value === "create") {
      const { error } = await db.from("S_MBR_MemberLevelList").insert({
        Name: form.value.Name.trim(),
        Description: form.value.Description.trim(),
        SortOrder: Number(form.value.SortOrder) || 0,
        MinSpendingAmount: Number(form.value.MinSpendingAmount) || 0,
        IsActive: form.value.IsActive,
        CreatedDate: now,
        UpdatedDate: now,
      });
      if (error) throw error;
    } else {
      const { error } = await db.from("S_MBR_MemberLevelList")
        .update({
          Name: form.value.Name.trim(),
          Description: form.value.Description.trim(),
          SortOrder: Number(form.value.SortOrder) || 0,
          MinSpendingAmount: Number(form.value.MinSpendingAmount) || 0,
          IsActive: form.value.IsActive,
          UpdatedDate: now,
        })
        .eq("ID", form.value.ID);
      if (error) throw error;
    }
    closeModal();
    await load();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">會員等級設定</h4>
        <div class="text-muted small">S_MBR_MemberLevelList</div>
      </div>
      <button
        v-if="auth.isAdmin"
        class="btn btn-primary d-inline-flex align-items-center gap-2"
        @click="openCreate"
      >
        <span style="font-weight:700;line-height:1">＋</span>
        <span>新增等級</span>
      </button>
    </div>

    <div class="alert alert-info py-2 mb-3 small">
      「一般會員」與「VIP 會員」為預設等級。等級升降可在<strong>會員列表</strong>中逐一調整。
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-3 text-muted">載入中...</div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th style="width:5%">排序</th>
                <th style="width:18%">名稱</th>
                <th style="width:28%">描述</th>
                <th style="width:16%">兩年累積門檻</th>
                <th style="width:8%">狀態</th>
                <th style="width:11%">建立時間</th>
                <th style="width:11%">更新時間</th>
                <th v-if="auth.isAdmin" style="width:3%" class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="levels.length === 0">
                <td :colspan="auth.isAdmin ? 8 : 7" class="text-center text-muted py-4">目前沒有資料</td>
              </tr>
              <tr v-for="r in levels" :key="r.ID">
                <td class="text-muted">{{ r.SortOrder }}</td>
                <td class="fw-semibold">
                  {{ r.Name }}
                  <span v-if="r.Name === 'VIP 會員'" class="badge ms-1" style="background:#c8a882;color:#fff">VIP</span>
                </td>
                <td class="text-muted small">{{ r.Description || "—" }}</td>
                <td class="small">
                  <span v-if="r.MinSpendingAmount > 0" class="fw-semibold">NT$ {{ r.MinSpendingAmount.toLocaleString() }}</span>
                  <span v-else class="text-muted">無門檻</span>
                </td>
                <td>
                  <span :class="r.IsActive ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ r.IsActive ? "啟用" : "停用" }}
                  </span>
                </td>
                <td class="text-muted small">{{ formatDate(r.CreatedDate) }}</td>
                <td class="text-muted small">{{ formatDate(r.UpdatedDate) }}</td>
                <td v-if="auth.isAdmin" class="text-end">
                  <button class="btn btn-sm btn-success btn-icon" @click="openEdit(r)" title="修改" type="button">✎</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal（只有 IsAdmin 才看得到按鈕，但保留 modal 結構） -->
    <div ref="modalEl" class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ mode === "create" ? "新增等級" : "修改等級" }}</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveError" class="alert alert-danger py-2">{{ saveError }}</div>

            <div class="mb-3">
              <label class="form-label">名稱 <span class="text-danger">*</span></label>
              <input v-model="form.Name" type="text" class="form-control" placeholder="e.g. VIP 會員" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">描述</label>
              <input v-model="form.Description" type="text" class="form-control" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">排序</label>
              <input v-model.number="form.SortOrder" type="number" min="0" class="form-control" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">兩年累積消費門檻 <span class="text-muted small">（NT$，填 0 表示無門檻，不會被自動降級）</span></label>
              <input v-model.number="form.MinSpendingAmount" type="number" min="0" step="100" class="form-control" :disabled="saving" placeholder="e.g. 10000" />
            </div>

            <div class="form-check">
              <input id="fLevelActive" v-model="form.IsActive" type="checkbox" class="form-check-input" :disabled="saving" />
              <label class="form-check-label" for="fLevelActive">啟用</label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="submit" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              確定
            </button>
            <button class="btn btn-outline-secondary" @click="closeModal" :disabled="saving">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-icon {
  width: 34px;
  height: 31px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
