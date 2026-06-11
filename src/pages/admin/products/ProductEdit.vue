<!-- src/pages/product/product/ProductEdit.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { db } from "@/lib/db";
import { watch } from "vue";
import { formatDateTime } from "@/utils/date";
import { supabase } from "@/lib/supabase";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const tableName = "C_PRD_ProductList";

const categoryOptions = ref([]);
const categoryLoading = ref(false);
const variantsCache = ref(new Map());
const vKey = (colorId, sizeId) => `${colorId}::${sizeId}`;

// =============
// Picture
// =============
const pictures = ref([]);
const picLoading = ref(false);
const picSaving = ref(false);
const picError = ref("");
const BUCKET = "product-pictures";
const fileInput = ref(null);
const openFilePicker = () => fileInput.value?.click();

// =============
// Size Spec
// =============
const sizeSpecs = ref([]);

// =============
// Mode判斷
// =============
const routeId = computed(() => {
  const raw = route.params.id;
  if (!raw || String(raw).toLowerCase() === "new") return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
});
const isNew = computed(() => !routeId.value);

// =============
// UI State
// =============
const loading = ref(false);
const saving = ref(false);
const errorMsg = ref("");

// ===== Variants: master data =====
const colors = ref([]);
const sizes = ref([]);
const loadingColors = ref(false);
const loadingSizes = ref(false);

// ===== Variants: selection =====
const selectedColorIds = ref([]);
const selectedSizeIds = ref([]);

// ===== Variants: generated rows =====
const variantRows = ref([]);

// 建立草稿時的狀態（避免重複 insert）
const draftCreating = ref(false);

// =============
// Form
// =============
const form = ref({
    ID: null,
    ProductName: "",
    Category: "", // 先用字串（你目前 ProductList 也是顯示 Category）
    Price: null,
    OriginPrice: null,
    IsActive: false,
    IsPreOrder: false,
    PreOrderNote: '',
    LiveCode: '',
    CreatedDate: null,
    UpdatedDate: null,

    // 先保留欄位（之後再接）
    SubTitle: "",
    Description: "",
    Material: "",
    WashingMethod: "",
    SEOTitle: "",
    SEODescription: ""
});

// Header title
const pageTitle = computed(() => {
    if (isNew.value) return t("product.productEdit.titleNew");
    return t("product.productEdit.titleEdit", { id: form.value.ID ?? routeId.value });
});

// =============
// Helpers
// =============
const toNumberOrNull = (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
};

const validateBasic = () => {
    const name = form.value.ProductName?.trim();
    const cat = form.value.Category?.trim();
    const price = toNumberOrNull(form.value.Price);

    if (!name) return t("product.productEdit.validateNameRequired");
    if (!cat) return t("product.productEdit.validateCategoryRequired");
    if (price === null || price < 0) return t("product.productEdit.validatePriceInvalid");

    return "";
};

const isFirstPicture = (pic) => {
    const list = pictures.value.filter(p => !p.IsMain);
    return list[0]?.StoragePath === pic.StoragePath;
};

const isLastPicture = (pic) => {
    const list = pictures.value.filter(p => !p.IsMain);
    return list[list.length - 1]?.StoragePath === pic.StoragePath;
};

// =============
// Actions
// =============
const goBack = () => router.push("/admin/products");

const createDraftIfNeeded = async () => {
    // 只有 new 模式才建草稿
    if (!isNew.value) return;

    // 已有 ID 就不用再建
    if (form.value.ID) return;

    // 避免重複觸發
    if (draftCreating.value) return;

    draftCreating.value = true;
    loading.value = true;
    errorMsg.value = "";

    try {
        const now = new Date().toISOString();

        // ✅ 建草稿：先建立一筆最小資料
        // 你之後想改成「完全空」也行，但通常 ProductName/Category 必填時會卡
        // 所以先給預設：未命名商品
        const payload = {
            ProductName: t("product.productEdit.untitled"),
            Category: t("product.productEdit.uncategorized"),
            Price: 0,
            OriginPrice: null,
            Description: "",
            IsActive: false,
            CreatedDate: now,
            UpdatedDate: now
        };

        const { data, error } = await db.from(tableName).insert(payload).select("ID").single();
        if (error) throw error;

        const newId = data?.ID;
        if (!newId) throw new Error("Create draft failed: missing ID");

        // 把 ID 寫入 form，並把網址從 /new 換成 /{id}
        form.value.ID = newId;
        form.value.ProductName = payload.ProductName;
        form.value.Category = payload.Category;
        form.value.Price = payload.Price;
        form.value.OriginPrice = payload.OriginPrice;
        form.value.IsActive = payload.IsActive;
        form.value.IsPreOrder = payload.IsPreOrder ?? false;
        form.value.PreOrderNote = payload.PreOrderNote ?? '';
        form.value.CreatedDate = payload.CreatedDate;
        form.value.UpdatedDate = payload.UpdatedDate;

        await router.replace(`/product/product/${newId}`);
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    } finally {
        loading.value = false;
        draftCreating.value = false;
    }
};

const loadColors = async () => {
    loadingColors.value = true;
    try {
        const { data, error } = await db
            .from("S_PRD_ColorList")
            .select('ID, "Name", "Description"')
            .order("ID");

        if (error) throw error;
        colors.value = data ?? [];
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    } finally {
        loadingColors.value = false;
    }
};

