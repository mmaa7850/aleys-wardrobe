<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";

const { t } = useI18n();

const tableName = "S_PRD_TagList";

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
  Slug: "",
  IsActive : false,
});

const titleText = computed(() =>
  mode.value === "create" ? t("product.settags.createTitle") : t("product.settags.editTitle")
);

const resetForm = () => {
  form.value.ID = null;
  form.value.Name = "";
  form.value.Description = "";
  form.value.Slug = "";
  form.value.IsActive = false;
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
  form.value.Slug = row.Slug ?? "";
  form.value.IsActive = row.IsActive ?? false;

  await ensureModal();
  modalInstance.show();
};

const closeModal = () => {
  modalInstance?.hide();
};

const loadTags = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    const { data, error } = await db
      .from(tableName)
      .select('ID, "Name", "Description", "Slug", "IsActive", "UpdatedDate"')
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
  const slug = form.value.Slug?.trim();

  if (!name) return t("product.settags.validateNameRequired");
  if (!desc) return t("product.settags.validateDescriptionRequired");
  if (!slug) return t("product.settags.validateSlugRequired");

  return "";
};

const createTag = async () => {
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
      Slug: form.value.Slug?.trim(),
      IsActive: form.value.IsActive,
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).insert(payload);
    if (error) throw error;

    closeModal();
    await loadTags();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const updateTag = async () => {
  saveError.value = "";

  if (!form.value.ID) {
    saveError.value = t("product.settags.missingId");
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
      Slug: form.value.Slug?.trim(),
      IsActive: form.value.IsActive,
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).update(payload).eq("ID", form.value.ID);
    if (error) throw error;

    closeModal();
    await loadTags();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const submitModal = async () => {
  if (mode.value === "create") return createTag();
  return updateTag();
};

const deleteRow = async (row) => {
  const ok = window.confirm(t("product.settags.confirmDelete", { name: row.Name }));
  if (!ok) return;

  try {
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await loadTags();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await loadTags();
});
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">{{ t("product.settags.title") }}</h4>
        <div class="text-muted small">{{ t("product.settags.tableName") }}</div>
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
                <th style="width: 20%">{{ t("product.settags.name") }}</th>
                <th style="width: 25%">{{ t("product.settags.description") }}</th>
                <th style="width: 25%">{{ t("product.settags.slug") }}</th>
                <th style="width: 10%">{{ t("product.settags.isactive") }}</th>
                <th style="width: 15%">{{ t("product.settags.updatedDate") }}</th>
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
                <td class="text-muted">{{ r.Slug }}</td>
                <td class="text-muted">{{ r.IsActive }}</td>
                <td>{{ formatDate(r.UpdatedDate) }}</td>
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
              <label class="form-label">{{ t("product.settags.name") }}</label>
              <input
                v-model="form.Name"
                type="text"
                class="form-control"
                placeholder="e.g. 1111_2025"
                :disabled="saving || mode === 'edit'"
              />
              <div class="form-text">
                {{ mode === "edit" ? t("product.settags.nameHintEdit") : t("product.settags.nameHintCreate") }}
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("product.settags.description") }}</label>
              <input
                v-model="form.Description"
                type="text"
                class="form-control"
                placeholder="e.g. 2025雙11"
                :disabled="saving"
              />
            </div>

            <div class="mb-3">
              <label class="form-label">{{ t("product.settags.slug") }}</label>
              <input
                v-model="form.Slug"
                type="text"
                class="form-control"
                placeholder="e.g. 網址用"
                :disabled="saving"
              />
            </div>

            <div class="mb-1 form-check">
              <input
              id="isActive"
              v-model="form.IsActive"
              type="checkbox"
              class="form-check-input"
              :disabled="saving"
              />
              <label class="form-check-label" for="isActive">
                {{ t("product.settags.isactive") }}
              </label>
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
