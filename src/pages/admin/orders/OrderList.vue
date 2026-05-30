<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Modal } from "bootstrap";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const { t } = useI18n();

// ── Lookup maps ───────────────────────────────────────
const statusMap = ref({});        // ID → { ID, Name, Description }
const payMethodMap = ref({});     // ID → Description
const shippingMethodMap = ref({}); // ID → Description

// ── List state ────────────────────────────────────────
const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

// ── Filters ───────────────────────────────────────────
const q = ref("");
const filterStatus = ref("all");
const filterPayment = ref("all");

let _timer = null;
watch([q, filterStatus, filterPayment], () => {
  clearTimeout(_timer);
  _timer = setTimeout(() => loadOrders(), 300);
});

// ── Modal state ───────────────────────────────────────
let _modal = null;
const activeTab = ref("info");
const detailLoading = ref(false);
const detailOrder = ref(null);
const detailItems = ref([]);
const detailLogs = ref([]);

const editStatusId = ref(null);
const editAdminNote = ref("");
const editShippingName = ref("");
const editShippingPhone = ref("");
const editShippingAddress = ref("");

const saveLoading = ref(false);
const saveSuccess = ref(false);
const saveError = ref("");

const refundLoading = ref(false);
const refundError = ref("");
const refundSuccess = ref(false);

// ── 電子發票 ──────────────────────────────────────────
const invoiceLoading = ref(false);
const invoiceError = ref("");
const invoiceSuccess = ref("");
const allowanceAmtInput = ref("");
const showAllowanceForm = ref(false);

const INVOICE_STATUS_LABEL = {
  none:      '未開立',
  issued:    '已開立',
  voided:    '已作廢',
  allowance: '已折讓',
  wallet:    '毋需開立',
};

const isWalletOnly = computed(() =>
  detailOrder.value?.PaymentMethod === 'wallet' ||
  (detailOrder.value?.NewebpayAmt === 0 && (detailOrder.value?.WalletDeductAmt ?? 0) > 0)
);

// ── 標記已出貨（宅配）─────────────────────────────────
const shipForm = ref({ company: 'tcat', no: '' });
const shipLoading = ref(false);
const shipError = ref('');
const shipSuccess = ref(false);

const SHIP_COMPANIES = [
  { value: 'tcat', label: '黑貓宅急便' },
  { value: 'hct',  label: '新竹物流' },
  { value: 'post', label: '台灣郵局' },
  { value: 'other', label: '其他' },
];

const isHomeDelivery = computed(() =>
  detailOrder.value?.ShippingMethod !== 'cvscom'
);

const canMarkShipped = computed(() =>
  isHomeDelivery.value &&
  detailOrder.value?.PaymentStatus === 'paid' &&
  !detailOrder.value?.HomeDeliveryNo
);

const markShipped = async () => {
  if (!shipForm.value.no.trim()) { shipError.value = '請填寫物流單號'; return; }
  shipLoading.value = true;
  shipError.value = '';
  shipSuccess.value = false;
  try {
    const shippedStatus = statusOptions.value.find(s => s.Name === 'shipped')
    const { error } = await db
      .from('C_ORD_OrderList')
      .update({
        HomeDeliveryCompany: shipForm.value.company,
        HomeDeliveryNo: shipForm.value.no.trim(),
        ShippingStatus: 'shipped',
        ShippingStatusText: '已出貨',
        UpdatedDate: new Date().toISOString(),
        ...(shippedStatus ? { StatusID: shippedStatus.ID } : {}),
      })
      .eq('ID', detailOrder.value.ID);
    if (error) throw error;

    detailOrder.value = {
      ...detailOrder.value,
      HomeDeliveryCompany: shipForm.value.company,
      HomeDeliveryNo: shipForm.value.no.trim(),
      ShippingStatus: 'shipped',
      ShippingStatusText: '已出貨',
      ...(shippedStatus ? { StatusID: shippedStatus.ID } : {}),
    };
    if (shippedStatus) editStatusId.value = shippedStatus.ID;
    shipSuccess.value = true;
  } catch (err) {
    shipError.value = err?.message ?? String(err);
  } finally {
    shipLoading.value = false;
  }
};

// ── Load lookups ──────────────────────────────────────
const loadLookups = async () => {
  const [statusRes, payRes, shpRes] = await Promise.all([
    db.from("S_ORD_StatusList").select("ID, Name, Description"),
    db.from("S_PAY_PayMethodList").select("ID, Description"),
    db.from("S_SHP_ShippingMethodList").select("ID, Description"),
  ]);

  if (statusRes.data) {
    statusMap.value = Object.fromEntries(statusRes.data.map(r => [r.ID, r]));
  }
  if (payRes.data) {
    payMethodMap.value = Object.fromEntries(payRes.data.map(r => [r.ID, r.Description]));
  }
  if (shpRes.data) {
    shippingMethodMap.value = Object.fromEntries(shpRes.data.map(r => [r.ID, r.Description]));
  }
};