const loadSizes = async () => {
    loadingSizes.value = true;
    try {
        const { data, error } = await db
            .from("S_PRD_SizeList")
            .select('ID, "Name", "Description", "SortOrder"')
            .order("SortOrder", { ascending: true })
            .order("ID", { ascending: true }); // 同 SortOrder 時的穩定排序
        if (error) throw error;
        sizes.value = data ?? [];
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    } finally {
        loadingSizes.value = false;
    }
};

const loadProduct = async (id) => {
    loading.value = true;
    errorMsg.value = "";

    try {
        const { data, error } = await db
            .from(tableName)
            .select(
                'ID,"ProductName","Category","Price","OriginPrice","IsActive","IsPreOrder","PreOrderNote","LiveCode","CreatedDate","UpdatedDate","SubTitle","Description","Material","WashingMethod","SEOTitle","SEODescription"'
            )
            .eq("ID", id)
            .single();

        if (error) throw error;

        form.value = {
            ...form.value,
            ...data
        };
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    } finally {
        loading.value = false;
    }
};

const saveDraft = async () => {
    errorMsg.value = "";

    // ✅ 商品名稱必填驗證
    if (!form.value.ProductName || !form.value.ProductName.trim()) {
        errorMsg.value = t("product.productEdit.validateNameRequired");
        return;
    }

    saving.value = true;
    try {
        const now = new Date().toISOString();

        // 🔑 Step 1：如果還沒有 ID，先建立草稿
        if (!form.value.ID) {
            const payload = {
                ProductName: form.value.ProductName?.trim() || t("product.productEdit.untitled"),
                Category: form.value.Category?.trim() || t("product.productEdit.uncategorized"),
                Price: toNumberOrNull(form.value.Price) ?? 0,
                OriginPrice: toNumberOrNull(form.value.OriginPrice),
                IsActive: false,
                CreatedDate: now,
                UpdatedDate: now,

                // NOT NULL 欄位 → 空字串
                Description: "",
                SubTitle: "",
                Material: "",
                WashingMethod: "",
                SEOTitle: "",
                SEODescription: ""
            };

            const { data, error } = await db
                .from(tableName)
                .insert(payload)
                .select("ID")
                .single();

            if (error) throw error;

            const newId = data.ID;
            form.value.ID = newId;
            form.value.CreatedDate = now;
            form.value.UpdatedDate = now;

            // 🔁 把 URL 從 /new 換成 /{id}
            await router.replace(`/product/products/${newId}`);

            await loadPictures(newId);
        }

        // 🔑 Step 2：有 ID 之後，走 update
        const updatePayload = {
            ProductName: form.value.ProductName?.trim() || t("product.productEdit.untitled"),
            Category: form.value.Category?.trim() || t("product.productEdit.uncategorized"),
            Price: toNumberOrNull(form.value.Price) ?? 0,
            OriginPrice: toNumberOrNull(form.value.OriginPrice),
            IsActive: !!form.value.IsActive,
            IsPreOrder: !!form.value.IsPreOrder,
            PreOrderNote: form.value.IsPreOrder ? (form.value.PreOrderNote?.trim() || null) : null,
            LiveCode: form.value.LiveCode?.trim().toUpperCase() || null,
            UpdatedDate: now,

            Description: form.value.Description?.trim() ?? "",
            SubTitle: form.value.SubTitle?.trim() ?? "",
            Material: form.value.Material?.trim() ?? "",
            WashingMethod: form.value.WashingMethod?.trim() ?? "",
            SEOTitle: form.value.SEOTitle?.trim() ?? "",
            SEODescription: form.value.SEODescription?.trim() ?? ""
        };

        const { error: updateError } = await db
            .from(tableName)
            .update(updatePayload)
            .eq("ID", form.value.ID);

        if (updateError) throw updateError;
        await saveVariants(form.value.ID);
        await saveSizeSpecs(form.value.ID);

        form.value.UpdatedDate = now;
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    } finally {
        saving.value = false;
    }
};

const loadCategories = async () => {
    categoryLoading.value = true;
    try {
        const { data, error } = await db
            .from("S_PRD_CategoryList")
            .select('"Name", "Description"')
            .order("ID", { ascending: true });

        if (error) throw error;

        categoryOptions.value = data ?? [];
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    } finally {
        categoryLoading.value = false;
    }
};

const loadVariants = async (productId) => {
    if (!productId) return;

    try {
        // 依你的表欄位調整 select
        const { data, error } = await db
            .from("C_PRD_ProductVariantList")
            .select('ProductID, "ColorID", "SizeID", "StockQty", "IsActive"')
            .eq("ProductID", productId);

        if (error) throw error;

        const list = data ?? [];

        // 1) 建立 cache（保留庫存/可賣）
        const map = new Map();
        for (const r of list) {
            map.set(vKey(r.ColorID, r.SizeID), {
                ...r,
                StockQty: r.StockQty ?? 0,
                IsActive: r.IsActive ?? true
            });
        }
        variantsCache.value = map;

        // 2) 自動勾選顏色/尺寸
        selectedColorIds.value = [...new Set(list.map(x => x.ColorID))];
        selectedSizeIds.value = [...new Set(list.map(x => x.SizeID))];

        // 3) 用 cache 生成畫面 rows（會保留原值）
        generateVariants();
    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    }
};

