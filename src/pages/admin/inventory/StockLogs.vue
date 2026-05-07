<script setup>
import { ref, computed, onMounted } from "vue";
import { db } from "@/lib/db";

const logs = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const search = ref("");

onMounted(load);

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data: orders, error: ordErr } = await db
      .from("C_ORD_OrderList")
      .select("ID, OrderNo, PaidAt, CreatedDate")
      .eq("PaymentStatus", "paid")
      .order("CreatedDate", { ascending: false })
      .limit(100);

    if (ordErr) throw ordErr;
    if (!orders?.length) { logs.value = []; return; }

    const orderIds = orders.map((o) => o.ID);
    const orderMap = Object.fromEntries(orders.map((o) => [o.ID, o]));

    const { data: items, error: itemErr } = await db
      .from("C_ORD_OrderItemList")
      .select("ID, OrderID, ProductName, ColorName, SizeName, Qty, UnitPrice")
      .in("OrderID", orderIds)
      .order("ID", { ascending: false });

    if (itemErr) throw itemErr;

    logs.value = (items ?? []).map((item) => ({
      ...item,
      OrderNo: orderMap[item.OrderID]?.OrderNo ?? "-",
      PaidAt: orderMap[item.OrderID]?.PaidAt ?? orderMap[item.OrderID]?.CreatedDate,
    }));
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

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return logs.value;
  return logs.value.filter(
    (l) =>
      l.OrderNo?.toLowerCase().includes(q) ||
      l.ProductName?.toLowerCase().includes(q)
  );
});
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h4 class="mb-1">庫存紀錄</h4>
        <div class="text-muted small">依已付款訂單顯示庫存扣除紀錄（最近 100 筆訂單）</div>
      </div>
      <button class="btn btn-outline-secondary btn-sm" @click="load" :disabled="loading">重新整理</button>
    </div>

    <div class="mb-3">
      <input
        v-model="search"
        type="text"
        class="form-control"
        style="max-width:320px"
        placeholder="搜尋訂單編號 / 商品名稱"
      />
    </div>

    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <div class="card">
      <div class="card-body p-0">
        <div v-if="loading" class="p-3 text-muted">載入中...</div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th style="width:18%">付款時間</th>
                <th style="width:16%">訂單編號</th>
                <th style="width:24%">商品名稱</th>
                <th style="width:12%">顏色</th>
                <th style="width:8%">尺寸</th>
                <th style="width:8%">扣除數量</th>
                <th style="width:10%">單價</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filtered.length === 0">
                <td colspan="7" class="text-center text-muted py-4">目前沒有資料</td>
              </tr>
              <tr v-for="l in filtered" :key="l.ID">
                <td class="text-muted">{{ formatDate(l.PaidAt) }}</td>
                <td class="fw-semibold font-monospace">{{ l.OrderNo }}</td>
                <td>{{ l.ProductName }}</td>
                <td class="text-muted">{{ l.ColorName }}</td>
                <td class="text-muted">{{ l.SizeName }}</td>
                <td>
                  <span class="badge bg-danger">－{{ l.Qty }}</span>
                </td>
                <td class="text-muted">NT$ {{ l.UnitPrice?.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
