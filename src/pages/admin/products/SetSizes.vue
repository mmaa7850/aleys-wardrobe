<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";
import { formatDateTime } from "@/utils/date";

const { t } = useI18n();

const tableName = "S_PRD_SizeList";

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
  SortOrder: 0,
});

const titleText = computed(() =>
  mode.value === "create" ? t("product.setsizes.createTitle") : t("product.setsizes.editTitle")
);

const resetForm = () => {
  form.value.ID = null;
  form.value.Name = "";
  form.value.Description = "";
  form.value.SortOrder = 0;
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
  form.value.SortOrder = row.SortOrder ?? 0;

  await ensureModal();
  modalInstance.show();
};

const closeModal = () => {
  modalInstance?.hide();
};

const loadSizes = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    const { data, error } = await db
      .from(tableName)
      .select('ID, "Name", "Description", "SortOrder", "UpdatedDate"')
      .order("SortOrder", { ascending: true });

    if (error) throw error;
    rows.value = data ?? [];
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
};

const validateForm = () => {
  const name = form.value.Name?.trim();
  const desc = form.value.Description?.trim();
  const sortOrder = form.value.SortOrder ?? 0;

  if (!name) return t("product.setsizes.validateNameRequired");
  if (!desc) return t("product.setsizes.validateDescriptionRequired");
  if (!sortOrder) return t("product.setsizes.validateSortOrderRequired");

  return "";
};

const createSize = async () => {
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
      SortOrder: form.value.SortOrder,
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).insert(payload);
    if (error) throw error;

    closeModal();
    await loadSizes();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const updateSize = async () => {
  saveError.value = "";

  if (!form.value.ID) {
    saveError.value = t("product.setsizes.missingId");
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
      SortOrder: form.value.SortOrder,
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).update(payload).eq("ID", form.value.ID);
    if (error) throw error;

    closeModal();
    await loadSizes();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const submitModal = async () => {
  if (mode.value === "create") return createSize();
  return updateSize();
};

const deleteRow = async (row) => {
  const ok = window.confirm(t("product.setsizes.confirmDelete", { name: row.Name }));
  if (!ok) return;

  try {
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await loadSizes();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await loadSizes();
});
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">{{ t("product.setsizes.title") }}</h4>
        <div class="text-muted small">{{ t("product.setsizes.tableName") }}</div>
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
                <th style="width: 30%">{{ t("product.setsizes.name") }}</th>
                <th style="width: 40%">{{ t("product.setsizes.description") }}</th>
                <th style="width: 10%">{{ t("product.setsizes.sortOrder") }}</th>
                <th style="width: 15%">{{ t("product.setsizes.updatedDate") }}</th>
                <th class="text-end" style="width: 5%">{{ t("common.action") }}</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="4" class="text-center text-muted py-4">
                  {{ t("common.noData") }}
                </td>
              </tr>

              <tr v-for="r in rows" :key="r.ID">
                <td class="fw-semibold">{{ r.Name }}</td>
                <td class="text-muted">{{ r.Description }}</td>
                <td class="text-muted">{{ r.SortOrder }}</td>
                <td>{{ formatDateTime(r.UpdatedDate) }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-success" @click="openEditModal(r)" :title="t('common.edit')">
                      ✎
                    </button>
                    <button class="btn btn-sm btn-danger" @click="deleteRow(r)" :title="t('common.delete')">
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
              <label class="form-label">{{ t("product.setsizes.name") }}</label>
              <input
                v-model="form.Name"
                type="text"
                class="form-control"
                placeholder="e.g. M"
                :disabled="saving || mode === 'edit'"
              />
              <div class="form-text">
                {{ mode === "edit" ? t("product.setsizes.nameHintEdit") : t("product.setsizes.nameHintCreate") }}
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("product.setsizes.description") }}</label>
              <input
                v-model="form.Description"
                type="text"
                class="form-control"
                placeholder="e.g. M"
                :disabled="saving"
              />
            </div>

            <div class="mb-1">
              <label class="form-label">{{ t("product.setsizes.sortOrder") }}</label>
              <input
                v-model="form.SortOrder"
                type="num"
                min="1"
                class="form-control"
                placeholder="e.g. 1"
                :disabled="saving"
              />
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
