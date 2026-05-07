<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/lib/db";
import { useRouter } from "vue-router";

const router = useRouter();

const stats = ref({
  ordersToday: 0,
  ordersMonth: 0,
  revenueMonth: 0,
  pendingPayment: 0,
  lowStock: 0,
});
const recentOrders = ref([]);
const loading = ref(true);

onMounted(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [
    { data: ordersToday },
    { data: ordersMonth },
    { data: pendingOrders },
    { data: lowStockVariants },
    { data: recent },
  ] = await Promise.all([
    db.from("C_ORD_OrderList")
      .select("ID", { count: "exact", head: true })
      .gte("CreatedDate", today + "T00:00:00"),
    db.from("C_ORD_OrderList")
      .select("ID, FinalAmount, PaymentStatus")
      .gte("CreatedDate", firstOfMonth + "T00:00:00"),
    db.from("C_ORD_OrderList")
      .select("ID", { count: "exact", head: true })
      .eq("PaymentStatus", "pending"),
    db.from("C_PRD_ProductVariantList")
      .select("ID", { count: "exact", head: true })
      .lte("StockQty", 3)
      .eq("IsActive", true),
    db.from("C_ORD_OrderList")
      .select("ID, OrderNo, CustomerName, FinalAmount, PaymentStatus, CreatedDate")
      .order("CreatedDate", { ascending: false })
      .limit(8),
  ]);

  const paid = (ordersMonth ?? []).filter((o) => o.PaymentStatus === "paid");
  stats.value = {
    ordersToday: ordersToday?.length ?? 0,
    ordersMonth: ordersMonth?.length ?? 0,
    revenueMonth: paid.reduce((sum, o) => sum + (o.FinalAmount ?? 0), 0),
    pendingPayment: pendingOrders?.length ?? 0,
    lowStock: lowStockVariants?.length ?? 0,
  };
  recentOrders.value = recent ?? [];
  loading.value = false;
});

const formatDate = (val) => {
  if (!val) return "-";
  const d = new Date(val);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const paymentBadge = (status) => ({
  pending: { class: "bg-warning text-dark", label: "待付款" },
  paid: { class: "bg-success", label: "已付款" },
  failed: { class: "bg-danger", label: "付款失敗" },
  refunded: { class: "bg-secondary", label: "已退款" },
}[status] ?? { class: "bg-light text-dark", label: status });
</script>

<template>
  <div class="container-fluid py-3">
    <div class="mb-4">
      <h4 class="mb-0">Dashboard</h4>
      <div class="text-muted small">Aley's Wardrobe 後台總覽</div>
    </div>

    <div v-if="loading" class="text-muted">載入中...</div>

    <template v-else>
      <!-- Stats Cards -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="stat-label">今日訂單</div>
            <div class="stat-value">{{ stats.ordersToday }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="stat-label">本月訂單</div>
            <div class="stat-value">{{ stats.ordersMonth }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="stat-label">本月營收</div>
            <div class="stat-value text-success">NT$ {{ stats.revenueMonth.toLocaleString() }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="stat-card" :class="{ 'stat-card--warn': stats.pendingPayment > 0 }">
            <div class="stat-label">待付款訂單</div>
            <div class="stat-value">{{ stats.pendingPayment }}</div>
          </div>
        </div>
      </div>

      <!-- Low stock warning -->
      <div v-if="stats.lowStock > 0" class="alert alert-warning d-flex align-items-center gap-2 mb-4">
        <span style="font-size:18px">⚠️</span>
        <span>
          有 <strong>{{ stats.lowStock }}</strong> 個規格庫存 ≤ 3，請儘快補貨。
          <a class="ms-2" href="#" @click.prevent="router.push('/admin/inventory/overview')">查看庫存總覽 →</a>
        </span>
      </div>

      <!-- Recent orders -->
      <div class="card">
        <div class="card-header bg-white d-flex align-items-center justify-content-between">
          <span class="fw-semibold">最新訂單</span>
          <a href="#" class="small" @click.prevent="router.push('/admin/orders')">查看全部 →</a>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0 align-middle">
              <thead class="table-light">
                <tr>
                  <th>建立時間</th>
                  <th>訂單編號</th>
                  <th>顧客</th>
                  <th>實付金額</th>
                  <th>付款狀態</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="recentOrders.length === 0">
                  <td colspan="5" class="text-center text-muted py-4">目前沒有訂單</td>
                </tr>
                <tr
                  v-for="o in recentOrders"
                  :key="o.ID"
                  style="cursor:pointer"
                  @click="router.push('/admin/orders')"
                >
                  <td class="text-muted">{{ formatDate(o.CreatedDate) }}</td>
                  <td class="fw-semibold font-monospace">{{ o.OrderNo }}</td>
                  <td>{{ o.CustomerName }}</td>
                  <td>NT$ {{ o.FinalAmount?.toLocaleString() }}</td>
                  <td>
                    <span class="badge" :class="paymentBadge(o.PaymentStatus).class">
                      {{ paymentBadge(o.PaymentStatus).label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat-card {
  background: #fff;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 10px;
  padding: 18px 20px;
}
.stat-card--warn {
  border-color: #f59e0b;
  background: #fffbeb;
}
.stat-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #111827;
}
</style>
