<script setup>
import { ref, computed, onMounted } from "vue";
import { db } from "@/lib/db";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const members = ref([]);
const levels = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const search = ref("");
const filterLevel = ref("");
const savingId = ref(null);

onMounted(async () => {
  await Promise.all([loadLevels(), loadMembers()]);
});

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
      .select("ID, Name, Email, Phone, Gender, RegisterSource, MemberLevelID, IsActive, CreatedDate, UserID")
      .order("CreatedDate", { ascending: false });
    if (error) throw error;

    members.value = (data ?? []).filter((m) => !adminUserIds.has(m.UserID));
  } catch (err) {
    errorMsg.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
}

const levelName = (id) => levels.value.find((l) => l.ID === id)?.Name ?? "—";

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
        m.Email?.toLowerCase().includes(q) ||
        m.Phone?.includes(q)
    );
  }
  return list;
});

async function changeLevel(member, newLevelId) {
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
        style="max-width:220px"
        placeholder="搜尋姓名 / Email / 電話"
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
                <th style="width:16%">姓名</th>
                <th style="width:22%">Email</th>
                <th style="width:13%">電話</th>
                <th style="width:6%">性別</th>
                <th style="width:10%">來源</th>
                <th style="width:16%">會員等級</th>
                <th style="width:8%">狀態</th>
                <th style="width:9%">註冊日</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filtered.length === 0">
                <td colspan="8" class="text-center text-muted py-4">沒有符合條件的會員</td>
              </tr>
              <tr v-for="m in filtered" :key="m.ID">
                <td class="fw-semibold">{{ m.Name || "—" }}</td>
                <td class="text-muted small">{{ m.Email || "—" }}</td>
                <td class="text-muted small">{{ m.Phone || "—" }}</td>
                <td class="text-muted small">{{ genderLabel(m.Gender) }}</td>
                <td>
                  <span class="badge bg-light text-dark border">{{ m.RegisterSource || "email" }}</span>
                </td>
                <td>
                  <select
                    class="form-select form-select-sm level-select"
                    :value="m.MemberLevelID"
                    :disabled="savingId === m.ID"
                    @change="changeLevel(m, Number($event.target.value))"
                  >
                    <option v-for="l in levels" :key="l.ID" :value="l.ID">{{ l.Name }}</option>
                  </select>
                </td>
                <td>
                  <span :class="m.IsActive ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ m.IsActive ? "啟用" : "停用" }}
                  </span>
                </td>
                <td class="text-muted small">{{ formatDate(m.CreatedDate) }}</td>
              </tr>
            </tbody>
          </table>
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