// ── Load order list ───────────────────────────────────
const loadOrders = async () => {
  loading.value = true;
  errorMsg.value = "";
  try {
    let query = db
      .from("C_ORD_OrderList")
      .select("ID, OrderNo, CustomerName, FinalAmount, NewebpayAmt, WalletDeductAmt, PaymentStatus, StatusID, CreatedDate")
      .order("CreatedDate", { ascending: false })
      .limit(200);

    const keyword = q.value.trim();
    if (keyword) {
      query = query.or(`OrderNo.ilike.%${keyword}%,CustomerName.ilike.%${keyword}%`);
    }
    if (filterStatus.value !== "all") {
      query = query.eq("StatusID", Number(filterStatus.value));
    }
    if (filterPayment.value !== "all") {
      query = query.eq("PaymentStatus", filterPayment.value);
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

// ── Open detail modal ─────────────────────────────────
const openDetail = async (id) => {
  detailOrder.value = null;
  detailItems.value = [];
  detailLogs.value = [];
  saveSuccess.value = false;
  saveError.value = "";
  refundSuccess.value = false;
  refundError.value = "";
  shipForm.value = { company: 'tcat', no: '' };
  shipError.value = '';
  shipSuccess.value = false;
  invoiceLoading.value = false;
  invoiceError.value = '';
  invoiceSuccess.value = '';
  allowanceAmtInput.value = '';
  showAllowanceForm.value = false;
  activeTab.value = "info";
  detailLoading.value = true;

  if (!_modal) {
    _modal = new Modal(document.getElementById("orderDetailModal"));
  }
  _modal.show();

  try {
    const [orderRes, itemsRes, logsRes] = await Promise.all([
      db.from("C_ORD_OrderList").select("*").eq("ID", id).single(),
      db.from("C_ORD_OrderItemList").select("*").eq("OrderID", id).order("ID"),
      db.from("C_ORD_OrderStatusLog").select("*").eq("OrderID", id).order("CreatedDate"),
    ]);

    if (orderRes.error) throw orderRes.error;

    detailOrder.value = orderRes.data;
    detailItems.value = itemsRes.data ?? [];
    detailLogs.value = logsRes.data ?? [];

    editStatusId.value = orderRes.data.StatusID;
    editAdminNote.value = orderRes.data.AdminNote ?? "";
    editShippingName.value = orderRes.data.ShippingName ?? "";
    editShippingPhone.value = orderRes.data.ShippingPhone ?? "";
    editShippingAddress.value = orderRes.data.ShippingAddress ?? "";
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    detailLoading.value = false;
  }
};

// ── Save changes ──────────────────────────────────────
const saveDetail = async () => {
  if (!detailOrder.value) return;
  saveLoading.value = true;
  saveSuccess.value = false;
  saveError.value = "";

  try {
    const oldStatusId = detailOrder.value.StatusID;
    const newStatusId = Number(editStatusId.value);

    const { error } = await db
      .from("C_ORD_OrderList")
      .update({
        StatusID: newStatusId,
        AdminNote: editAdminNote.value || null,
        ShippingName: editShippingName.value,
        ShippingPhone: editShippingPhone.value,
        ShippingAddress: editShippingAddress.value,
        UpdatedDate: new Date().toISOString(),
      })
      .eq("ID", detailOrder.value.ID);

    if (error) throw error;

    if (oldStatusId !== newStatusId) {
      await db.from("C_ORD_OrderStatusLog").insert({
        OrderID: detailOrder.value.ID,
        FromStatusID: oldStatusId,
        ToStatusID: newStatusId,
        CreatedDate: new Date().toISOString(),
      });

      // Refresh logs
      const { data: logs } = await db
        .from("C_ORD_OrderStatusLog")
        .select("*")
        .eq("OrderID", detailOrder.value.ID)
        .order("CreatedDate");
      detailLogs.value = logs ?? [];
    }

    // Sync local state
    detailOrder.value = {
      ...detailOrder.value,
      StatusID: newStatusId,
      AdminNote: editAdminNote.value || null,
      ShippingName: editShippingName.value,
      ShippingPhone: editShippingPhone.value,
      ShippingAddress: editShippingAddress.value,
    };

    const idx = rows.value.findIndex(r => r.ID === detailOrder.value.ID);
    if (idx !== -1) rows.value[idx].StatusID = newStatusId;

    saveSuccess.value = true;
  } catch (err) {
    saveError.value = err?.message ?? String(err);
  } finally {
    saveLoading.value = false;
  }
};

// ── Refund ────────────────────────────────────────────
const CREDIT_METHODS = new Set(['CREDIT', 'APPLEPAY', 'GOOGLEPAY', 'SAMSUNGPAY', 'WEBATM', 'UNIONPAY', 'CREDITAE', 'FOREIGN']);

const PAYMENT_METHOD_LABEL = {
  CREDIT:    '信用卡',
  APPLEPAY:  'Apple Pay',
  GOOGLEPAY: 'Google Pay',
  SAMSUNGPAY:'Samsung Pay',
  WEBATM:    '網路 ATM',
  UNIONPAY:  '銀聯卡',
  VACC:      'ATM 虛擬帳號',
  LINEPAY:   'LINE Pay',
  wallet:    '購物金（錢包）',
};
const fmtPayMethod = (m) => m ? (PAYMENT_METHOD_LABEL[m] ?? m) : '-';

const canRefund = computed(() => detailOrder.value?.PaymentStatus === 'paid');
const canApiRefund = computed(() => {
  const m = detailOrder.value?.PaymentMethod;
  return canRefund.value && !!m && CREDIT_METHODS.has(m);
});
const refundBtnLabel = computed(() => {
  const m = detailOrder.value?.PaymentMethod;
  if (m && CREDIT_METHODS.has(m)) return '信用卡退款（藍新 API）';
  if (m === 'VACC') return 'ATM 退款（手動匯款）';
  if (m === 'LINEPAY') return 'LINE Pay 退款（手動）';
  if (m === 'wallet') return '退回錢包（手動）';
  return '標記已退款（手動）';
});

const doRefund = async (manual = false) => {
  if (!detailOrder.value) return;
  const label = manual ? '標記已退款（ATM / 手動）' : '信用卡 API 退款';
  const confirmMsg = manual
    ? `確定將此訂單標記為「已退款」？\n請確認已完成手動匯款給顧客。`
    : `確定向藍新發動退款？\n退款金額：NT$ ${detailOrder.value.FinalAmount?.toLocaleString()}\n此操作無法撤銷。`;
  if (!window.confirm(confirmMsg)) return;

  refundLoading.value = true;
  refundError.value = "";
  refundSuccess.value = false;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refund-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderNo: detailOrder.value.OrderNo, manual }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '退款失敗');

    // 更新本地狀態，並自動設訂單狀態為「已退款」
    const refundedStatus = statusOptions.value.find(s => s.Name === 'refunded')
    if (refundedStatus) {
      await db.from('C_ORD_OrderList').update({ StatusID: refundedStatus.ID, UpdatedDate: new Date().toISOString() }).eq('ID', detailOrder.value.ID)
    }
    detailOrder.value = { ...detailOrder.value, PaymentStatus: 'refunded', ...(refundedStatus ? { StatusID: refundedStatus.ID } : {}) };
    const idx = rows.value.findIndex(r => r.ID === detailOrder.value.ID);
    if (idx !== -1) rows.value[idx].PaymentStatus = 'refunded';

    refundSuccess.value = true;
  } catch (err) {
    refundError.value = err?.message ?? String(err);
  } finally {
    refundLoading.value = false;
  }
};

