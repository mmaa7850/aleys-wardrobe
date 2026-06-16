<script setup>
import { ref, computed } from 'vue'
import { PDFDocument } from 'pdf-lib'

const PTS_PER_MM = 2.8346

// ── 尺寸設定 ─────────────────────────────────────────
const widthMm  = ref(100)
const heightMm = ref(150)

// ── 檔案 ─────────────────────────────────────────────
const fileInput     = ref(null)
const pdfFile       = ref(null)
const pageCount     = ref(0)
const srcPageSizeMm = ref(null)
const fileErr       = ref('')

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  fileErr.value     = ''
  downloadUrl.value = ''

  try {
    const bytes = await file.arrayBuffer()
    const doc   = await PDFDocument.load(bytes)
    const page  = doc.getPage(0)
    const { width, height } = page.getSize()
    srcPageSizeMm.value = {
      w: (width  / PTS_PER_MM).toFixed(1),
      h: (height / PTS_PER_MM).toFixed(1),
    }
    pageCount.value = doc.getPageCount()
    pdfFile.value   = file
  } catch {
    fileErr.value = '無法讀取 PDF，請確認檔案格式正確'
    pdfFile.value = null
    pageCount.value = 0
    srcPageSizeMm.value = null
  }
}

// ── 裁切輸出 ─────────────────────────────────────────
const processing  = ref(false)
const downloadUrl = ref('')
const processErr  = ref('')

const outputFileName = computed(() => {
  if (!pdfFile.value) return ''
  return pdfFile.value.name.replace(/\.pdf$/i, '') + `_${widthMm.value}x${heightMm.value}mm.pdf`
})

async function process() {
  if (!pdfFile.value) return
  processing.value  = true
  processErr.value  = ''
  downloadUrl.value = ''

  try {
    const cropW = widthMm.value  * PTS_PER_MM
    const cropH = heightMm.value * PTS_PER_MM

    const bytes  = await pdfFile.value.arrayBuffer()
    const srcDoc = await PDFDocument.load(bytes)
    const newDoc = await PDFDocument.create()

    for (let i = 0; i < srcDoc.getPageCount(); i++) {
      const srcPage = srcDoc.getPage(i)
      const { width: srcW, height: srcH } = srcPage.getSize()

      const [embedded] = await newDoc.embedPages([srcPage])
      const newPage = newDoc.addPage([cropW, cropH])

      // 將來源頁面往下移，使來源的視覺頂端對齊新頁頂端
      // PDF 座標原點在左下角，所以 y = cropH - srcH 可讓頂端對齊
      newPage.drawPage(embedded, {
        x: 0,
        y: cropH - srcH,
        width:  srcW,
        height: srcH,
      })
    }

    const pdfBytes = await newDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    processErr.value = e?.message || '處理失敗，請稍後再試'
  } finally {
    processing.value = false
  }
}

