<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const tableName = "S_MKT_BannerList";
const BUCKET = "banners";

const POSITIONS = [
  { value: "home-hero",   label: "首頁 Hero 右側圖",  desc: "取代首頁右半的裝飾區，建議比例 3:4（直式）" },
  { value: "home-banner", label: "首頁活動橫幅",      desc: "Ticker 下方全寬橫幅，建議比例 16:5（橫式）" },
];

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const modalEl = ref(null);
let modalInstance = null;

const mode = ref("create");
const saving = ref(false);
const saveError = ref("");
const uploading = ref(false);
const fileInput = ref(null);

const emptyForm = () => ({
  ID: null,
  ImagePath: "",
  LinkURL: "",
  AltText: "",
  Position: "home-hero",
  SortOrder: 0,
  StartDate: "",
  EndDate: "",
  IsActive: true,
});

const form = ref(emptyForm());
const titleText = computed(() => mode.value === "create" ? "新增 Banner" : "修改 Banner");

const getPublicUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
};

const previewUrl = computed(() => getPublicUrl(form.value.ImagePath?.trim()));
const positionLabel = (val) => POSITIONS.find(p => p.value === val)?.label || val || "-";

const countActive = (pos) => rows.value.filter(r => r.Position === pos && r.IsActive).length;

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
    Position: row.Position ?? "home-hero",
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

