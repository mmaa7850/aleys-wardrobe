<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const { t } = useI18n();
const router = useRouter();

const tableName = "C_PRD_ProductList";

// UI state
const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const BUCKET = "product-pictures";

// filters
const q = ref("");
const status = ref("all"); // all | active | inactive
const categoryMap = ref({});

const getPublicUrl = (path) => {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? "";
};

const loadCategories = async () => {
  const { data, error } = await db
    .from("S_PRD_CategoryList")
    .select("Name, Description");

  if (!error && data) {
    const map = {};
    for (const c of data) {
      map[c.Name] = c.Description;
    }
    categoryMap.value = map;
  }
};


// debounce（避免每打一個字就打 API）
let _timer = null;
watch([q, status], () => {
  clearTimeout(_timer);
  _timer = setTimeout(() => loadProducts(), 300);
});

const goNew = () => router.push("/product/products/new");
const goEdit = (id) => router.push(`/product/products/${id}`);

// 這裡的欄位先用你規劃圖上會有的：ID, ProductName, Price, Category, IsActive, UpdatedDate
// 如果你資料表欄位名稱不同，你只要改 select 字串跟 table 顯示即可。
const loadProducts = async () => {
  loading.value = true;
  errorMsg.value = "";

  try {
    let query = db
      .from(tableName)
      .select(`
    ID,
    ProductName,
    Category,
    Price,
    IsActive,
    UpdatedDate,
    C_PRD_ProductPictureList (
      StoragePath,
      IsMain,
      SortOrder,
      Type
    )
  `)
      .order("ID", { ascending: false });

    const keyword = q.value.trim();
    if (keyword) {
      // ilike 需要 Postgres 支援（Supabase ok）
      query = query.ilike("ProductName", `%${keyword}%`);
    }

    if (status.value === "active") query = query.eq("IsActive", true);
    if (status.value === "inactive") query = query.eq("IsActive", false);

    const { data, error } = await query;
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
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const pickPreview = (row) => {
  const pics = row?.C_PRD_ProductPictureList ?? [];
  if (!pics.length) return null;

  const main = pics.find(p => p.IsMain);
  if (main) return main;

  const sorted = [...pics].sort(
    (a, b) => (a.SortOrder ?? 999999) - (b.SortOrder ?? 999999)
  );

  return sorted[0] ?? null;
};


const badgeClass = (isActive) => (isActive ? "bg-success" : "bg-secondary");

onMounted(async () => {
  await loadCategories();
  await loadProducts();
});

const hasData = computed(() => (rows.value?.length ?? 0) > 0);
</script>

<template>
  <div class="container-fluid py-3">
    <!-- Header -->
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
      <div class="me-auto">
        <h4 class="mb-1">{{ t("product.products.listTitle") }}</h4>
        <div class="text-muted small">{{ t("product.products.listSubtitle") }}</div>
      </div>

      <button class="btn btn-primary d-inline-flex align-items-center gap-2" @click="goNew">
        <span style="font-weight: 700; line-height: 1">＋</span>
        <span>{{ t("product.products.create") }}</span>
      </button>
    </div>

    <!-- Toolbar (RWD-friendly) -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <!-- Search -->
          <div class="col-12 col-lg-8">
            <div class="input-group">
              <span class="input-group-text">🔍</span>
              <input v-model="q" type="text" class="form-control"
                :placeholder="t('product.products.searchPlaceholder')" />
              <button class="btn btn-outline-secondary" type="button" @click="q = ''">
                {{ t("common.clear") }}
              </button>
            </div>
          </div>

          <!-- Status filter -->
          <div class="col-12 col-lg-4">
            <select v-model="status" class="form-select">
              <option value="all">{{ t("product.products.filterAll") }}</option>
              <option value="active">{{ t("product.products.filterActive") }}</option>
              <option value="inactive">{{ t("product.products.filterInactive") }}</option>
            </select>
          </div>
        </div>

        <!-- Small helper row -->
        <div class="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
          <div class="text-muted small">
            {{ t("product.products.count", { n: rows.length }) }}
          </div>

          <button class="btn btn-sm btn-outline-primary" type="button" @click="loadProducts" :disabled="loading">
            ⟳ {{ t("common.refresh") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Errors -->
    <div v-if="errorMsg" class="alert alert-danger">
      {{ errorMsg }}
    </div>

    <!-- Table -->
    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-3">
          <div class="text-muted">{{ t("common.loading") }}</div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th style="width:72px">{{ t("product.products.colPicture") }}</th>
                <th style="min-width: 260px">{{ t("product.products.colProductName") }}</th>
                <th style="width: 140px" class="text-end">{{ t("product.products.colPrice") }}</th>
                <th style="min-width: 160px">{{ t("product.products.colCategory") }}</th>
                <th style="width: 120px">{{ t("product.products.colStatus") }}</th>
                <th style="min-width: 180px">{{ t("product.products.colUpdatedDate") }}</th>
                <th class="text-end" style="width: 120px">{{ t("common.action") }}</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="!hasData">
                <td colspan="6" class="text-center text-muted py-4">
                  {{ t("common.noData") }}
                </td>
              </tr>

              <tr v-for="r in rows" :key="r.ID">
                <td>
                  <div class="thumb-cell">
                    <template v-if="pickPreview(r)">

                      <img v-if="pickPreview(r).Type === 'image'" :src="getPublicUrl(pickPreview(r).StoragePath)"
                        class="thumb-img" />

                      <div v-else class="video-wrapper">
                        <video class="thumb-img" autoplay muted loop playsinline>
                          <source :src="getPublicUrl(pickPreview(r).StoragePath)" />
                        </video>

                        <span class="video-tag">🎬</span>
                      </div>

                    </template>

                    <div v-else class="thumb-empty">—</div>
                  </div>
                </td>

                <td class="fw-semibold">
                  {{ r.ProductName }}
                  <div class="text-muted small">#{{ r.ID }}</div>
                </td>

                <td class="text-end">
                  <span class="fw-semibold">{{ r.Price ?? "-" }}</span>
                </td>

                <td>
                  <span class="text-muted">{{ categoryMap[r.Category] ?? r.Category ?? "-" }}</span>
                </td>

                <td>
                  <span class="badge" :class="badgeClass(r.IsActive)">
                    {{ r.IsActive ? t("common.active") : t("common.inactive") }}
                  </span>
                </td>

                <td>
                  <span class="text-muted">{{ formatDate(r.UpdatedDate) }}</span>
                </td>

                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-success" @click="goEdit(r.ID)" :title="t('common.edit')">
                      ✎
                    </button>
                    <!-- 先留著：刪除之後再做 -->
                    <button class="btn btn-sm btn-outline-secondary" disabled :title="t('common.delete')">
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

    <!-- Mobile helper hint -->
    <div class="text-muted small mt-2 d-lg-none">
      {{ t("product.products.mobileHint") }}
    </div>
  </div>
</template>

<style scoped>
/* RWD 小優化：在很窄的螢幕下，按鈕不要擠爆 */
@media (max-width: 420px) {
  .btn-group>.btn {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}

.thumb-cell {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  background: #f6f7f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-empty {
  font-size: 12px;
  color: #999;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-tag {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 14px;
}
</style>