const saveVariants = async (productId) => {
    const rows = variantRows.value ?? [];

    // 1) 先查目前 DB 既有 variants
    const { data: existingData, error: loadErr } = await db
        .from("C_PRD_ProductVariantList")
        .select('ID, "ProductID", "ColorID", "SizeID", "StockQty", "IsActive", "SKU"')
        .eq("ProductID", productId);

    if (loadErr) throw loadErr;

    const existingRows = existingData ?? [];

    // key = ColorID::SizeID
    const existingMap = new Map(
        existingRows.map(r => [vKey(r.ColorID, r.SizeID), r])
    );

    const currentMap = new Map(
        rows.map(r => [vKey(r.ColorID, r.SizeID), r])
    );

    // 2) 新增 or 更新
    for (const r of rows) {
        const key = vKey(r.ColorID, r.SizeID);
        const existing = existingMap.get(key);

        const sku = existing?.SKU || `AW-P${productId}-C${r.ColorID}-S${r.SizeID}`;

        if (existing) {
            // 已存在：只更新庫存、是否可賣、SKU補值
            const { error: updateErr } = await db
                .from("C_PRD_ProductVariantList")
                .update({
                    StockQty: r.StockQty ?? 0,
                    IsActive: r.IsActive ?? false,
                    SKU: sku,
                    UpdatedDate: new Date().toISOString()
                })
                .eq("ID", existing.ID);

            if (updateErr) throw updateErr;
        } else {
            // 不存在：新增
            const { error: insertErr } = await db
                .from("C_PRD_ProductVariantList")
                .insert({
                    ProductID: productId,
                    ColorID: r.ColorID,
                    SizeID: r.SizeID,
                    SKU: sku,
                    StockQty: r.StockQty ?? 0,
                    IsActive: r.IsActive ?? false,
                    CreatedDate: new Date().toISOString(),
                    UpdatedDate: new Date().toISOString()
                });

            if (insertErr) throw insertErr;
        }
    }

    // 3) DB 有，但現在畫面沒有的組合：刪除
    for (const oldRow of existingRows) {
        const key = vKey(oldRow.ColorID, oldRow.SizeID);

        if (!currentMap.has(key)) {
            const { error: disableErr } = await db
                .from("C_PRD_ProductVariantList")
                .update({
                    IsActive: false,
                    UpdatedDate: new Date().toISOString()
                })
                .eq("ID", oldRow.ID);

            if (disableErr) throw disableErr;
        }
    }
};

const saveSizeSpecs = async (productId) => {
    // 沒商品ID就不用存
    if (!productId) return;

    const rows = sizeSpecs.value ?? [];
    const now = new Date().toISOString();

    // 1) 先刪除既有（最穩）
    const { error: delErr } = await db
        .from("C_PRD_ProductSizeSpecList")
        .delete()
        .eq("ProductID", productId);

    if (delErr) throw delErr;

    // 2) 沒有 rows 就代表清空尺寸表，直接結束
    if (rows.length === 0) return;

    // 3) 插入
    const payload = rows.map((r) => ({
        ProductID: productId,
        SizeID: r.SizeID,

        Bust: r.Bust ?? null,
        ClothLength: r.ClothLength ?? null,
        SleeveLength: r.SleeveLength ?? null,
        ShoulderWidth: r.ShoulderWidth ?? null,
        Waist: r.Waist ?? null,
        SkirtLength: r.SkirtLength ?? null,
        Hip: r.Hip ?? null,

        CreatedDate: now,
        UpdatedDate: now,
    }));

    const { error: insErr } = await db
        .from("C_PRD_ProductSizeSpecList")
        .insert(payload);

    if (insErr) throw insErr;
};


const createdDateText = computed(() =>
    form.value.CreatedDate ? formatDateTime(form.value.CreatedDate) : "-"
);

const updatedDateText = computed(() =>
    form.value.UpdatedDate ? formatDateTime(form.value.UpdatedDate) : "-"
);


const generateVariants = () => {
    // ① 先把目前畫面上的 row 寫回 cache（避免被洗掉）
    for (const v of variantRows.value) {
        variantsCache.value.set(vKey(v.ColorID, v.SizeID), {
            ...v,
            StockQty: v.StockQty ?? 0,
            IsActive: v.IsActive ?? true
        });
    }

    // ② 依 SortOrder 排序「已勾選的顏色」
    const sortedColorIds = [...selectedColorIds.value].sort((a, b) => {
        const ca = colors.value.find(x => x.ID === a);
        const cb = colors.value.find(x => x.ID === b);

        return (
            (ca?.SortOrder ?? 9999) - (cb?.SortOrder ?? 9999) ||
            a - b
        );
    });

    // ③ 依 SortOrder 排序「已勾選的尺寸」
    const sortedSizeIds = [...selectedSizeIds.value].sort((a, b) => {
        const sa = sizes.value.find(x => x.ID === a);
        const sb = sizes.value.find(x => x.ID === b);

        return (
            (sa?.SortOrder ?? 9999) - (sb?.SortOrder ?? 9999) ||
            a - b
        );
    });

    // ④ 重新產生 variantRows（用 cache 保留舊值）
    const newRows = [];

    for (const colorId of sortedColorIds) {
        const color = colors.value.find(c => c.ID === colorId);
        if (!color) continue;

        for (const sizeId of sortedSizeIds) {
            const size = sizes.value.find(s => s.ID === sizeId);
            if (!size) continue;

            const key = vKey(colorId, sizeId);
            const cached = variantsCache.value.get(key);

            newRows.push({
                ProductID: form.value.ID ?? null,
                ColorID: colorId,
                ColorName: color.Description,
                SizeID: sizeId,
                SizeName: size.Description,
                StockQty: cached?.StockQty ?? 0,
                IsActive: cached?.IsActive ?? true
            });
        }
    }

    // ⑤ 一次指派，避免多次 re-render
    variantRows.value = newRows;
};

