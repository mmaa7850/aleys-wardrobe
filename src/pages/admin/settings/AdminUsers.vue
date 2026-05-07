<script setup>
import { ref, onMounted, nextTick } from "vue";
import { Modal } from "bootstrap";
import { db } from "@/lib/db";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const admins = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const modalEl = ref(null);
let modalInstance = null;

const mode = ref("create");
const saving = ref(false);
const saveError = ref("");

const emptyForm = () => ({
  UserId: "",
  Account: "",
  AdminNo: "",
  IsAdmin: true,
  IsActive: true,
});

const form = ref(emptyForm());

onMounted(load);

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data, error } = await db
      .from("S_SYS_AdminUserList")
      .select("UserId, Account, AdminNo, IsAdmin, IsActive, CreatedDate, UpdatedDate")
      .order("CreatedDate", { ascending: true });
    if (error) throw error;
    admins.value = data ?? [];
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
}

const formatDate = (val) => {
  if (!val) return "-";
  const d = new Date(val);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

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
    UserId: row.UserId ?? "",
    Account: row.Account ?? "",
    AdminNo: row.AdminNo ?? "",
    IsAdmin: row.IsAdmin ?? true,
    IsActive: row.IsActive ?? true,
  };
  await ensureModal();
  modalInstance.show();
};

const closeModal = () => modalInstance?.hide();

const submit = async () => {
  saveError.value = "";
  if (!form.value.Account?.trim()) { saveError.value = "帳號不能空白"; return; }
  if (mode.value === "create" && !form.value.UserId?.trim()) { saveError.value = "UserId 不能空白（請至 Supabase Auth 複製）"; return; }

  saving.value = true;
  try {
    const now = new Date().toISOString();
    if (mode.value === "create") {
      const { error } = await db.from("S_SYS_AdminUserList").insert({
        UserId: form.value.UserId.trim(),
        Account: form.value.Account.trim(),
        AdminNo: form.value.AdminNo?.trim() ?? "",
        IsAdmin: form.value.IsAdmin,
        IsActive: form.value.IsActive,
        CreatedDate: now,
        UpdatedDate: now,
      });
      if (error) throw error;
    } else {
      const { error } = await db.from("S_SYS_AdminUserList")
        .update({
          Account: form.value.Account.trim(),
          AdminNo: form.value.AdminNo?.trim() ?? "",
          IsAdmin: form.value.IsAdmin,
          IsActive: form.value.IsActive,
          UpdatedDate: now,
        })
        .eq("UserId", form.value.UserId);
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
  if (row.UserId === auth.user?.id) {
    alert("無法刪除目前登入的帳號");
    return;
  }
  if (!window.confirm(`確定要移除「${row.Account}」嗎？`)) return;
  try {
    const { error } = await db.from("S_SYS_AdminUserList").delete().eq("UserId", row.UserId);
    if (error) throw error;
    await load();
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  }
};
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">管理者帳號</h4>
        <div class="text-muted small">S_SYS_AdminUserList</div>
      </div>
      <button class="btn btn-primary d-inline-flex align-items-center gap-2" @click="openCreate">
        <span style="font-weight:700;line-height:1">＋</span>
        <span>新增</span>
      </button>
    </div>

    <div class="alert alert-info py-2 mb-3 small">
      新增管理者時需要填入 <strong>UserId</strong>（即 Supabase Dashboard → Authentication → Users 裡的 UUID）。
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-3 text-muted">載入中...</div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th style="width:28%">帳號</th>
                <th style="width:12%">AdminNo</th>
                <th style="width:10%">IsAdmin</th>
                <th style="width:10%">IsActive</th>
                <th style="width:18%">建立時間</th>
                <th style="width:18%">更新時間</th>
                <th style="width:4%" class="text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="admins.length === 0">
                <td colspan="7" class="text-center text-muted py-4">目前沒有資料</td>
              </tr>
              <tr v-for="r in admins" :key="r.UserId">
                <td class="fw-semibold">
                  {{ r.Account }}
                  <span v-if="r.UserId === auth.user?.id" class="badge bg-primary ms-1">你</span>
                </td>
                <td class="text-muted">{{ r.AdminNo || '-' }}</td>
                <td>
                  <span :class="r.IsAdmin ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ r.IsAdmin ? '是' : '否' }}
                  </span>
                </td>
                <td>
                  <span :class="r.IsActive ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ r.IsActive ? '啟用' : '停用' }}
                  </span>
                </td>
                <td class="text-muted">{{ formatDate(r.CreatedDate) }}</td>
                <td class="text-muted">{{ formatDate(r.UpdatedDate) }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-success btn-icon" @click="openEdit(r)" title="修改" type="button">✎</button>
                    <button
                      class="btn btn-sm btn-danger btn-icon"
                      @click="deleteRow(r)"
                      title="移除"
                      :disabled="r.UserId === auth.user?.id"
                      type="button"
                    >🗑</button>
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
            <h5 class="modal-title">{{ mode === 'create' ? '新增管理者' : '修改管理者' }}</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="saveError" class="alert alert-danger py-2">{{ saveError }}</div>

            <div v-if="mode === 'create'" class="mb-3">
              <label class="form-label">UserId <span class="text-danger">*</span></label>
              <input v-model="form.UserId" type="text" class="form-control font-monospace" placeholder="Supabase Auth UUID" :disabled="saving" />
              <div class="form-text">至 Supabase Dashboard → Authentication → Users 複製 UUID</div>
            </div>

            <div class="mb-3">
              <label class="form-label">帳號（Email）<span class="text-danger">*</span></label>
              <input v-model="form.Account" type="email" class="form-control" placeholder="admin@example.com" :disabled="saving" />
            </div>

            <div class="mb-3">
              <label class="form-label">AdminNo</label>
              <input v-model.number="form.AdminNo" type="number" min="1" class="form-control" placeholder="e.g. 1" :disabled="saving" />
            </div>

            <div class="d-flex gap-4 mb-1">
              <div class="form-check">
                <input id="fIsAdmin" v-model="form.IsAdmin" type="checkbox" class="form-check-input" :disabled="saving" />
                <label class="form-check-label" for="fIsAdmin">IsAdmin</label>
              </div>
              <div class="form-check">
                <input id="fIsActive" v-model="form.IsActive" type="checkbox" class="form-check-input" :disabled="saving" />
                <label class="form-check-label" for="fIsActive">IsActive</label>
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
