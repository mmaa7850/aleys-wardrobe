<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { db } from "@/lib/db";

const tableName = "S_MKT_BannerList";

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const modalEl = ref(null);
let modalInstance = null;

const mode = ref("create");
const saving = ref(false);
const saveError = ref("");

const emptyForm = () => ({
  ID: null,
  ImagePath: "",
  LinkURL: "",
  AltText: "",
  Position: "",
  SortOrder: 0,
  StartDate: "",
  EndDate: "",
  IsActive: true,
});

const form = ref(emptyForm());

const titleText = computed(() => mode.value === "create" ? "建立 Banner" : "修改 Banner");

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
    ImagePath: row.ImagePath ?? "",
    LinkURL: row.LinkURL ?? "",
    AltText: row.AltText ?? "",
    Position: row.Position ?? "",
    SortOrder: row.SortOrder ?? 0,
    StartDate: row.StartDate ?? "",
    EndDate: row.EndDate ?? "",
    IsActive: row.IsActive ?? true,
  };
  await ensureModal();
  modalInstance.show();
};

const closeModal = () => modalInstance?.hide();

const load = async () => {
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data, error } = await db
      .from(tableName)
      .select("ID, ImagePath, LinkURL, AltText, Position, SortOrder, StartDate, EndDate, IsActive, UpdatedDate")
      .order("SortOrder", { ascending: true });
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
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const validate = () => {
  if (!form.value.ImagePath?.trim()) return "圖片路徑不能空白";
  return "";
};

const submit = async () => {
  saveError.value = "";
  const msg = validate();
  if (msg) { saveError.value = msg; return; }

  saving.value = true;
  try {
    const payload = {
      ImagePath: form.value.ImagePath.trim(),
      LinkURL: form.value.LinkURL?.trim() ?? "",
      AltText: form.value.AltText?.trim() ?? "",
      Position: form.value.Position?.trim() ?? "",
      SortOrder: Number(form.value.SortOrder) || 0,
      StartDate: form.value.StartDate || null,
      EndDate: form.value.EndDate || null,
      IsActive: form.value.IsActive,
      UpdatedDate: new Date().toISOString(),
    };

    if (mode.value === "create") {
      const { error } = await db.from(tableName).insert({ ...payload, CreatedDate: new Date().toISOString() });
      if (error) throw error;
    } else {
      const { error } = await db.from(tableName).update(payload).eq("ID", form.value.ID);
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

const deleteRow = async (row) => {
  if (!window.confirm(`確定要刪除此 Banner 嗎？`)) return;
  try {
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await load();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await load();
});
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">Banner 管理</h4>
        <div class="text-muted small">{{ tableName }}</div>
      </div>
      <button class="btn btn-primary d-inline-flex align-items-center gap-2" @click="openCreate">
        <span style="font-weight:700;line-height:1">＋</span>
        <span>建立</span>
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
                <th style="width:5%">排序</th>
                <th style="width:12%">位置</th>
                <th style="width:22%">圖片路徑</th>
                <th style="width:16%">Alt 文字</th>
                <th style="width:10%">開始日</th>
                <th style="width:10%">結束日</th>
                <th style="width:7%">顯示</th>
                <th style="width:13%">更新時間</th>
                <th style="width:5%" class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="9" class="text-center text-muted py-4">目前沒有資料</td>
              </tr>
              <tr v-for="r in rows" :key="r.ID">
                <td class="text-muted">{{ r.SortOrder }}</td>
                <td><span class="badge bg-secondary">{{ r.Position || '-' }}</span></td>
                <td class="text-muted text-truncate" style="max-width:160px" :title="r.ImagePath">{{ r.ImagePath }}</td>
                <td class="text-muted">{{ r.AltText }}</td>
                <td class="text-muted">{{ r.StartDate || '-' }}</td>
                <td class="text-muted">{{ r.EndDate || '-' }}</td>
                <td>
                  <span :class="r.IsActive ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ r.IsActive ? '顯示' : '隱藏' }}
                  </span>
                </td>
                <td class="text-muted">{{ formatDate(r.UpdatedDate) }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-success btn-icon" @click="openEdit(r)" title="修改" type="button">✎</button>
                    <button class="btn btn-sm btn-danger btn-icon" @click="deleteRow(r)" title="刪除" type="button">🗑</button>
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
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ titleText }}</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveError" class="alert alert-danger py-2">{{ saveError }}</div>

            <div class="mb-3">
              <label class="form-label">圖片路徑 <span class="text-danger">*</span></label>
              <input v-model="form.ImagePath" type="text" class="form-control" placeholder="e.g. /images/banner-summer.jpg 或完整 URL" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">Alt 文字</label>
              <input v-model="form.AltText" type="text" class="form-control" placeholder="e.g. 夏季新品" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">連結網址</label>
              <input v-model="form.LinkURL" type="text" class="form-control" placeholder="https://... （選填）" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">位置（Position）</label>
              <input v-model="form.Position" type="text" class="form-control" placeholder="e.g. home-hero, home-sub" :disabled="saving" />
              <div class="form-text">前台依此值決定顯示在哪個區塊</div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label">開始日期</label>
                <input v-model="form.StartDate" type="date" class="form-control" :disabled="saving" />
              </div>
              <div class="col-6">
                <label class="form-label">結束日期</label>
                <input v-model="form.EndDate" type="date" class="form-control" :disabled="saving" />
              </div>
            </div>

            <div class="row g-3 mb-1">
              <div class="col-6">
                <label class="form-label">排序（小的在前）</label>
                <input v-model.number="form.SortOrder" type="number" min="0" class="form-control" :disabled="saving" />
              </div>
              <div class="col-6 d-flex align-items-end">
                <div class="form-check mb-2">
                  <input id="bannerIsActive" v-model="form.IsActive" type="checkbox" class="form-check-input" :disabled="saving" />
                  <label class="form-check-label" for="bannerIsActive">顯示此 Banner</label>
                </div>
              </div>
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