const setAllStockQty = (qty) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0) return;

    for (const v of variantRows.value) {
        v.StockQty = n;
    }

    // ✅ 同步到 cache，避免你之後勾選變動又洗掉
    for (const v of variantRows.value) {
        variantsCache.value.set(vKey(v.ColorID, v.SizeID), {
            ...v,
            StockQty: v.StockQty ?? 0,
            IsActive: v.IsActive ?? true
        });
    }
};

const setAllSellable = (isActive) => {
    for (const v of variantRows.value) {
        v.IsActive = !!isActive;
    }

    // ✅ 同步到 cache
    for (const v of variantRows.value) {
        variantsCache.value.set(vKey(v.ColorID, v.SizeID), {
            ...v,
            StockQty: v.StockQty ?? 0,
            IsActive: v.IsActive ?? true
        });
    }
};

const loadPictures = async (productId) => {
    if (!productId) {
        pictures.value = [];
        return;
    }

    picLoading.value = true;
    picError.value = "";
    try {
        const { data, error } = await db
            .from("C_PRD_ProductPictureList")
            .select('ID, ProductID, "AltText", "SortOrder", "IsMain", "StoragePath", "Type"')
            .eq("ProductID", productId)
            .order("IsMain", { ascending: false })
            .order("SortOrder", { ascending: true });

        if (error) throw error;
        pictures.value = data ?? [];
    } catch (err) {
        picError.value = err?.message ?? String(err);
    } finally {
        picLoading.value = false;
    }
};

const getPublicUrl = (path) => {
    if (!path) return "";
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? "";
};

const uploadPictures = async (files) => {
    picError.value = "";

    if (!form.value.ID) {
        picError.value = "請先儲存草稿後再上傳圖片/影片";
        return;
    }

    if (!files || files.length === 0) return;

    picSaving.value = true;

    try {
        const productId = form.value.ID;

        const maxSort = pictures.value.length
            ? Math.max(...pictures.value.map(p => p.SortOrder ?? 0))
            : 0;

        const inserts = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");

            if (!isImage && !isVideo) continue;

            const mediaType = isImage ? "image" : "video";

            const ext = file.name.split(".").pop()?.toLowerCase() || (isImage ? "jpg" : "mp4");
            const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
            const storagePath = `products/${productId}/${fileName}`;

            const { error: upErr } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                });

            if (upErr) throw upErr;

            inserts.push({
                ProductID: productId,
                StoragePath: storagePath,
                AltText: "",
                SortOrder: maxSort + i + 1,
                IsMain: false,
                Type: mediaType
            });
        }

        if (inserts.length > 0) {
            const hasMain = pictures.value.some(p => p.IsMain);

            // 建議只讓圖片當主圖，不要讓影片當主圖
            if (!hasMain) {
                inserts[0].IsMain = true;
            }

            const { error: insErr } = await db
                .from("C_PRD_ProductPictureList")
                .insert(inserts);

            if (insErr) throw insErr;
        }

        await loadPictures(productId);
    } catch (err) {
        picError.value = err?.message ?? String(err);
    } finally {
        picSaving.value = false;

        // 清空 input，讓同一個檔案可以再次選取
        if (fileInput.value) {
            fileInput.value.value = "";
        }
    }
};

const deletePicture = async (pic) => {
    const ok = window.confirm("確定要刪除這個檔案嗎？");
    if (!ok) return;

    picError.value = "";
    picSaving.value = true;

    try {
        const productId = form.value.ID;
        const storagePath = pic.StoragePath;

        if (!productId || !storagePath) {
            throw new Error("缺少商品 ID 或檔案路徑");
        }

        const folder = `products/${productId}`;

        const { data: listData, error: listErr } = await supabase.storage
            .from(BUCKET)
            .list(folder);

        // 1. 刪 Storage
        const { data: removeData, error: rmErr } = await supabase.storage
            .from(BUCKET)
            .remove([storagePath]);

        if (rmErr) throw rmErr;

        // 2. 刪 DB
        const { error: delErr } = await db
            .from("C_PRD_ProductPictureList")
            .delete()
            .eq("ProductID", productId)
            .eq("StoragePath", storagePath);

        if (delErr) throw delErr;

        await loadPictures(productId);

        if (!pictures.value.some(p => p.IsMain) && pictures.value.length > 0) {
            const firstMedia = [...pictures.value].sort(
                (a, b) => (a.SortOrder ?? 999999) - (b.SortOrder ?? 999999)
            )[0];

            await setMainPicture(firstMedia);
        }

    } catch (err) {
        if (import.meta.env.DEV) console.error("[deletePicture]", err);
        picError.value = err?.message ?? String(err);
    } finally {
        picSaving.value = false;
    }
};

const movePicture = async (pic, direction) => {
    picSaving.value = true;
    picError.value = "";

    try {
        const list = pictures.value
            .filter(p => !p.IsMain)
            .sort((a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0));

        const index = list.findIndex(p => p.StoragePath === pic.StoragePath);
        const targetIndex = index + direction;

        if (index === -1 || targetIndex < 0 || targetIndex >= list.length) return;

        const a = list[index];
        const b = list[targetIndex];

        // 交換 SortOrder
        const aSort = a.SortOrder ?? 0;
        const bSort = b.SortOrder ?? 0;

        // ✅ 用 update，不用 upsert（避免插入新列）
        const { error: errA } = await db
            .from("C_PRD_ProductPictureList")
            .update({ SortOrder: bSort })
            .eq("ProductID", form.value.ID)
            .eq("StoragePath", a.StoragePath);

        if (errA) throw errA;

        const { error: errB } = await db
            .from("C_PRD_ProductPictureList")
            .update({ SortOrder: aSort })
            .eq("ProductID", form.value.ID)
            .eq("StoragePath", b.StoragePath);

        if (errB) throw errB;

        await loadPictures(form.value.ID);
    } catch (err) {
        picError.value = err?.message ?? String(err);
    } finally {
        picSaving.value = false;
    }
};


