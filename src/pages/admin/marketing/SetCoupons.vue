<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";

const { t } = useI18n();

const tableName = "S_PRM_CouponList";

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const modalEl = ref(null);
let modalInstance = null;

const mode = ref("create"); // "create" | "edit"
const saving = ref(false);
const saveError = ref("");
const today = new Date().toISOString().slice(0, 10);

const form = ref({
  ID: null,
  Name: "",
  Description: "",
  DiscountValue: 0,
  MinOrderAmount: null,
  IsAutoApply: false,
  StartDate: today,
  EndDate: today,
  IsActive: false,
  UsageCount: 1,
});

const titleText = computed(() =>
  mode.value === "create" ? t("market.setcoupon.createTitle") : t("market.setcoupon.editTitle")
);

const resetForm = () => {
  form.value.ID = null;
  form.value.Name = "";
  form.value.Description = "";
  form.value.DiscountValue = 0;
  form.value.MinOrderAmount = null;
  form.value.IsAutoApply = false;
  form.value.StartDate = today;
  form.value.EndDate = today;
  form.value.IsActive = false;
  form.value.UsageCount = 1;
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

  form.value.ID = row.ID;
  form.value.Name = row.Name ?? "";
  form.value.Description = row.Description ?? "";
  form.value.DiscountValue = row.DiscountValue ?? 0;
  form.value.MinOrderAmount = row.MinOrderAmount ?? null;
  form.value.IsAutoApply = row.IsAutoApply ?? false;
  form.value.StartDate = row.StartDate ?? today;
  form.value.EndDate = row.EndDate ?? today;
  form.value.IsActive = row.IsActive ?? false;
  form.value.UsageCount = row.UsageCount ?? 0;

  await ensureModal();
  modalInstance.show();
};

const closeModal = () => {
  modalInstance?.hide();
};

const loadCoupons = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    const { data, error } = await db
      .from(tableName)
      .select('ID, "Name", "Description", "DiscountValue", "MinOrderAmount", "IsAutoApply", "StartDate", "EndDate", "IsActive", "UsageCount", "UpdatedDate", "CreatedDate"')
      .order("ID", { ascending: false });

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
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
};

const validateForm = () => {
  const name = form.value.Name?.trim();
  const desc = form.value.Description?.trim();
  const discount = form.value.DiscountValue ?? 0;
  const sDate = form.value.StartDate?.trim();
  const eDate = form.value.EndDate?.trim();
  const usageCount = form.value.UsageCount ?? 0;

  if (!name) return t("market.setcoupon.validateNameRequired");
  if (!desc) return t("market.setcoupon.validateDescriptionRequired");
  if (!discount) return t("market.setcoupon.validateDiscountValueRequired");
  if (!usageCount) return t("market.setcoupon.validateUsageCountRequired");

  // ✅ 日期檢查開始
  const s = form.value.StartDate;
  const e = form.value.EndDate;

  if (!sDate) return t("market.setcoupon.validateStartDateRequired");
  if (!eDate) return t("market.setcoupon.validateEndDateRequired");

  // 用 YYYY-MM-DD 組成「本地時間」的 Date，避免時區造成日期跑掉
  const start = new Date(`${s}T00:00:00`);
  const end = new Date(`${e}T00:00:00`);

  if (Number.isNaN(start.getTime())) return t("market.setcoupon.startDateInvalid");
  if (Number.isNaN(end.getTime())) return t("market.setcoupon.endDateInvalid");
  if (end < start) return t("market.setcoupon.endBeforeStart");
  // ✅ 日期檢查結束

  return "";
};

