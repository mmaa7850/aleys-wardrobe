<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { useI18n } from "vue-i18n";
import { supabase } from "@/lib/supabase";

const { t } = useI18n();

const tableName = "S_PRD_CategoryList";

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
});

const titleText = computed(() =>
  mode.value === "create" ? t("product.setcategories.createTitle") : t("product.setcategories.editTitle")
);

const resetForm = () => {
  form.value.ID = null;
  form.value.Name = "";
  form.value.Description = "";
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

  await ensureModal();
  modalInstance.show();
};

const closeModal = () => {
  modalInstance?.hide();
};

const loadColors = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('ID, "Name", "Description", "UpdatedDate"')
      .order("ID", { ascending: false });

    if (error) throw error;
    rows.value = data ?? [];
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
};

const validateForm = () => {
  const name = form.value.Name?.trim();
  const desc = form.value.Description?.trim();

  if (!name) return t("product.setcategories.validateNameRequired");
  if (!desc) return t("product.setcategories.validateDescriptionRequired");

  return "";
};

const createColor = async () => {
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
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await supabase.from(tableName).insert(payload);
    if (error) throw error;

    closeModal();
    await loadColors();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const updateColor = async () => {
  saveError.value = "";

  if (!form.value.ID) {
    saveError.value = t("product.setcategories.missingId");
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
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await supabase.from(tableName).update(payload).eq("ID", form.value.ID);
    if (error) throw error;

    closeModal();
    await loadColors();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const submitModal = async () => {
  if (mode.value === "create") return createColor();
  return updateColor();
};

const deleteRow = async (row) => {
  const ok = window.confirm(t("product.setcategories.confirmDelete", { name: row.Name }));
  if (!ok) return;

  try {
    const { error } = await supabase.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await loadColors();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await loadColors();
});
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">{{ t("product.setcategories.title") }}</h4>
        <div class="text-muted small">{{ t("product.setcategories.tableName") }}</div>
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
                <th style="width: 30%">{{ t("product.setcategories.name") }}</th>
                <th style="width: 45%">{{ t("product.setcategories.description") }}</th>
                <th style="width: 20%">{{ t("product.setcategories.updatedDate") }}</th>
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
              <label class="form-label">{{ t("product.setcategories.name") }}</label>
              <input
                v-model="form.Name"
                type="text"
                class="form-control"
                placeholder="e.g. Clothes"
                :disabled="saving || mode === 'edit'"
              />
              <div class="form-text">
                {{ mode === "edit" ? t("product.setcategories.nameHintEdit") : t("product.setcategories.nameHintCreate") }}
              </div>
            </div>

            <div class="mb-1">
              <label class="form-label">{{ t("product.setcategories.description") }}</label>
              <input
                v-model="form.Description"
                type="text"
                class="form-control"
                placeholder="e.g. 衣服"
                :disabled="saving"
              />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline-secondary" @click="closeModal" :disabled="saving">
              {{ t("common.cancel") }}
            </button>
            <button class="btn btn-primary" @click="submitModal" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ t("common.confirm") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