function reset() {
  pdfFile.value       = null
  pageCount.value     = 0
  srcPageSizeMm.value = null
  downloadUrl.value   = ''
  processErr.value    = ''
  fileErr.value       = ''
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="container-fluid py-4" style="max-width:680px">
    <div class="mb-3">
      <h4 class="mb-0 fw-semibold">PDF 出貨單裁切工具</h4>
      <small class="text-muted">裁切 A4 PDF 左上角標籤區域，輸出標籤機專用尺寸 PDF</small>
    </div>

    <!-- 步驟 1：尺寸 -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <h6 class="fw-semibold mb-3">① 設定裁切尺寸（保留左上角範圍）</h6>
        <div class="row g-3 align-items-end">
          <div class="col-sm-5">
            <label class="form-label">寬度（mm）</label>
            <div class="input-group input-group-sm">
              <input v-model.number="widthMm" type="number" min="10" max="297" step="1" class="form-control" />
              <span class="input-group-text">mm</span>
            </div>
          </div>
          <div class="col-sm-5">
            <label class="form-label">高度（mm）</label>
            <div class="input-group input-group-sm">
              <input v-model.number="heightMm" type="number" min="10" max="420" step="1" class="form-control" />
              <span class="input-group-text">mm</span>
            </div>
          </div>
          <div class="col-sm-2">
            <div class="text-muted small">
              <div>A4 = 210×297</div>
              <div>預設 100×150</div>
            </div>
          </div>
        </div>

        <!-- 快速預設 -->
        <div class="mt-2 d-flex gap-2 flex-wrap">
          <span class="text-muted small me-1">快速套用：</span>
          <button class="btn btn-outline-secondary btn-sm py-0" @click="widthMm=100; heightMm=150">100×150</button>
          <button class="btn btn-outline-secondary btn-sm py-0" @click="widthMm=100; heightMm=100">100×100</button>
          <button class="btn btn-outline-secondary btn-sm py-0" @click="widthMm=105; heightMm=148">A6 (105×148)</button>
          <button class="btn btn-outline-secondary btn-sm py-0" @click="widthMm=210; heightMm=148">A5 (210×148)</button>
        </div>
      </div>
    </div>

    <!-- 步驟 2：上傳 -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <h6 class="fw-semibold mb-3">② 上傳 PDF</h6>
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf"
          class="form-control form-control-sm"
          @change="onFileChange"
        />
        <div v-if="fileErr" class="text-danger small mt-2">{{ fileErr }}</div>

        <!-- 檔案資訊 -->
        <div v-if="pdfFile && srcPageSizeMm" class="mt-3 p-3 rounded bg-light small">
          <div><strong>檔案：</strong>{{ pdfFile.name }}</div>
          <div><strong>頁數：</strong>{{ pageCount }} 頁</div>
          <div><strong>原始頁面大小：</strong>{{ srcPageSizeMm.w }} × {{ srcPageSizeMm.h }} mm</div>
          <div class="mt-1 text-primary">
            → 裁切後每頁輸出：{{ widthMm }} × {{ heightMm }} mm（保留左上角）
          </div>
        </div>
      </div>
    </div>

    <!-- 步驟 3：執行 -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <h6 class="fw-semibold mb-3">③ 裁切並下載</h6>

        <div v-if="processErr" class="alert alert-danger py-2 small">{{ processErr }}</div>

        <div class="d-flex gap-2">
          <button
            class="btn btn-primary btn-sm"
            :disabled="!pdfFile || processing"
            @click="process"
          >
            <span v-if="processing" class="spinner-border spinner-border-sm me-1"></span>
            {{ processing ? '處理中…' : '開始裁切' }}
          </button>
          <button class="btn btn-outline-secondary btn-sm" @click="reset">清除重來</button>
        </div>

        <!-- 下載 -->
        <div v-if="downloadUrl" class="mt-3 p-3 rounded border border-success bg-success bg-opacity-10">
          <div class="text-success fw-semibold mb-2">✓ 裁切完成！</div>
          <div class="d-flex gap-2 flex-wrap">
            <a
              :href="downloadUrl"
              :download="outputFileName"
              class="btn btn-success btn-sm"
            >
              下載 PDF
            </a>
            <a
              :href="downloadUrl"
              target="_blank"
              rel="noopener"
              class="btn btn-outline-success btn-sm"
            >
              在瀏覽器開啟列印
            </a>
          </div>
          <div class="text-muted small mt-2">
            共 {{ pageCount }} 頁，每頁 {{ widthMm }}×{{ heightMm }} mm
          </div>
          <div class="alert alert-warning py-2 small mt-2 mb-0">
            ⚠️ 列印時請在瀏覽器的列印對話框中<strong>取消勾選「頁首和頁尾」</strong>，否則會出現日期時間等多餘文字。
          </div>
        </div>
      </div>
    </div>

    <!-- 說明 -->
    <div class="text-muted small">
      <strong>使用說明：</strong>
      裁切範圍為每頁的<strong>左上角</strong>，適用於藍新等金流平台的 A4 出貨單（標籤印在左上角）。
      調整寬高後可重新點「開始裁切」，無需重新上傳檔案。
    </div>
  </div>
</template>