const setMainPicture = async (pic) => {
    if (!form.value.ID) return;
    picError.value = "";
    picSaving.value = true;
    try {
        const productId = form.value.ID;

        const { error: clearErr } = await db
            .from("C_PRD_ProductPictureList")
            .update({ IsMain: false })
            .eq("ProductID", productId);

        if (clearErr) throw clearErr;

        const { error: setErr } = await db
            .from("C_PRD_ProductPictureList")
            .update({ IsMain: true })
            .eq("ProductID", productId)
            .eq("StoragePath", pic.StoragePath);

        if (setErr) throw setErr;

        await loadPictures(productId);
    } catch (err) {
        picError.value = err?.message ?? String(err);
    } finally {
        picSaving.value = false;
    }
};

const loadSizeSpecs = async (productId) => {
    if (!productId) {
        sizeSpecs.value = [];
        return;
    }

    try {
        const { data, error } = await db
            .from("C_PRD_ProductSizeSpecList")
            .select('ProductID, "SizeID", "Bust", "ClothLength", "SleeveLength", "ShoulderWidth", "Waist", "SkirtLength", "Hip"')
            .eq("ProductID", productId)
            .order("SizeID", { ascending: true });

        if (error) throw error;

        const list = data ?? [];

        // 讓 SizeName 能顯示（用你 sizes master 補 Description）
        sizeSpecs.value = list.map((r) => {
            const s = sizes.value.find(x => x.ID === r.SizeID);
            return {
                ProductID: productId,
                SizeID: r.SizeID,
                SizeName: s?.Description ?? String(r.SizeID),

                Bust: r.Bust ?? null,
                ClothLength: r.ClothLength ?? null,
                SleeveLength: r.SleeveLength ?? null,
                ShoulderWidth: r.ShoulderWidth ?? null,
                Waist: r.Waist ?? null,
                SkirtLength: r.SkirtLength ?? null,
                Hip: r.Hip ?? null,
            };
        });

        // 如果你有用 selectedSizeIds 控制尺寸表顯示，可同步勾選
        // selectedSizeIds.value = [...new Set(list.map(x => x.SizeID))];

    } catch (err) {
        errorMsg.value = err?.message ?? String(err);
    }
};


const generateSizeSpecs = () => {
    const map = new Map();

    // 保留已填過的值
    for (const row of sizeSpecs.value) {
        map.set(row.SizeID, row);
    }

    const rows = [];

    // 依 SortOrder 排序
    const sortedSizes = sizes.value
        .filter(s => selectedSizeIds.value.includes(s.ID))
        .sort((a, b) => (a.SortOrder ?? 9999) - (b.SortOrder ?? 9999));

    for (const s of sortedSizes) {
        const old = map.get(s.ID);

        rows.push({
            SizeID: s.ID,
            SizeName: s.Description,
            Bust: old?.Bust ?? null,
            ClothLength: old?.ClothLength ?? null,
            SleeveLength: old?.SleeveLength ?? null,
            ShoulderWidth: old?.ShoulderWidth ?? null,
            Waist: old?.Waist ?? null,
            SkirtLength: old?.SkirtLength ?? null,
            Hip: old?.Hip ?? null,
        });
    }

    sizeSpecs.value = rows;
};

const deleteProduct = async () => {
    if (!form.value.ID) return;

    const ok = window.confirm("確定要刪除這個商品嗎？此動作無法復原！");
    if (!ok) return;

    const productId = form.value.ID;

    loading.value = true;
    errorMsg.value = "";

    try {
        // 🟡 1️⃣ 先抓圖片（一定要最前面）
        const { data: pics } = await db
            .from("C_PRD_ProductPictureList")
            .select("StoragePath")
            .eq("ProductID", productId);

        // 🟡 2️⃣ 刪 Storage
        if (pics?.length) {
            const paths = pics.map(p => p.StoragePath);

            const { error: storageErr } = await supabase.storage
                .from("product-pictures")
                .remove(paths);

            if (storageErr) throw storageErr;
        }

        // 🟡 3️⃣ 刪子表
        const tables = [
            "C_PRD_ProductPictureList",
            "C_PRD_ProductSizeSpecList",
            "C_PRD_ProductTag",
            "C_PRD_ProductVariantList"
        ];

        for (const table of tables) {
            const { error } = await db
                .from(table)
                .delete()
                .eq("ProductID", productId);

            if (error) throw error;
        }

        // 🟡 4️⃣ 刪主表
        const { error: mainErr } = await db
            .from("C_PRD_ProductList")
            .delete()
            .eq("ID", productId);

        if (mainErr) throw mainErr;

        alert("刪除成功");
        router.push("/admin/products");

    } catch (err) {
        if (import.meta.env.DEV) console.error(err);
        errorMsg.value = err?.message ?? "刪除失敗";
    } finally {
        loading.value = false;
    }
};



watch([selectedColorIds, selectedSizeIds], () => {
    generateVariants();
});

watch(selectedSizeIds, () => {
    generateSizeSpecs();
});

const togglePublish = async () => {
    // 先簡化：直接切 IsActive 然後 save
    form.value.IsActive = !form.value.IsActive;
    await saveDraft();
};

