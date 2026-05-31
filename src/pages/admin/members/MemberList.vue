<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { Modal } from "bootstrap";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const members = ref([]);
const levels = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const search = ref("");
const filterLevel = ref("");
const savingId = ref(null);

// ── Edit modal ────────────────────────────────────────────────
const modalEl   = ref(null);   // template ref for the modal DOM element
const editTarget = ref(null);
const editName   = ref('');
const editPhone  = ref('');
const editFbName = ref('');
const editLevel  = ref('');    // MemberLevelID (string for select binding)
const editSaving = ref(false);
const editError  = ref('');

async function openEdit(m) {
  editTarget.value = m;
  editName.value   = m.Name   || '';
  editPhone.value  = m.Phone  || '';
  editFbName.value = m.FbName || '';
  editLevel.value  = m.MemberLevelID ? String(m.MemberLevelID) : '';
  editError.value  = '';
  await nextTick();
  Modal.getOrCreateInstance(modalEl.value).show();
}

async function saveEdit() {
  if (!editTarget.value) return;
  editSaving.value = true;
  editError.value  = '';
  try {
    const newLevel = editLevel.value ? Number(editLevel.value) : null;
    const { error } = await db
      .from('C_MBR_MemberList')
      .update({
        Name:          editName.value.trim()   || null,
        Phone:         editPhone.value.trim()  || null,
        FbName:        editFbName.value.trim() || null,
        MemberLevelID: newLevel,
        UpdatedDate:   new Date().toISOString(),
      })
      .eq('ID', editTarget.value.ID);
    if (error) throw error;

    // Sync local state
    editTarget.value.Name          = editName.value.trim()   || null;
    editTarget.value.Phone         = editPhone.value.trim()  || null;
    editTarget.value.FbName        = editFbName.value.trim() || null;
    editTarget.value.MemberLevelID = newLevel;

    Modal.getOrCreateInstance(modalEl.value).hide();
  } catch (err) {
    editError.value = err?.message ?? String(err);
  } finally {
    editSaving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadLevels(), loadMembers()]);
});

// ── 購物車管理 Modal ──────────────────────────────────────────
const cartModalEl   = ref(null)
const cartMember    = ref(null)
const cartItems     = ref([])
const cartLoading   = ref(false)
const cartError     = ref('')
const removingId    = ref(null)