const createCoupon = async () => {
  saveError.value = "";
  const msg = validateForm();
  if (msg) {
    saveError.value = msg;
    return;
  }

  saving.value = true;
  try {
    const payload = {
      Name: form.value.Name.trim(),
      Description: form.value.Description?.trim(),
      DiscountValue: form.value.DiscountValue,
      MinOrderAmount: form.value.MinOrderAmount || null,
      IsAutoApply: form.value.IsAutoApply,
      StartDate: form.value.StartDate?.trim(),
      EndDate: form.value.EndDate.trim(),
      IsActive: form.value.IsActive,
      UsageCount: form.value.UsageCount,
      UpdatedDate: new Date().toISOString(),
      CreatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).insert(payload);
    if (error) throw error;

    closeModal();
    await loadCoupons();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const updateCoupon = async () => {
  saveError.value = "";

  if (!form.value.ID) {
    saveError.value = t("market.setcoupon.missingId");
    return;
  }

  const msg = validateForm();
  if (msg) {
    saveError.value = msg;
    return;
  }

  saving.value = true;
  try {
    const payload = {
      Description: form.value.Description?.trim(),
      DiscountValue: form.value.DiscountValue,
      MinOrderAmount: form.value.MinOrderAmount || null,
      IsAutoApply: form.value.IsAutoApply,
      StartDate: form.value.StartDate?.trim(),
      EndDate: form.value.EndDate.trim(),
      IsActive: form.value.IsActive,
      UsageCount: form.value.UsageCount,
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).update(payload).eq("ID", form.value.ID);
    if (error) throw error;

    closeModal();
    await loadCoupons();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const submitModal = async () => {
  if (mode.value === "create") return createCoupon();
  return updateCoupon();
};

const deleteRow = async (row) => {
  const ok = window.confirm(t("market.setcoupon.confirmDelete", { name: row.Name }));
  if (!ok) return;

  try {
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await loadCoupons();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await loadCoupons();
});
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">{{ t("market.setcoupon.title") }}</h4>
        <div class="text-muted small">{{ t("market.setcoupon.tableName") }}</div>
      </div>

      <button class="btn btn-primary d-inline-flex align-items-center gap-2" @click="openCreateModal">
        <span style="font-weight: 700; line-height: 1">＋</span>
        <span>{{ t("common.create") }}</span>
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger">
      {{ errorMsg }}
    </div>

    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-3">
          <div class="text-muted">{{ t("common.loading") }}</div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th style="width: 10%">{{ t("market.setcoupon.name") }}</th>
                <th style="width: 11%">{{ t("market.setcoupon.description") }}</th>
                <th style="width: 7%">{{ t("market.setcoupon.discountValue") }}</th>
                <th style="width: 8%">最低消費</th>
                <th style="width: 7%">自動折抵</th>
                <th style="width: 10%">{{ t("market.setcoupon.startDate") }}</th>
                <th style="width: 10%">{{ t("market.setcoupon.endDate") }}</th>
                <th style="width: 10%">{{ t("market.setcoupon.isActive") }}</th>
                <th style="width: 7%">{{ t("market.setcoupon.usageCount") }}</th>
                <th style="width: 15%">{{ t("market.setcoupon.updatedDate") }}</th>
                <th style="width: 15%">{{ t("market.setcoupon.createdDate") }}</th>
                <th class="text-end" style="width: 5%">{{ t("common.action") }}</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="10" class="text-center text-muted py-4">
                  {{ t("common.noData") }}
                </td>
              </tr>

              <tr v-for="r in rows" :key="r.ID">
                <td class="fw-semibold">{{ r.Name }}</td>
                <td class="text-muted">{{ r.Description }}</td>
                <td class="text-muted">{{ r.DiscountValue }}</td>
                <td class="text-muted">{{ r.MinOrderAmount ? `NT$ ${r.MinOrderAmount}` : '—' }}</td>
                <td class="text-muted">{{ r.IsAutoApply ? '✅' : '—' }}</td>
                <td class="text-muted">{{ r.StartDate }}</td>
                <td class="text-muted">{{ r.EndDate }}</td>
                <td class="text-muted">{{ r.IsActive }}</td>
                <td class="text-muted">{{ r.UsageCount }}</td>
                <td class="text-muted">{{ formatDate(r.UpdatedDate) }}</td>
                <td class="text-muted">{{ formatDate(r.CreatedDate) }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-success btn-icon" @click="openEditModal(r)" :title="t('common.edit')"
                      type="button">
                      ✎
                    </button>

                    <button class="btn btn-sm btn-danger btn-icon" @click="deleteRow(r)" :title="t('common.delete')"
                      type="button">
                      🗑
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
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ titleText }}</h5>
            <button type="button" class="btn-close" aria-label="Close" @click="closeModal"></button>
          </div>

          <div class="modal-body">
            <div v-if="saveError" class="alert alert-danger py-2">
              {{ saveError }}
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("market.setcoupon.name") }}</label>
              <input v-model="form.Name" type="text" class="form-control" placeholder="e.g. Christmas"
                :disabled="saving || mode === 'edit'" />
              <div class="form-text">
                {{ mode === "edit" ? t("market.setcoupon.nameHintEdit") : t("market.setcoupon.nameHintCreate") }}
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("market.setcoupon.description") }}</label>
              <input v-model="form.Description" type="text" class="form-control" placeholder="e.g. 聖誕節"
                :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("market.setcoupon.discountValue") }}</label>
              <input v-model="form.DiscountValue" type="number" class="form-control" placeholder="e.g. 200"
                :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">最低消費金額（選填）</label>
              <input v-model="form.MinOrderAmount" type="number" min="0" class="form-control" placeholder="e.g. 1000（留空表示無限制）"
                :disabled="saving" />
              <div class="form-text">訂單商品小計需達此金額才可使用此優惠券</div>
            </div>

            <div class="mb-3 form-check">
              <input id="isAutoApply" v-model="form.IsAutoApply" type="checkbox" class="form-check-input"
                :disabled="saving" />
              <label class="form-check-label" for="isAutoApply">
                滿額自動折抵（不需輸入優惠碼，達門檻自動套用）
              </label>
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("market.setcoupon.startDate") }}</label>
              <input v-model="form.StartDate" type="date" class="form-control" placeholder="e.g. 2025-12-19"
                :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("market.setcoupon.endDate") }}</label>
              <input v-model="form.EndDate" type="date" class="form-control" placeholder="e.g. 2025-12-19"
                :disabled="saving" />
            </div>

            <div class="mb-3 form-check">
              <input id="isActive" v-model="form.IsActive" type="checkbox" class="form-check-input"
                :disabled="saving" />
              <label class="form-check-label" for="isActive">
                {{ t("market.setcoupon.isActive") }}
              </label>
            </div>

            <div class="mb-1">
              <label class="form-label">{{ t("market.setcoupon.usageCount") }}</label>
              <input v-model="form.UsageCount" type="number" min="1" step="1" inputmode="numeric" class="form-control" placeholder="e.g. 1"
                :disabled="saving" />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primary" @click="submitModal" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ t("common.confirm") }}
            </button>
            <button class="btn btn-outline-secondary" @click="closeModal" :disabled="saving">
              {{ t("common.cancel") }}
            </button>
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
  line-height: 1;
}
</style>