// =============
// Lifecycle
// =============
onMounted(async () => {
    await loadCategories();
    await loadColors();
    await loadSizes();

    if (!isNew.value && routeId.value) {
        await loadProduct(routeId.value);
        await loadVariants(routeId.value);
        await loadPictures(routeId.value);
        await loadSizeSpecs(routeId.value);
    }
});
</script>

<template>
    <div class="container-fluid py-3">
        <!-- Header Bar -->
        <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
            <div class="me-auto">
                <button class="btn btn-sm btn-outline-secondary mb-2" @click="goBack">
                    ← {{ t("common.back") }}
                </button>

                <h4 class="mb-1">{{ pageTitle }}</h4>

                <div class="text-muted small">
                    #{{ form.ID ?? "-" }} ·
                    <span class="badge" :class="form.IsActive ? 'bg-success' : 'bg-secondary'">
                        {{ form.IsActive ? t("common.active") : t("common.inactive") }}
                    </span>
                </div>
            </div>

            <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-outline-primary" @click="saveDraft" :disabled="loading || saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    {{ t("common.saveDraft") }}
                </button>

                <button class="btn btn-primary" @click="togglePublish" :disabled="loading || saving">
                    {{ form.IsActive ? t("product.productEdit.unpublish") : t("product.productEdit.publish") }}
                </button>

                <button class="btn btn-outline-danger" @click="deleteProduct" :disabled="loading || saving">
                    {{ t("common.delete") }}
                </button>
            </div>
        </div>

        <div v-if="errorMsg" class="alert alert-danger">
            {{ errorMsg }}
        </div>

        <!-- Main layout (RWD) -->
        <div class="row g-3">
            <!-- Left: Basic -->
            <div class="col-12 col-xl-6">
                <div class="card">
                    <div class="card-header bg-white">
                        <div class="fw-semibold">{{ t("product.productEdit.sectionBasic") }}</div>
                    </div>

                    <div class="card-body">
                        <div v-if="loading" class="text-muted">{{ t("common.loading") }}</div>

                        <div v-else class="row g-3">
                            <div class="col-12">
                                <label class="form-label">{{ t("product.productEdit.productName") }} *</label>
                                <input v-model="form.ProductName" class="form-control" type="text" :disabled="saving" />
                            </div>

                            <div class="col-12">
                                <label class="form-label">{{ t("product.productEdit.subTitle") }}</label>
                                <input v-model="form.SubTitle" class="form-control" type="text" :disabled="saving" />
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">{{ t("product.productEdit.category") }} *</label>

                                <select v-model="form.Category" class="form-select"
                                    :disabled="saving || categoryLoading">
                                    <option value="" disabled>
                                        {{ t("product.productEdit.selectCategory") }}
                                    </option>

                                    <option v-for="c in categoryOptions" :key="c.Name" :value="c.Name">
                                        {{ c.Description }}
                                    </option>
                                </select>

                                <div class="form-text" v-if="categoryLoading">
                                    {{ t("common.loading") }}
                                </div>
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">{{ t("product.productEdit.isActive") }}</label>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" v-model="form.IsActive"
                                        :disabled="saving" />
                                    <label class="form-check-label">
                                        {{ form.IsActive ? t("common.active") : t("common.inactive") }}
                                    </label>
                                </div>
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">預購模式</label>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" v-model="form.IsPreOrder"
                                        :disabled="saving" />
                                    <label class="form-check-label">
                                        {{ form.IsPreOrder ? '預購中（前台顯示預購 badge）' : '正常銷售' }}
                                    </label>
                                </div>
                            </div>

                            <template v-if="form.IsPreOrder">
                                <div class="col-12 col-md-6">
                                    <label class="form-label">預購說明（選填）</label>
                                    <input v-model="form.PreOrderNote" type="text" class="form-control"
                                        placeholder="e.g. 限量預購" :disabled="saving" />
                                </div>
                            </template>

                            <div class="col-12 col-md-6">
                                <label class="form-label">直播留言代碼
                                    <span class="text-muted small ms-1">（加入直播場次時自動帶入）</span>
                                </label>
                                <input v-model="form.LiveCode" type="text" class="form-control font-monospace"
                                    placeholder="e.g. A1" :disabled="saving"
                                    style="text-transform:uppercase"
                                    @input="form.LiveCode = form.LiveCode.toUpperCase()" />
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">{{ t("product.productEdit.price") }} *</label>
                                <input v-model="form.Price" class="form-control" type="number" min="0" step="1"
                                    :disabled="saving" />
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">{{ t("product.productEdit.originPrice") }}</label>
                                <input v-model="form.OriginPrice" class="form-control" type="number" min="0" step="1"
                                    :disabled="saving" />
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">{{ t("product.productEdit.createdDate") }}</label>
                                <input class="form-control" type="text" :value="createdDateText" disabled />
                            </div>

                            <div class="col-12 col-md-6">
                                <label class="form-label">{{ t("product.productEdit.updatedDate") }}</label>
                                <input class="form-control" type="text" :value="updatedDateText" disabled />
                            </div>

                            <div class="col-12">
                                <label class="form-label">{{ t("product.productEdit.material") }}</label>
                                <input v-model="form.Material" class="form-control" type="text" :disabled="saving" />
                            </div>

                            <div class="col-12">
                                <label class="form-label">{{ t("product.productEdit.washingMethod") }}</label>
                                <input v-model="form.WashingMethod" class="form-control" type="text"
                                    :disabled="saving" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Pictures -->
            <div class="col-12 col-xl-6">
                <div class="card h-100">
                    <div class="card-header bg-white d-flex align-items-center justify-content-between">
                        <div class="fw-semibold">
                            {{ t("product.productEdit.sectionPictures") }}
                        </div>

                        <button class="btn btn-sm btn-outline-primary" type="button" @click="openFilePicker"
                            :disabled="picSaving || !form.ID">
                            ＋ {{ t("product.productEdit.upload") }}
                        </button>
                    </div>

                    <div class="card-body">
                        <input ref="fileInput" type="file" accept="image/*, video/*" multiple class="d-none"
                            @change="(e) => uploadPictures(e.target.files)" />

                        <div v-if="!form.ID" class="text-muted small mb-2">
                            {{ t("product.pictures.needDraftFirst") }}
                        </div>

                        <div v-if="picError" class="alert alert-danger py-2">
                            {{ picError }}
                        </div>

                        <div v-if="picLoading" class="text-muted">
                            {{ t("common.loading") }}
                        </div>

                        <div v-else class="pic-grid">
                            <div v-for="p in pictures" :key="p.StoragePath" class="pic-item">
                                <div class="card h-100">
                                    <div class="thumb-wrap">
                                        <img v-if="p.Type === 'image'" :src="getPublicUrl(p.StoragePath)" class="thumb"
                                            :alt="p.AltText || ''" />

                                        <video v-else-if="p.Type === 'video'" class="thumb" controls preload="metadata">
                                            <source :src="getPublicUrl(p.StoragePath)" />
                                            你的瀏覽器不支援影片播放
                                        </video>

                                        <button class="badge-btn" type="button" :class="p.IsMain ? 'is-main' : 'is-sub'"
                                            @click="setMainPicture(p)" :disabled="picSaving || p.IsMain"
                                            :title="p.IsMain ? t('product.pictures.main') : t('product.pictures.setMain')">
                                            <span class="dot"></span>
                                            <span class="txt">
                                                {{ p.IsMain ? t("product.pictures.main") : t("product.pictures.sub") }}
                                            </span>
                                        </button>
                                    </div>

                                    <div class="card-body p-2">
                                        <div class="toolbar">
                                            <button class="icon-btn" type="button" @click="movePicture(p, -1)"
                                                :disabled="picSaving || p.IsMain || isFirstPicture(p)"
                                                :title="t('common.moveUp')">
                                                ↑
                                            </button>

                                            <button class="icon-btn" type="button" @click="movePicture(p, 1)"
                                                :disabled="picSaving || p.IsMain || isLastPicture(p)"
                                                :title="t('common.moveDown')">
                                                ↓
                                            </button>

                                            <button class="icon-btn danger" type="button" @click="deletePicture(p)"
                                                :disabled="picSaving" :title="t('common.delete')">
                                                ✕
                                            </button>
                                        </div>

                                        <input class="form-control form-control-sm mt-2" type="text" v-model="p.AltText"
                                            :placeholder="t('product.pictures.altPlaceholder')" :disabled="picSaving" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="text-muted small mt-2 d-lg-none">
                            {{ t("product.pictures.mobileHint") }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Variants -->
            <div class="col-12 col-xxl-6">
                <div class="card">
                    <div class="card-header bg-white">
                        <div class="fw-semibold">{{ t("product.productEdit.sectionVariants") }}</div>
                    </div>

                    <div class="card-body">
                        <!-- Colors -->
                        <div class="mb-3">
                            <label class="form-label fw-semibold">{{ t("product.variants.colors") }}</label>

                            <div v-if="loadingColors" class="text-muted small">
                                {{ t("common.loading") }}
                            </div>

                            <div v-else class="d-flex flex-wrap gap-3">
                                <div v-for="c in colors" :key="c.ID" class="form-check">
                                    <input class="form-check-input" type="checkbox" :id="`color-${c.ID}`" :value="c.ID"
                                        v-model="selectedColorIds" />
                                    <label class="form-check-label" :for="`color-${c.ID}`">
                                        {{ c.Description }}
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Sizes -->
                        <div class="mb-3">
                            <label class="form-label fw-semibold">{{ t("product.variants.sizes") }}</label>

                            <div v-if="loadingSizes" class="text-muted small">
                                {{ t("common.loading") }}
                            </div>

                            <div v-else class="d-flex flex-wrap gap-3">
                                <div v-for="s in sizes" :key="s.ID" class="form-check">
                                    <input class="form-check-input" type="checkbox" :id="`size-${s.ID}`" :value="s.ID"
                                        v-model="selectedSizeIds" />
                                    <label class="form-check-label" :for="`size-${s.ID}`">
                                        {{ s.Description }}
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div v-if="variantRows.length" class="d-flex flex-wrap gap-2 mb-2 align-items-center">
                            <button class="btn btn-sm btn-outline-secondary" type="button" @click="setAllStockQty(0)"
                                :disabled="saving">
                                {{ t("common.setAll0") }}
                            </button>

                            <button class="btn btn-sm btn-outline-secondary" type="button" @click="setAllStockQty(5)"
                                :disabled="saving">
                                {{ t("common.setAll5") }}
                            </button>

                            <div class="vr d-none d-md-block"></div>

                            <button class="btn btn-sm btn-outline-secondary" type="button" @click="setAllSellable(true)"
                                :disabled="saving">
                                {{ t("common.setAllSellable") }}
                            </button>

                            <button class="btn btn-sm btn-outline-secondary" type="button"
                                @click="setAllSellable(false)" :disabled="saving">
                                {{ t("common.setAllUnsellable") }}
                            </button>
                        </div>

                        <div v-if="variantRows.length" class="table-responsive">
                            <table class="table table-bordered align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>{{ t("product.variants.colColor") }}</th>
                                        <th>{{ t("product.variants.colSize") }}</th>
                                        <th style="width: 160px">{{ t("product.variants.colStock") }}</th>
                                        <th style="width: 120px">{{ t("product.variants.colSellable") }}</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr v-for="v in variantRows" :key="`${v.ColorID}-${v.SizeID}`">
                                        <td>{{ v.ColorName }}</td>
                                        <td>{{ v.SizeName }}</td>
                                        <td>
                                            <input type="number" class="form-control" min="0"
                                                v-model.number="v.StockQty" />
                                        </td>
                                        <td class="text-center">
                                            <input type="checkbox" class="form-check-input" v-model="v.IsActive" />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div v-else class="text-muted small">
                            {{ t("product.variants.emptyHint") }}
                        </div>

                        <div class="text-muted small mt-2 d-lg-none">
                            {{ t("product.variants.mobileHint") }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Size Spec -->
            <div class="col-12 col-xxl-6">
                <div class="card h-100">
                    <div class="card-header bg-white">
                        <div class="fw-semibold">{{ t("product.productEdit.sectionSizeSpec") }}</div>
                    </div>

                    <div class="card-body">
                        <div v-if="!sizeSpecs.length" class="text-muted small">
                            {{ t("product.sizeSpec.emptyHint") }}
                        </div>

                        <div v-else class="table-responsive">
                            <table class="table table-bordered align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th style="width: 80px">{{ t("product.sizeSpec.size") }}</th>
                                        <th>{{ t("product.sizeSpec.bust") }} (cm)</th>
                                        <th>{{ t("product.sizeSpec.clothLength") }} (cm)</th>
                                        <th>{{ t("product.sizeSpec.sleeveLength") }} (cm)</th>
                                        <th>{{ t("product.sizeSpec.shoulderWidth") }} (cm)</th>
                                        <th>{{ t("product.sizeSpec.waist") }} (cm)</th>
                                        <th>{{ t("product.sizeSpec.skirtLength") }} (cm)</th>
                                        <th>{{ t("product.sizeSpec.hip") }} (cm)</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr v-for="row in sizeSpecs" :key="row.SizeID">
                                        <td class="fw-semibold text-center">{{ row.SizeName }}</td>

                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.Bust" /></td>
                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.ClothLength" /></td>
                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.SleeveLength" /></td>
                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.ShoulderWidth" /></td>
                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.Waist" /></td>
                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.SkirtLength" /></td>
                                        <td><input type="number" class="form-control" min="0" step="0.1"
                                                v-model.number="row.Hip" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="text-muted small mt-2">
                            {{ t("product.sizeSpec.unitHint") }}
                        </div>

                        <div class="text-muted small mt-2 d-lg-none">
                            {{ t("product.sizeSpec.mobileHint") }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Description/SEO -->
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-white">
                        <div class="fw-semibold">{{ t("product.productEdit.sectionExtra") }}</div>
                    </div>

                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">{{ t("product.productEdit.description") }}</label>
                            <textarea v-model="form.Description" class="form-control" rows="4"
                                :disabled="saving"></textarea>
                        </div>

                        <div class="row g-3">
                            <div class="col-12 col-lg-6">
                                <label class="form-label">{{ t("product.productEdit.seoTitle") }}</label>
                                <input v-model="form.SEOTitle" class="form-control" type="text" :disabled="saving" />
                            </div>

                            <div class="col-12 col-lg-6">
                                <label class="form-label">{{ t("product.productEdit.seoDescription") }}</label>
                                <input v-model="form.SEODescription" class="form-control" type="text"
                                    :disabled="saving" />
                            </div>
                        </div>

                        <div class="text-muted small mt-2">
                            {{ t("product.productEdit.extraHint") }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="text-muted small mt-2 d-xl-none">
            {{ t("product.productEdit.mobileHint") }}
        </div>
    </div>
</template>


<style scoped>
/* Grid：自適應欄數，不會破版 */
.pic-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

/* 在桌機右側欄位：強制 3 欄（你想要的一行三張） */
@media (max-width: 1400px) {
    .pic-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 768px) {
    .pic-grid {
        grid-template-columns: 1fr;
    }
}

.pic-item {
    min-width: 0;
}

/* 圖片區 */
.thumb-wrap {
    position: relative;
    width: 100%;
    background: #f6f7f8;
}

.thumb {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
    background: #000;
}

/* Badge：放在圖片左上角 */
.badge-btn {
    position: absolute;
    top: 10px;
    left: 10px;
    border: 0;
    padding: 6px 10px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, .12);
    backdrop-filter: blur(8px);
}

.badge-btn:disabled {
    opacity: 1;
    cursor: default;
}

.badge-btn .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: currentColor;
    display: inline-block;
}

/* 主圖：綠色系 */
.badge-btn.is-main {
    color: #0f5132;
    background: rgba(209, 231, 221, 0.95);
}

/* 副圖：灰色系 */
.badge-btn.is-sub {
    color: #495057;
    background: rgba(248, 249, 250, 0.95);
}

/* 工具列：小按鈕 */
.toolbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    /* ✅ 關鍵：不夠寬就換行 */
}

.icon-btn {
    width: 34px;
    height: 32px;
    border-radius: 10px;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.icon-btn:hover {
    background: #f8f9fa;
}

.icon-btn:disabled {
    opacity: 0.45;
}

.icon-btn.danger {
    border-color: rgba(220, 53, 69, 0.4);
    color: #dc3545;
}

.icon-btn.danger:hover {
    background: #fff5f5;
}

.card-body input.form-control {
    min-width: 0;
}
</style>