// ── Invoice actions ───────────────────────────────────
const canIssueInvoice = computed(() =>
  detailOrder.value?.PaymentStatus === 'paid' &&
  (!detailOrder.value?.InvoiceStatus || detailOrder.value?.InvoiceStatus === 'none') &&
  !isWalletOnly.value
);
const canVoidInvoice = computed(() => detailOrder.value?.InvoiceStatus === 'issued');
const canAllowance   = computed(() => detailOrder.value?.InvoiceStatus === 'issued');

const doInvoiceAction = async (action) => {
  if (!detailOrder.value) return;

  const amt = Number(allowanceAmtInput.value);
  const confirmMsg = {
    issue:     `確定開立電子發票？\n訂單：${detailOrder.value.OrderNo}\n金額：NT$ ${detailOrder.value.FinalAmount?.toLocaleString()}`,
    void:      `確定作廢此發票？\n發票號碼：${detailOrder.value.InvoiceNumber}\n作廢後無法復原。`,
    allowance: `確定開立折讓 NT$ ${amt.toLocaleString()}？`,
  }[action];

  if (!window.confirm(confirmMsg)) return;

  invoiceLoading.value = true;
  invoiceError.value = "";
  invoiceSuccess.value = "";

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const body = { orderNo: detailOrder.value.OrderNo, action, ...(action === 'allowance' && { allowanceAmt: amt }) };

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/issue-invoice`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '操作失敗');

    if (action === 'issue') {
      detailOrder.value = {
        ...detailOrder.value,
        InvoiceStatus: 'issued',
        InvoiceNumber: data.invoiceNumber,
        InvoiceNo: data.invoiceNo,
        InvoiceRandomNum: data.randomNum,
        InvoiceIssuedAt: new Date().toISOString(),
      };
      invoiceSuccess.value = `發票開立成功：${data.invoiceNumber}`;
    } else if (action === 'void') {
      detailOrder.value = { ...detailOrder.value, InvoiceStatus: 'voided' };
      invoiceSuccess.value = '發票已作廢';
    } else if (action === 'allowance') {
      detailOrder.value = {
        ...detailOrder.value,
        InvoiceStatus: 'allowance',
        InvoiceAllowanceNo: data.allowanceNo,
        InvoiceAllowanceAmt: amt,
      };
      invoiceSuccess.value = `折讓開立成功：${data.allowanceNo}`;
      showAllowanceForm.value = false;
    }
  } catch (err) {
    invoiceError.value = err?.message ?? String(err);
  } finally {
    invoiceLoading.value = false;
  }
};

// ── Helpers ───────────────────────────────────────────
const formatDate = (val) => {
  if (!val) return "-";
  const d = new Date(val);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PAYMENT_BADGE = {
  pending:  "bg-warning text-dark",
  paid:     "bg-success",
  failed:   "bg-danger",
  refunded: "bg-secondary",
};

const paymentBadgeClass = (status) => PAYMENT_BADGE[status] ?? "bg-light text-dark";
const paymentLabel = (status) => t(`order.orders.payment_${status}`) ;
const statusLabel = (id) => statusMap.value[id]?.Description ?? "-";

const statusOptions = computed(() => Object.values(statusMap.value));
const hasData = computed(() => rows.value.length > 0);

const LOCKED_STATUS_NAMES = ["completed", "refunded"];
const isShippingLocked = computed(() => {
  if (!detailOrder.value) return false;
  const name = statusMap.value[detailOrder.value.StatusID]?.Name;
  return LOCKED_STATUS_NAMES.includes(name);
});

onMounted(async () => {
  await loadLookups();
  await loadOrders();
});
</script>

<template>
  <div class="container-fluid py-3">

    <!-- Header -->
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
      <div>
        <h4 class="mb-1">{{ t("order.orders.listTitle") }}</h4>
        <div class="text-muted small">{{ t("order.orders.listSubtitle") }}</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-lg-6">
            <div class="input-group">
              <span class="input-group-text">🔍</span>
              <input v-model="q" type="text" class="form-control"
                :placeholder="t('order.orders.searchPlaceholder')" />
              <button class="btn btn-outline-secondary" type="button" @click="q = ''">
                {{ t("common.clear") }}
              </button>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <select v-model="filterStatus" class="form-select">
              <option value="all">{{ t("order.orders.filterAllStatus") }}</option>
              <option v-for="s in statusOptions" :key="s.ID" :value="s.ID">
                {{ s.Description }}
              </option>
            </select>
          </div>
          <div class="col-6 col-lg-3">
            <select v-model="filterPayment" class="form-select">
              <option value="all">{{ t("order.orders.filterAllPayment") }}</option>
              <option value="pending">{{ t("order.orders.payment_pending") }}</option>
              <option value="paid">{{ t("order.orders.payment_paid") }}</option>
              <option value="failed">{{ t("order.orders.payment_failed") }}</option>
              <option value="refunded">{{ t("order.orders.payment_refunded") }}</option>
            </select>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
          <div class="text-muted small">{{ t("order.orders.count", { n: rows.length }) }}</div>
          <button class="btn btn-sm btn-outline-primary" @click="loadOrders" :disabled="loading">
            ⟳ {{ t("common.refresh") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <!-- Loading -->
    <div v-if="loading" class="text-muted py-4 text-center">{{ t("common.loading") }}</div>

    <!-- No data -->
    <div v-else-if="!hasData" class="text-muted py-4 text-center">{{ t("common.noData") }}</div>

    <!-- Table -->
    <div v-else class="card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>{{ t("order.orders.colOrderNo") }}</th>
              <th>{{ t("order.orders.colCreatedDate") }}</th>
              <th>{{ t("order.orders.colCustomer") }}</th>
              <th class="text-end">{{ t("order.orders.colAmount") }}</th>
              <th class="text-center">{{ t("order.orders.colPaymentStatus") }}</th>
              <th class="text-center">{{ t("order.orders.colStatus") }}</th>
              <th class="text-center">{{ t("common.action") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.ID">
              <td class="fw-semibold font-monospace small">{{ r.OrderNo }}</td>
              <td class="text-muted small">{{ formatDate(r.CreatedDate) }}</td>
              <td>{{ r.CustomerName }}</td>
              <td class="text-end fw-semibold">NT$ {{ (r.WalletDeductAmt > 0 ? (r.NewebpayAmt ?? r.FinalAmount) : r.FinalAmount)?.toLocaleString() }}</td>
              <td class="text-center">
                <span class="badge" :class="paymentBadgeClass(r.PaymentStatus)">
                  {{ paymentLabel(r.PaymentStatus) }}
                </span>
              </td>
              <td class="text-center">
                <span class="badge bg-light text-dark border">
                  {{ statusLabel(r.StatusID) }}
                </span>
              </td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" @click="openDetail(r.ID)">
                  {{ t("common.edit") }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <!-- ── Order Detail Modal ─────────────────────────── -->
  <div class="modal fade" id="orderDetailModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title font-monospace">
            {{ detailOrder ? t("order.orders.detailTitle", { no: detailOrder.OrderNo }) : "…" }}
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>

        <div class="modal-body">
          <!-- Loading skeleton -->
          <div v-if="detailLoading" class="text-center py-5 text-muted">
            {{ t("common.loading") }}
          </div>

          <template v-else-if="detailOrder">
            <!-- Tabs -->
            <ul class="nav nav-tabs mb-3">
              <li class="nav-item">
                <button class="nav-link" :class="{ active: activeTab === 'info' }"
                  @click="activeTab = 'info'">
                  {{ t("order.orders.tabInfo") }}
                </button>
              </li>
              <li class="nav-item">
                <button class="nav-link" :class="{ active: activeTab === 'items' }"
                  @click="activeTab = 'items'">
                  {{ t("order.orders.tabItems") }}
                  <span class="badge bg-secondary ms-1">{{ detailItems.length }}</span>
                </button>
              </li>
              <li class="nav-item">
                <button class="nav-link" :class="{ active: activeTab === 'log' }"
                  @click="activeTab = 'log'">
                  {{ t("order.orders.tabLog") }}
                </button>
              </li>
            </ul>

            <!-- ── Tab: 訂單資訊 ── -->
            <div v-show="activeTab === 'info'" class="row g-3">

              <!-- 顧客資訊（唯讀） -->
              <div class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-header small fw-semibold">{{ t("order.orders.sectionCustomer") }}</div>
                  <div class="card-body">
                    <dl class="info-dl">
                      <dt>{{ t("order.orders.labelOrderNo") }}</dt>
                      <dd class="font-monospace">{{ detailOrder.OrderNo }}</dd>

                      <dt>{{ t("order.orders.labelCreatedDate") }}</dt>
                      <dd>{{ formatDate(detailOrder.CreatedDate) }}</dd>

                      <dt>訂單金額</dt>
                      <dd>NT$ {{ detailOrder.FinalAmount?.toLocaleString() }}</dd>

                      <template v-if="detailOrder.WalletDeductAmt > 0">
                        <dt>實收金額</dt>
                        <dd class="fw-bold text-primary">NT$ {{ detailOrder.NewebpayAmt?.toLocaleString() }}</dd>
                      </template>

                      <dt>{{ t("order.orders.labelCustomerName") }}</dt>
                      <dd>{{ detailOrder.CustomerName }}</dd>

                      <dt>{{ t("order.orders.labelCustomerEmail") }}</dt>
                      <dd>{{ detailOrder.CustomerEmail }}</dd>

                      <dt>{{ t("order.orders.labelCustomerPhone") }}</dt>
                      <dd>{{ detailOrder.CustomerPhone || "-" }}</dd>

                      <dt>{{ t("order.orders.labelCustomerNote") }}</dt>
                      <dd class="text-muted">{{ detailOrder.CustomerNote || "-" }}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <!-- 金流資訊（唯讀） -->
              <div class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-header small fw-semibold">{{ t("order.orders.sectionPayment") }}</div>
                  <div class="card-body">
                    <dl class="info-dl">
                      <dt>{{ t("order.orders.labelPayMethod") }}</dt>
                      <dd>{{ fmtPayMethod(detailOrder.PaymentMethod) }}</dd>

                      <dt>{{ t("order.orders.labelPaymentStatus") }}</dt>
                      <dd>
                        <span class="badge" :class="paymentBadgeClass(detailOrder.PaymentStatus)">
                          {{ paymentLabel(detailOrder.PaymentStatus) }}
                        </span>
                      </dd>

                      <dt>{{ t("order.orders.labelPaidAt") }}</dt>
                      <dd>{{ formatDate(detailOrder.PaidAt) }}</dd>

                      <dt>{{ t("order.orders.labelItemsTotal") }}</dt>
                      <dd>NT$ {{ detailOrder.ItemsTotal?.toLocaleString() }}</dd>

                      <dt>{{ t("order.orders.labelShippingFee") }}</dt>
                      <dd>NT$ {{ detailOrder.ShippingFee?.toLocaleString() }}</dd>

                      <dt>{{ t("order.orders.labelDiscountAmount") }}</dt>
                      <dd>－ NT$ {{ detailOrder.DiscountAmount?.toLocaleString() }}</dd>

                      <template v-if="detailOrder.WalletDeductAmt > 0">
                        <dt>錢包折抵</dt>
                        <dd>－ NT$ {{ detailOrder.WalletDeductAmt?.toLocaleString() }}</dd>
                      </template>

                      <dt class="fw-semibold text-dark">{{ t("order.orders.labelFinalAmount") }}</dt>
                      <dd class="fw-bold text-primary">NT$ {{ (detailOrder.NewebpayAmt ?? detailOrder.FinalAmount)?.toLocaleString() }}</dd>

                      <dt>{{ t("order.orders.labelPaymentFee") }}</dt>
                      <dd>{{ detailOrder.PaymentFee != null ? `NT$ ${detailOrder.PaymentFee.toLocaleString()}` : "-" }}</dd>

                      <template v-if="detailOrder.PaymentFee != null && (detailOrder.NewebpayAmt ?? detailOrder.FinalAmount) > 0">
                        <dt class="fw-semibold text-dark">淨收金額</dt>
                        <dd class="fw-bold text-success">NT$ {{ ((detailOrder.NewebpayAmt ?? detailOrder.FinalAmount) - detailOrder.PaymentFee).toLocaleString() }}</dd>
                      </template>
                    </dl>
                  </div>
                </div>
              </div>

              <!-- 收件資訊（可編輯） -->
              <div class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-header small fw-semibold d-flex align-items-center justify-content-between">
                    {{ t("order.orders.sectionShipping") }}
                    <span v-if="isShippingLocked" class="badge bg-secondary fw-normal">
                      {{ t("order.orders.shippingLocked") }}
                    </span>
                  </div>
                  <div class="card-body">
                    <div v-if="isShippingLocked" class="alert alert-warning py-2 px-3 small mb-3">
                      {{ t("order.orders.shippingLockedHint") }}
                    </div>
                    <div class="mb-2">
                      <label class="form-label small mb-1">{{ t("order.orders.labelShippingMethod") }}</label>
                      <div class="text-muted small">
                        {{ shippingMethodMap[detailOrder.ShippingMethodID] ?? "-" }}
                      </div>
                    </div>
                    <div class="mb-2">
                      <label class="form-label small mb-1">{{ t("order.orders.labelShippingName") }}</label>
                      <input v-model="editShippingName" type="text" class="form-control form-control-sm"
                        :disabled="isShippingLocked" />
                    </div>
                    <div class="mb-2">
                      <label class="form-label small mb-1">{{ t("order.orders.labelShippingPhone") }}</label>
                      <input v-model="editShippingPhone" type="text" class="form-control form-control-sm"
                        :disabled="isShippingLocked" />
                    </div>
                    <div>
                      <label class="form-label small mb-1">{{ t("order.orders.labelShippingAddress") }}</label>
                      <input v-model="editShippingAddress" type="text" class="form-control form-control-sm"
                        :disabled="isShippingLocked" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 宅配出貨資訊 -->
              <div v-if="isHomeDelivery" class="col-12">
                <div class="card">
                  <div class="card-header small fw-semibold">宅配出貨資訊</div>
                  <div class="card-body">
                    <!-- 已填單號：顯示資訊 -->
                    <template v-if="detailOrder.HomeDeliveryNo">
                      <dl class="info-dl mb-0">
                        <dt>物流公司</dt>
                        <dd>{{ SHIP_COMPANIES.find(c => c.value === detailOrder.HomeDeliveryCompany)?.label ?? detailOrder.HomeDeliveryCompany ?? '-' }}</dd>
                        <dt>物流單號</dt>
                        <dd class="font-monospace">{{ detailOrder.HomeDeliveryNo }}</dd>
                      </dl>
                    </template>
                    <!-- 未出貨且可操作：填單號 -->
                    <template v-else-if="canMarkShipped">
                      <div v-if="shipError" class="alert alert-danger py-2 small mb-2">{{ shipError }}</div>
                      <div v-if="shipSuccess" class="alert alert-success py-2 small mb-2">已標記出貨</div>
                      <div class="row g-2 align-items-end">
                        <div class="col-12 col-sm-4">
                          <label class="form-label small mb-1">物流公司</label>
                          <select v-model="shipForm.company" class="form-select form-select-sm">
                            <option v-for="c in SHIP_COMPANIES" :key="c.value" :value="c.value">{{ c.label }}</option>
                          </select>
                        </div>
                        <div class="col-12 col-sm-5">
                          <label class="form-label small mb-1">物流單號</label>
                          <input v-model="shipForm.no" type="text" class="form-control form-control-sm"
                            placeholder="輸入物流單號" :disabled="shipLoading" />
                        </div>
                        <div class="col-12 col-sm-3">
                          <button class="btn btn-success btn-sm w-100" @click="markShipped" :disabled="shipLoading">
                            <span v-if="shipLoading" class="spinner-border spinner-border-sm me-1"></span>
                            標記已出貨
                          </button>
                        </div>
                      </div>
                    </template>
                    <!-- 未付款或其他狀況 -->
                    <p v-else class="text-muted small mb-0">訂單付款後才可標記出貨</p>
                  </div>
                </div>
              </div>

              <!-- 電子發票 -->
              <div v-if="detailOrder.PaymentStatus === 'paid' || detailOrder.InvoiceStatus !== 'none'" class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-header small fw-semibold">電子發票</div>
                  <div class="card-body">
                    <dl class="info-dl">
                      <dt>發票狀態</dt>
                      <dd>
                        <span class="badge" :class="{
                          'bg-secondary': !isWalletOnly && (!detailOrder.InvoiceStatus || detailOrder.InvoiceStatus === 'none'),
                          'bg-success':   detailOrder.InvoiceStatus === 'issued',
                          'bg-danger':    detailOrder.InvoiceStatus === 'voided',
                          'bg-warning text-dark': detailOrder.InvoiceStatus === 'allowance',
                          'bg-light text-muted border': isWalletOnly,
                        }">
                          {{ isWalletOnly ? '毋需開立' : (INVOICE_STATUS_LABEL[detailOrder.InvoiceStatus] || '未開立') }}
                        </span>
                      </dd>
                      <template v-if="detailOrder.InvoiceNumber">
                        <dt>發票號碼</dt>
                        <dd class="font-monospace">{{ detailOrder.InvoiceNumber }}</dd>
                        <dt>隨機碼</dt>
                        <dd class="font-monospace">{{ detailOrder.InvoiceRandomNum }}</dd>
                        <dt>開立時間</dt>
                        <dd>{{ formatDate(detailOrder.InvoiceIssuedAt) }}</dd>
                      </template>
                      <template v-if="detailOrder.InvoiceAllowanceNo">
                        <dt>折讓號</dt>
                        <dd class="font-monospace">{{ detailOrder.InvoiceAllowanceNo }}</dd>
                        <dt>折讓金額</dt>
                        <dd>NT$ {{ detailOrder.InvoiceAllowanceAmt?.toLocaleString() }}</dd>
                      </template>
                    </dl>

                    <!-- 開立折讓 inline form -->
                    <div v-if="showAllowanceForm" class="mt-3 border-top pt-3">
                      <div class="mb-2">
                        <label class="form-label small mb-1">折讓金額（NT$）</label>
                        <input v-model="allowanceAmtInput" type="number" class="form-control form-control-sm"
                          placeholder="輸入折讓金額" min="1" :max="detailOrder.FinalAmount" :disabled="invoiceLoading" />
                      </div>
                      <div class="d-flex gap-2">
                        <button class="btn btn-warning btn-sm" :disabled="invoiceLoading || !allowanceAmtInput"
                          @click="doInvoiceAction('allowance')">
                          <span v-if="invoiceLoading" class="spinner-border spinner-border-sm me-1"></span>
                          確認開立折讓
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" @click="showAllowanceForm = false">取消</button>
                      </div>
                    </div>

                    <div v-if="invoiceSuccess" class="alert alert-success py-2 small mt-2 mb-0">{{ invoiceSuccess }}</div>
                    <div v-if="invoiceError" class="alert alert-danger py-2 small mt-2 mb-0">{{ invoiceError }}</div>
                  </div>
                </div>
              </div>

              <!-- 訂單狀態 & 備註（可編輯） -->
              <div class="col-12 col-md-6">
                <div class="card h-100">
                  <div class="card-header small fw-semibold">{{ t("order.orders.sectionStatus") }}</div>
                  <div class="card-body">
                    <div class="mb-3">
                      <label class="form-label small mb-1">{{ t("order.orders.labelStatus") }}</label>
                      <select v-model="editStatusId" class="form-select form-select-sm">
                        <option v-for="s in statusOptions" :key="s.ID" :value="s.ID">
                          {{ s.Description }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="form-label small mb-1">{{ t("order.orders.labelAdminNote") }}</label>
                      <textarea v-model="editAdminNote" class="form-control form-control-sm" rows="5"
                        :placeholder="t('order.orders.adminNotePlaceholder')"></textarea>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <!-- ── Tab: 商品明細 ── -->
            <div v-show="activeTab === 'items'">
              <div v-if="!detailItems.length" class="text-muted text-center py-4">
                {{ t("common.noData") }}
              </div>
              <div v-else class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>{{ t("order.orders.colProduct") }}</th>
                      <th>{{ t("order.orders.colVariant") }}</th>
                      <th class="text-end">{{ t("order.orders.colUnitPrice") }}</th>
                      <th class="text-center">{{ t("order.orders.colQty") }}</th>
                      <th class="text-end">{{ t("order.orders.colSubTotal") }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in detailItems" :key="item.ID">
                      <td>{{ item.ProductName }}</td>
                      <td class="text-muted small">
                        {{ [item.ColorName, item.SizeName].filter(Boolean).join(" / ") || "-" }}
                      </td>
                      <td class="text-end">NT$ {{ item.UnitPrice?.toLocaleString() }}</td>
                      <td class="text-center">× {{ item.Qty }}</td>
                      <td class="text-end fw-semibold">NT$ {{ item.SubTotal?.toLocaleString() }}</td>
                    </tr>
                  </tbody>
                  <tfoot class="table-light">
                    <tr>
                      <td colspan="4" class="text-end fw-semibold small">
                        {{ t("order.orders.labelItemsTotal") }}
                      </td>
                      <td class="text-end fw-bold">NT$ {{ detailOrder.ItemsTotal?.toLocaleString() }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <!-- ── Tab: 狀態紀錄 ── -->
            <div v-show="activeTab === 'log'">
              <div v-if="!detailLogs.length" class="text-muted text-center py-4">
                {{ t("order.orders.logEmpty") }}
              </div>
              <ul v-else class="list-group list-group-flush">
                <li v-for="log in detailLogs" :key="log.ID"
                  class="list-group-item px-0 py-2">
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="text-muted small">{{ formatDate(log.CreatedDate) }}</span>
                    <template v-if="log.FromStatusID">
                      <span class="badge bg-light text-dark border">
                        {{ statusLabel(log.FromStatusID) }}
                      </span>
                      <span class="text-muted">→</span>
                    </template>
                    <span class="badge bg-primary">{{ statusLabel(log.ToStatusID) }}</span>
                    <span v-if="log.Note" class="text-muted small">{{ log.Note }}</span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Save feedback -->
            <div v-if="saveSuccess" class="alert alert-success mt-3 mb-0 py-2 small">
              {{ t("order.orders.saveSuccess") }}
            </div>
            <div v-if="saveError" class="alert alert-danger mt-3 mb-0 py-2 small">
              {{ saveError }}
            </div>

            <!-- Refund feedback -->
            <div v-if="refundSuccess" class="alert alert-success mt-3 mb-0 py-2 small">
              退款完成，訂單已更新為「已退款」。
            </div>
            <div v-if="refundError" class="alert alert-danger mt-3 mb-0 py-2 small">
              {{ refundError }}
            </div>
          </template>
        </div>

        <div class="modal-footer flex-wrap gap-2">
          <!-- 退款區塊（只有已付款才顯示） -->
          <template v-if="detailOrder && canRefund && !refundSuccess">
            <button
              v-if="canApiRefund"
              type="button"
              class="btn btn-outline-danger me-auto"
              :disabled="refundLoading"
              @click="doRefund(false)"
            >
              <span v-if="refundLoading" class="spinner-border spinner-border-sm me-1"></span>
              {{ refundLoading ? '退款中…' : refundBtnLabel }}
            </button>
            <button
              v-else
              type="button"
              class="btn btn-outline-danger me-auto"
              :disabled="refundLoading"
              @click="doRefund(true)"
            >
              <span v-if="refundLoading" class="spinner-border spinner-border-sm me-1"></span>
              {{ refundLoading ? '處理中…' : refundBtnLabel }}
            </button>
          </template>

          <!-- 發票按鈕 -->
          <template v-if="detailOrder && canIssueInvoice">
            <button type="button" class="btn btn-outline-success" :disabled="invoiceLoading"
              @click="doInvoiceAction('issue')">
              <span v-if="invoiceLoading" class="spinner-border spinner-border-sm me-1"></span>
              {{ invoiceLoading ? '開立中…' : '開立發票' }}
            </button>
          </template>
          <template v-if="detailOrder && canVoidInvoice && !invoiceSuccess">
            <button type="button" class="btn btn-outline-danger" :disabled="invoiceLoading"
              @click="doInvoiceAction('void')">
              <span v-if="invoiceLoading" class="spinner-border spinner-border-sm me-1"></span>
              作廢發票
            </button>
            <button type="button" class="btn btn-outline-warning" :disabled="invoiceLoading"
              @click="showAllowanceForm = !showAllowanceForm">
              開立折讓
            </button>
          </template>

          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
            {{ t("common.close") }}
          </button>
          <button v-if="detailOrder" type="button" class="btn btn-primary"
            :disabled="saveLoading" @click="saveDetail">
            {{ saveLoading ? t("common.loading") : t("order.orders.save") }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.info-dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 14px;
  font-size: 13px;
  margin: 0;
}

.info-dl dt {
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.info-dl dd {
  margin: 0;
  word-break: break-all;
}
</style>
