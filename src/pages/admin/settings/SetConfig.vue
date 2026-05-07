<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { Modal } from "bootstrap";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";

const { t } = useI18n();

const tableName = "S_SYS_Config";

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
  Value: "",
  Category: "",
});

const titleText = computed(() =>
  mode.value === "create" ? t("settings.setconfig.createTitle") : t("settings.setconfig.editTitle")
);

const resetForm = () => {
  form.value.ID = null;
  form.value.Name = "";
  form.value.Description = "";
  form.value.Value = "";
  form.value.Category = "";
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
  form.value.Value = row.Value ?? "";
  form.value.Category = row.Category ?? "";

  await ensureModal();
  modalInstance.show();
};

const closeModal = () => {
  modalInstance?.hide();
};

const loadConfig = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    const { data, error } = await db
      .from(tableName)
      .select('ID, "Name", "Description", "Value", "Category", "UpdatedDate"')
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

  if (!name) return t("settings.setconfig.validateNameRequired");
  if (!desc) return t("settings.setconfig.validateDescriptionRequired");

  return "";
};

const createConfig = async () => {
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
      Value: form.value.Value?.trim() ?? "",
      Category: form.value.Category?.trim() ?? "",
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).insert(payload);
    if (error) throw error;

    closeModal();
    await loadConfig();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const updateConfig = async () => {
  saveError.value = "";

  if (!form.value.ID) {
    saveError.value = t("settings.setconfig.missingId");
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
      Value: form.value.Value?.trim() ?? "",
      Category: form.value.Category?.trim() ?? "",
      UpdatedDate: new Date().toISOString(),
    };

    const { error } = await db.from(tableName).update(payload).eq("ID", form.value.ID);
    if (error) throw error;

    closeModal();
    await loadConfig();
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
};

const submitModal = async () => {
  if (mode.value === "create") return createConfig();
  return updateConfig();
};

const deleteRow = async (row) => {
  const ok = window.confirm(t("settings.setconfig.confirmDelete", { name: row.Name }));
  if (!ok) return;

  try {
    const { error } = await db.from(tableName).delete().eq("ID", row.ID);
    if (error) throw error;
    await loadConfig();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};

onMounted(async () => {
  await ensureModal();
  await loadConfig();
});
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">{{ t("settings.setconfig.title") }}</h4>
        <div class="text-muted small">{{ t("settings.setconfig.tableName") }}</div>
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
                <th style="width: 15%">{{ t("settings.setconfig.name") }}</th>
                <th style="width: 15%">分類</th>
                <th style="width: 20%">值</th>
                <th style="width: 30%">{{ t("settings.setconfig.description") }}</th>
                <th style="width: 15%">{{ t("settings.setconfig.updatedDate") }}</th>
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
                <td><span class="badge bg-secondary">{{ r.Category }}</span></td>
                <td class="font-monospace">{{ r.Value }}</td>
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
              <label class="form-label">{{ t("settings.setconfig.name") }}</label>
              <input
                v-model="form.Name"
                type="text"
                class="form-control"
                placeholder="e.g. Shipping"
                :disabled="saving || mode === 'edit'"
              />
              <div class="form-text">
                {{ mode === "edit" ? t("settings.setconfig.nameHintEdit") : t("settings.setconfig.nameHintCreate") }}
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">分類（Category）</label>
              <input v-model="form.Category" type="text" class="form-control" placeholder="e.g. payment, shipping, site" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">值（Value）</label>
              <input v-model="form.Value" type="text" class="form-control" placeholder="e.g. true / false / 100" :disabled="saving" />
            </div>

            <div class="mb-1">
              <label class="form-label">{{ t("settings.setconfig.description") }}</label>
              <input v-model="form.Description" type="text" class="form-control" placeholder="e.g. 是否開放付款" :disabled="saving" />
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
