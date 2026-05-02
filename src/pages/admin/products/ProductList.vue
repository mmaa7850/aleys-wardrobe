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
const category = ref("all");
watch([q, status, category], () => {
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
        ),
        C_PRD_ProductVariantList (
          StockQty,
          IsActive
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

    if (category.value !== "all") {
      query = query.eq("Category", category.value);
    }

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

const getTotalStock = (row) => {
  const variants = row?.C_PRD_ProductVariantList ?? [];
  return variants.reduce((sum, v) => sum + (Number(v.StockQty) || 0), 0);
};

const getActiveVariantCount = (row) => {
  const variants = row?.C_PRD_ProductVariantList ?? [];
  return variants.filter(v => v.IsActive).length;
};

const isLowStock = (row) => {
  const total = getTotalStock(row);
  return total > 0 && total <= 5;
};

const isOutOfStock = (row) => {
  return getTotalStock(row) === 0;
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

          <!-- Category -->
          <div class="col-12 col-lg-2">
            <select v-model="category" class="form-select">
              <option value="all">全部分類</option>
              <option v-for="c in Object.keys(categoryMap)" :key="c" :value="c">
                {{ categoryMap[c] }}
              </option>
            </select>
          </div>

          <!-- Status filter -->
          <div class="col-12 col-lg-2">
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

    <!-- Loading -->
    <div v-if="loading" class="text-muted py-4 text-center">
      {{ t("common.loading") }}
    </div>

    <!-- No data -->
    <div v-else-if="!hasData" class="text-muted py-4 text-center">
      {{ t("common.noData") }}
    </div>

    <!-- Card Grid -->
    <div v-else class="row row-cols-2 row-cols-md-4 row-cols-xl-6 g-2">
      <div v-for="r in rows" :key="r.ID" class="col">
        <div class="product-card" :class="{ 'card-inactive': !r.IsActive }">

          <!-- 圖片區 -->
          <div class="product-img-wrap">
            <template v-if="pickPreview(r)">
              <img v-if="pickPreview(r).Type === 'image'"
                :src="getPublicUrl(pickPreview(r).StoragePath)"
                class="product-img" />
              <div v-else class="product-img-wrap">
                <video class="product-img" autoplay muted loop playsinline>
                  <source :src="getPublicUrl(pickPreview(r).StoragePath)" />
                </video>
                <span class="video-badge">🎬</span>
              </div>
            </template>
            <div v-else class="product-img-empty">—</div>

            <!-- 狀態 badge 疊在右上角 -->
            <span class="status-badge badge" :class="badgeClass(r.IsActive)">
              {{ r.IsActive ? t("common.active") : t("common.inactive") }}
            </span>
          </div>

          <!-- 資訊區 -->
          <div class="product-body">
            <div class="product-name fw-semibold">{{ r.ProductName }}</div>
            <div class="text-muted small mb-2">#{{ r.ID }} · {{ categoryMap[r.Category] ?? r.Category ?? "-" }}</div>

            <div class="d-flex align-items-center justify-content-between">
              <span class="product-price">NT$ {{ r.Price ?? "-" }}</span>
              <span class="badge" :class="{
                'bg-danger': isOutOfStock(r),
                'bg-warning text-dark': isLowStock(r),
                'bg-success': !isOutOfStock(r) && !isLowStock(r)
              }">
                庫存 {{ getTotalStock(r) }}
              </span>
            </div>

            <div class="text-muted small mt-1">{{ getActiveVariantCount(r) }} 個規格</div>
          </div>

          <!-- 底部操作 -->
          <div class="product-footer">
            <span class="text-muted small">{{ formatDate(r.UpdatedDate) }}</span>
            <div class="btn-group">
              <button class="btn btn-sm btn-success" @click="goEdit(r.ID)" :title="t('common.edit')">
                ✎
              </button>
              <button class="btn btn-sm btn-outline-secondary" disabled :title="t('common.delete')">
                🗑
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
}

.product-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-inactive {
  opacity: 0.6;
}

/* 圖片 */
.product-img-wrap {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f6f7f9;
  overflow: hidden;
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-img-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bbb;
  font-size: 18px;
}

.video-badge {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 12px;
}

.status-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  padding: 2px 5px;
}

/* 資訊 */
.product-body {
  padding: 7px 9px 4px;
  flex: 1;
}

.product-name {
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2; 
  -webkit-box-orient: vertical;
}

.product-price {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

/* 底部 */
.product-footer {
  padding: 5px 9px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-footer .text-muted {
  font-size: 10px;
}
</style>