const uploadImage = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { saveError.value = "只支援圖片格式"; return; }
  uploading.value = true;
  saveError.value = "";
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const storagePath = `banners/${fileName}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (upErr) throw upErr;
    form.value.ImagePath = storagePath;
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
};

const validate = () => {
  if (!form.value.ImagePath?.trim()) return "請上傳圖片或填入圖片網址";
  if (!form.value.Position) return "請選擇顯示位置";
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
      LinkURL: form.value.LinkURL?.trim() || null,
      AltText: form.value.AltText?.trim() || null,
      Position: form.value.Position,
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
  if (!window.confirm("確定要刪除此 Banner 嗎？")) return;
  try {
    if (row.ImagePath && !row.ImagePath.startsWith("http")) {
      await supabase.storage.from(BUCKET).remove([row.ImagePath]);
    }
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await load();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

const toggleActive = async (row) => {
  try {
    const { error } = await db.from(tableName).update({ IsActive: !row.IsActive, UpdatedDate: new Date().toISOString() }).eq("ID", row.ID);
    if (error) throw error;
    row.IsActive = !row.IsActive;
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
  <div class="container-fluid py-4">

    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 class="mb-1 fw-semibold" style="color:#3d2e1e">Banner 管理</h4>
        <p class="text-muted small mb-0">管理首頁各區塊的活動圖片，支援日期排程與快速開關</p>
      </div>
      <button class="btn btn-primary d-inline-flex align-items-center gap-2" @click="openCreate">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新增 Banner
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2 small">{{ errorMsg }}</div>

    <!-- Position guide -->
    <div class="row g-3 mb-4">
      <div v-for="pos in POSITIONS" :key="pos.value" class="col-md-6">
        <div class="pos-card">
          <div class="pos-card__icon" :class="`pos-card__icon--${pos.value.replace('home-', '')}`">
            <svg v-if="pos.value === 'home-hero'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="flex-1">
            <div class="pos-card__label">{{ pos.label }}</div>
            <div class="pos-card__desc">{{ pos.desc }}</div>
          </div>
          <div class="ms-auto text-end">
            <div class="pos-card__count" :class="countActive(pos.value) ? 'pos-card__count--on' : ''">
              {{ countActive(pos.value) }} 個啟用
            </div>
            <code class="pos-card__code">{{ pos.value }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Banner list -->
    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-4 text-center text-muted small">載入中...</div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th style="width:72px">預覽</th>
                <th>位置</th>
                <th>Alt 文字</th>
                <th>排序</th>
                <th>有效期間</th>
                <th style="width:100px">狀態</th>
                <th style="width:84px" class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="7" class="text-center text-muted py-5 small">尚未建立任何 Banner</td>
              </tr>
              <tr v-for="r in rows" :key="r.ID">
                <td>
                  <div class="bn-thumb">
                    <img v-if="getPublicUrl(r.ImagePath)" :src="getPublicUrl(r.ImagePath)" :alt="r.AltText || ''" />
                    <div v-else class="bn-thumb__empty">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="bn-pos" :class="`bn-pos--${r.Position?.replace('home-', '') || 'other'}`">
                    {{ positionLabel(r.Position) }}
                  </span>
                </td>
                <td class="text-muted small">{{ r.AltText || '—' }}</td>
                <td class="text-muted small">{{ r.SortOrder }}</td>
                <td class="text-muted small">
                  <span v-if="r.StartDate || r.EndDate">{{ r.StartDate || '—' }} → {{ r.EndDate || '無限期' }}</span>
                  <span v-else class="text-muted">長期有效</span>
                </td>
                <td>
                  <button class="bn-toggle" :class="r.IsActive ? 'bn-toggle--on' : 'bn-toggle--off'" @click="toggleActive(r)" type="button">
                    {{ r.IsActive ? '顯示中' : '隱藏' }}
                  </button>
                </td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-secondary" @click="openEdit(r)" type="button" title="修改">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" @click="deleteRow(r)" type="button" title="刪除">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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
    <div ref="modalEl" class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ titleText }}</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveError" class="alert alert-danger py-2 small mb-3">{{ saveError }}</div>

            <!-- Position -->
            <div class="mb-3">
              <label class="form-label">顯示位置 <span class="text-danger">*</span></label>
              <div class="row g-2">
                <div v-for="p in POSITIONS" :key="p.value" class="col-sm-6">
                  <label
                    class="pos-radio"
                    :class="{ 'pos-radio--active': form.Position === p.value }"
                    @click="form.Position = p.value"
                  >
                    <span class="pos-radio__label">{{ p.label }}</span>
                    <span class="pos-radio__desc">{{ p.desc }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Image upload -->
            <div class="mb-3">
              <label class="form-label">Banner 圖片 <span class="text-danger">*</span></label>

              <div v-if="previewUrl" class="bn-preview mb-2">
                <img :src="previewUrl" alt="預覽" />
                <button class="bn-preview__rm" type="button" @click="form.ImagePath = ''" title="移除">×</button>
              </div>

              <div v-if="!previewUrl" class="bn-upload-zone" @click="fileInput?.click()">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span v-if="!uploading">點擊上傳圖片</span>
                <span v-else>
                  <span class="spinner-border spinner-border-sm me-1"></span>上傳中...
                </span>
              </div>
              <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="uploadImage" :disabled="uploading || saving" />

              <div class="form-text mt-2">或直接貼入圖片網址：</div>
              <input v-model="form.ImagePath" type="text" class="form-control form-control-sm mt-1"
                placeholder="https://..." :disabled="saving || uploading" />
            </div>

            <!-- Alt + Link -->
            <div class="row g-3 mb-3">
              <div class="col-sm-6">
                <label class="form-label">Alt 文字</label>
                <input v-model="form.AltText" type="text" class="form-control" placeholder="夏季新品特賣" :disabled="saving" />
              </div>
              <div class="col-sm-6">
                <label class="form-label">點擊連結（選填）</label>
                <input v-model="form.LinkURL" type="text" class="form-control" placeholder="/products 或 https://..." :disabled="saving" />
              </div>
            </div>

            <!-- Date + sort + active -->
            <div class="row g-3">
              <div class="col-sm-4">
                <label class="form-label">開始日期</label>
                <input v-model="form.StartDate" type="date" class="form-control" :disabled="saving" />
                <div class="form-text">空白＝即日起</div>
              </div>
              <div class="col-sm-4">
                <label class="form-label">結束日期</label>
                <input v-model="form.EndDate" type="date" class="form-control" :disabled="saving" />
                <div class="form-text">空白＝無限期</div>
              </div>
              <div class="col-sm-2">
                <label class="form-label">排序</label>
                <input v-model.number="form.SortOrder" type="number" min="0" class="form-control" :disabled="saving" />
              </div>
              <div class="col-sm-2 d-flex align-items-end pb-1">
                <div class="form-check">
                  <input id="bnIsActive" v-model="form.IsActive" type="checkbox" class="form-check-input" :disabled="saving" />
                  <label class="form-check-label small" for="bnIsActive">立即顯示</label>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="submit" :disabled="saving || uploading">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              確定儲存
            </button>
            <button class="btn btn-outline-secondary" @click="closeModal" :disabled="saving">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Position guide cards ────────────────────────────────── */
.pos-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #fdf9f5;
  border: 1px solid #e8ddd0;
  border-radius: 8px;
  font-size: 13px;
}
.pos-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pos-card__icon--hero   { background: rgba(200,168,130,0.18); color: #8c6840; }
.pos-card__icon--banner { background: rgba(140,114,96,0.14);  color: #6b5040; }
.pos-card__label { font-weight: 600; color: #3d2e1e; margin-bottom: 2px; }
.pos-card__desc  { font-size: 11.5px; color: #a0907e; }
.pos-card__count { font-size: 12px; font-weight: 600; color: #9ca3af; margin-bottom: 2px; }
.pos-card__count--on { color: #16a34a; }
.pos-card__code  { font-size: 10.5px; color: #c0a080; }
.flex-1 { flex: 1; min-width: 0; }

/* ── Table thumbnail ─────────────────────────────────────── */
.bn-thumb {
  width: 56px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5ede2;
  border: 1px solid #e8ddd0;
}
.bn-thumb img { width: 100%; height: 100%; object-fit: cover; }
.bn-thumb__empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0b0a0;
}

/* ── Position badge ──────────────────────────────────────── */
.bn-pos {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 3px;
}
.bn-pos--hero   { background: rgba(200,168,130,0.18); color: #8c6840; }
.bn-pos--banner { background: rgba(140,114,96,0.12);  color: #6b5040; }
.bn-pos--other  { background: #f3f4f6; color: #6b7280; }

/* ── Active toggle ───────────────────────────────────────── */
.bn-toggle {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 3px;
  border: 1px solid;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
  background: none;
}
.bn-toggle--on  { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
.bn-toggle--on:hover  { background: #dcfce7; }
.bn-toggle--off { color: #9ca3af; border-color: #e5e7eb; background: #f9fafb; }
.bn-toggle--off:hover { background: #f3f4f6; }

/* ── Modal: position radio ───────────────────────────────── */
.pos-radio {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
  border: 1.5px solid #e0d5c8;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.pos-radio:hover { border-color: #C8A882; }
.pos-radio--active { border-color: #C8A882; background: rgba(200,168,130,0.08); }
.pos-radio__label { font-size: 13px; font-weight: 600; color: #3d2e1e; }
.pos-radio__desc  { font-size: 11px; color: #a0907e; }

/* ── Modal: image upload ─────────────────────────────────── */
.bn-preview {
  position: relative;
  display: inline-block;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e8ddd0;
  max-height: 220px;
}
.bn-preview img {
  display: block;
  max-height: 220px;
  max-width: 100%;
  object-fit: contain;
  background: #f5ede2;
}
.bn-preview__rm {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: none;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bn-upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px;
  border: 1.5px dashed #e0d5c8;
  border-radius: 6px;
  background: #fdf9f5;
  cursor: pointer;
  color: #a0907e;
  font-size: 13px;
  transition: border-color 0.18s, background 0.18s;
}
.bn-upload-zone:hover {
  border-color: #C8A882;
  background: rgba(200,168,130,0.06);
}
</style>