async function callCartApi(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-member-cart`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '操作失敗')
  return data
}

async function openCart(member) {
  cartMember.value  = member
  cartItems.value   = []
  cartError.value   = ''
  cartLoading.value = true
  await nextTick()
  Modal.getOrCreateInstance(cartModalEl.value).show()
  try {
    const data = await callCartApi({ action: 'get', memberId: member.ID })
    cartItems.value = data.items ?? []
  } catch (e) {
    cartError.value = e.message
  } finally {
    cartLoading.value = false
  }
}

async function removeCartItem(item) {
  if (!confirm(`確定移除「${item.productName}」？庫存將自動回補。`)) return
  removingId.value = item.id
  try {
    await callCartApi({ action: 'remove', cartItemId: item.id })
    cartItems.value = cartItems.value.filter(i => i.id !== item.id)
  } catch (e) {
    cartError.value = e.message
  } finally {
    removingId.value = null
  }
}

async function loadLevels() {
  const { data } = await db
    .from("S_MBR_MemberLevelList")
    .select("ID, Name")
    .order("SortOrder");
  levels.value = data ?? [];
}

async function loadMembers() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data: adminRows } = await db
      .from("S_SYS_AdminUserList")
      .select("UserId");
    const adminUserIds = new Set((adminRows ?? []).map((r) => r.UserId));

    const { data, error } = await db
      .from("C_MBR_MemberList")
      .select("ID, Name, Email, Phone, FbName, Gender, RegisterSource, MemberLevelID, IsActive, CreatedDate, UserID")
      .order("CreatedDate", { ascending: false });
    if (error) throw error;

    members.value = (data ?? []).filter((m) => !adminUserIds.has(m.UserID));
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
}

const filtered = computed(() => {
  let list = members.value;
  if (filterLevel.value !== "") {
    list = list.filter((m) => String(m.MemberLevelID) === filterLevel.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (m) =>
        m.Name?.toLowerCase().includes(q) ||
        m.FbName?.toLowerCase().includes(q) ||
        m.Email?.toLowerCase().includes(q) ||
        m.Phone?.includes(q)
    );
  }
  return list;
});

async function changeLevel(member, newLevelId) {
  if (!newLevelId) return;
  savingId.value = member.ID;
  try {
    const { error } = await db
      .from("C_MBR_MemberList")
      .update({ MemberLevelID: newLevelId, UpdatedDate: new Date().toISOString() })
      .eq("ID", member.ID);
    if (error) throw error;
    member.MemberLevelID = newLevelId;
  } catch (err) {
    alert("更新失敗：" + (err?.message ?? err));
  } finally {
    savingId.value = null;
  }
}

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};

const genderLabel = (g) => ({ F: "女", M: "男", other: "其他" }[g] ?? "—");

const sourceLabel = (s) => ({
  facebook: 'Facebook', fb: 'Facebook', email: 'Email',
}[s] ?? (s || 'Email'));
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">會員列表</h4>
        <div class="text-muted small">C_MBR_MemberList</div>
      </div>
      <button class="btn btn-outline-secondary btn-sm" @click="loadMembers">重新整理</button>
    </div>

    <!-- 篩選 -->
    <div class="d-flex gap-2 flex-wrap mb-3">
      <input
        v-model="search"
        type="text"
        class="form-control form-control-sm"
        style="max-width:260px"
        placeholder="搜尋姓名 / FB名稱 / Email / 電話"
      />
      <select v-model="filterLevel" class="form-select form-select-sm" style="max-width:160px">
        <option value="">全部等級</option>
        <option v-for="l in levels" :key="l.ID" :value="String(l.ID)">{{ l.Name }}</option>
      </select>
      <span class="text-muted small align-self-center">共 {{ filtered.length }} 筆</span>
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-4 text-center text-muted">載入中...</div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:13%">姓名</th>
                <th style="width:13%">FB名稱</th>
                <th style="width:19%">Email</th>
                <th style="width:12%">電話</th>
                <th style="width:5%">性別</th>
                <th style="width:8%">來源</th>
                <th style="width:14%">會員等級</th>
                <th style="width:6%">狀態</th>
                <th style="width:8%">註冊日</th>
                <th style="width:4%"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filtered.length === 0">
                <td colspan="10" class="text-center text-muted py-4">沒有符合條件的會員</td>
              </tr>
              <tr v-for="m in filtered" :key="m.ID">
                <td class="fw-semibold">{{ m.Name || "—" }}</td>
                <td class="text-muted small">{{ m.FbName || "—" }}</td>
                <td class="text-muted small">{{ m.Email || "—" }}</td>
                <td class="text-muted small">{{ m.Phone || "—" }}</td>
                <td class="text-muted small">{{ genderLabel(m.Gender) }}</td>
                <td>
                  <span class="badge bg-light text-dark border">{{ sourceLabel(m.RegisterSource) }}</span>
                </td>
                <td>
                  <select
                    class="form-select form-select-sm level-select"
                    :value="m.MemberLevelID ?? ''"
                    :disabled="savingId === m.ID"
                    @change="changeLevel(m, Number($event.target.value))"
                  >
                    <option value="" disabled>（未設定）</option>
                    <option v-for="l in levels" :key="l.ID" :value="l.ID">{{ l.Name }}</option>
                  </select>
                </td>
                <td>
                  <span :class="m.IsActive ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ m.IsActive ? "啟用" : "停用" }}
                  </span>
                </td>
                <td class="text-muted small">{{ formatDate(m.CreatedDate) }}</td>
                <td class="d-flex gap-1">
                  <button class="btn btn-sm btn-outline-primary py-0 px-2" @click="openEdit(m)">編輯</button>
                  <button class="btn btn-sm btn-outline-secondary py-0 px-2" @click="openCart(m)">購物車</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Modal -->
  <div class="modal fade" ref="modalEl" tabindex="-1" aria-labelledby="memberEditModalLabel" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="memberEditModalLabel">編輯會員資料</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div v-if="editTarget" class="mb-1 text-muted small">
            {{ editTarget.Email }}
          </div>
          <div v-if="editError" class="alert alert-danger py-2 small">{{ editError }}</div>

          <div class="mb-3 mt-3">
            <label class="form-label fw-semibold small">姓名</label>
            <input v-model="editName" type="text" class="form-control" placeholder="真實姓名（收件用）" />
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold small">電話</label>
            <input v-model="editPhone" type="tel" class="form-control" placeholder="例：0912-345-678" />
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold small">FB 名稱 <span class="text-muted fw-normal">（直播私訊對應用）</span></label>
            <input v-model="editFbName" type="text" class="form-control" placeholder="Facebook 顯示名稱" />
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold small">會員等級</label>
            <select v-model="editLevel" class="form-select">
              <option value="">（未設定）</option>
              <option v-for="l in levels" :key="l.ID" :value="String(l.ID)">{{ l.Name }}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" :disabled="editSaving" @click="saveEdit">
            {{ editSaving ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 購物車管理 Modal -->
  <div class="modal fade" ref="cartModalEl" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            購物車管理
            <span class="text-muted fw-normal" style="font-size:14px;">— {{ cartMember?.FbName || cartMember?.Name || cartMember?.Email }}</span>
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div v-if="cartLoading" class="text-center py-4">
            <span class="spinner-border spinner-border-sm me-2" />載入中…
          </div>
          <div v-else-if="cartError" class="alert alert-danger py-2" style="font-size:13px;">{{ cartError }}</div>
          <div v-else-if="!cartItems.length" class="text-center py-4 text-muted" style="font-size:14px;">
            購物車是空的
          </div>
          <table v-else class="table table-hover align-middle mb-0" style="font-size:13px;">
            <thead style="background:#f9f6f2; font-size:12px; color:#6b5c4e;">
              <tr>
                <th class="px-3 py-2">商品</th>
                <th class="px-3 py-2">顏色 / 尺寸</th>
                <th class="px-3 py-2 text-center">數量</th>
                <th class="px-3 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in cartItems" :key="item.id">
                <td class="px-3 py-2 fw-semibold">{{ item.productName }}</td>
                <td class="px-3 py-2 text-muted">
                  {{ [item.colorName, item.sizeName].filter(Boolean).join(' / ') || '—' }}
                </td>
                <td class="px-3 py-2 text-center">{{ item.qty }}</td>
                <td class="px-3 py-2 text-center">
                  <button class="btn btn-sm btn-outline-danger py-0 px-2"
                    :disabled="removingId === item.id"
                    @click="removeCartItem(item)">
                    <span v-if="removingId === item.id" class="spinner-border spinner-border-sm" />
                    <span v-else>移除</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">關閉</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.level-select {
  min-width: 110px;
}
</style>
